const fs = require('node:fs');

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_VECTOR_SIZE = 64;
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'for', 'from',
  'get', 'got', 'had', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'just', 'me', 'my', 'of', 'on', 'or', 'our',
  'out', 'please', 'she', 'so', 'that', 'the', 'their', 'them', 'then', 'they',
  'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'why', 'with', 'you', 'your',
]);

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '')
    .replace(/^Source:.*$/gim, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function takeSnippet(text, maxLength = 180) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function hashToken(token, size = DEFAULT_VECTOR_SIZE) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function vectorizeText(text, size = DEFAULT_VECTOR_SIZE) {
  const tokens = tokenize(text);
  const vector = new Array(size).fill(0);
  if (!tokens.length) return vector;
  for (const token of tokens) {
    vector[hashToken(token, size)] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosineSimilarity(left = [], right = []) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += (left[index] || 0) * (right[index] || 0);
  }
  return score;
}

function extractKeywords(text, limit = 6) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function buildConversationSummary({ userText, assistantText, source, hadHtml }) {
  const userSnippet = takeSnippet(userText, 140);
  const assistantSnippet = takeSnippet(assistantText, hadHtml ? 160 : 200);
  const sourceLabel = source === 'codex'
    ? 'Codex'
    : source === 'claude'
      ? 'Claude Code'
      : 'Marvis';

  if (hadHtml) {
    return `${sourceLabel} handled "${userSnippet}" and finished with a visual/report result. Key outcome: ${assistantSnippet}`;
  }
  return `${sourceLabel} handled "${userSnippet}". Key outcome: ${assistantSnippet}`;
}

function createMemoryStore({ filePath, maxEntries = DEFAULT_MAX_ENTRIES, vectorSize = DEFAULT_VECTOR_SIZE }) {
  function load() {
    if (!fs.existsSync(filePath)) return { version: 1, entries: [] };
    const parsed = safeJsonParse(fs.readFileSync(filePath, 'utf8'), { version: 1, entries: [] });
    if (!Array.isArray(parsed.entries)) return { version: 1, entries: [] };
    return { version: 1, entries: parsed.entries };
  }

  function save(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  function rememberConversation({ source = 'marvis', userText, assistantText, hadHtml = false }) {
    const cleanUserText = normalizeText(userText);
    const cleanAssistantText = normalizeText(assistantText);
    if (!cleanUserText || !cleanAssistantText) return null;

    const summary = buildConversationSummary({
      userText: cleanUserText,
      assistantText: cleanAssistantText,
      source,
      hadHtml,
    });
    const memoryText = `${cleanUserText}\n${cleanAssistantText}\n${summary}`;
    const entry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source,
      userText: takeSnippet(cleanUserText, 220),
      assistantText: takeSnippet(cleanAssistantText, 260),
      summary,
      hadHtml: Boolean(hadHtml),
      keywords: extractKeywords(memoryText),
      vector: vectorizeText(memoryText, vectorSize),
    };

    const current = load();
    const entries = [...current.entries, entry].slice(-maxEntries);
    save({ version: 1, entries });
    return entry;
  }

  function search(query, limit = 3) {
    const cleanQuery = normalizeText(query);
    if (!cleanQuery) return [];
    const current = load();
    const queryVector = vectorizeText(cleanQuery, vectorSize);
    return current.entries
      .map((entry) => ({
        ...entry,
        score: cosineSimilarity(queryVector, entry.vector || []),
      }))
      .filter((entry) => entry.score > 0.08)
      .sort((a, b) => b.score - a.score || String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit)
      .map(({ score, ...entry }) => ({ ...entry, score: Number(score.toFixed(4)) }));
  }

  return {
    load,
    save,
    rememberConversation,
    search,
  };
}

module.exports = {
  createMemoryStore,
  normalizeText,
  tokenize,
  vectorizeText,
  cosineSimilarity,
  extractKeywords,
  buildConversationSummary,
};
