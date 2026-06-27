const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createMemoryStore,
  buildConversationSummary,
  tokenize,
  vectorizeText,
} = require('../src/main/memory/memoryStore');

test('buildConversationSummary emphasizes summary and HTML outcome', () => {
  const summary = buildConversationSummary({
    source: 'codex',
    userText: 'Create a robotics competition report with charts and action items',
    assistantText: 'Built the report and highlighted the top three scheduling risks.',
    hadHtml: true,
  });

  assert.match(summary, /Codex handled/i);
  assert.match(summary, /visual\/report result/i);
  assert.match(summary, /scheduling risks/i);
});

test('tokenize and vectorizeText produce stable local vector content', () => {
  const tokens = tokenize('Robotics report about drones, robotics, and scheduling.');
  assert.deepEqual(tokens.includes('robotics'), true);
  assert.deepEqual(tokens.includes('report'), true);

  const vector = vectorizeText('robotics robotics drones');
  assert.equal(Array.isArray(vector), true);
  assert.equal(vector.length, 64);
  assert.equal(vector.some((value) => value > 0), true);
});

test('createMemoryStore remembers and retrieves relevant summaries locally', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marvis-memory-test-'));
  const filePath = path.join(tempDir, 'conversation-memory.json');

  try {
    const store = createMemoryStore({ filePath, maxEntries: 10 });
    store.rememberConversation({
      source: 'marvis',
      userText: 'We discussed robotics class planning for next week.',
      assistantText: 'You planned a robotics class agenda covering sensors, drones, and build time.',
      hadHtml: false,
    });
    store.rememberConversation({
      source: 'codex',
      userText: 'Build a sales dashboard report for the drone kits.',
      assistantText: 'Created a dashboard report with top-selling kits and margin notes.',
      hadHtml: true,
    });

    const results = store.search('robotics agenda for class');
    assert.equal(results.length > 0, true);
    assert.match(results[0].summary, /robotics class agenda/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
