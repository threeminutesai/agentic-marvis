(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }
  root.MarvisWakeWordMatcher = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function wakeWordMatcherFactory() {
  const HAN_RE = /\p{Script=Han}/u;
  const LETTER_OR_NUMBER_RE = /[^\p{L}\p{N}]+/gu;
  const SPLIT_RE = /[|,，、;/]+/g;
  const TRANSCRIPT_SPLIT_RE = /[\s|,，、;:/-]+/g;
  const WAKE_WORD_ALIAS_MAP = {
    marvis: ['mavis', 'maurice', 'marcus', 'marvin', 'marvess', 'mervis'],
  };

  function levenshtein(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 0; i < left.length; i += 1) {
      const current = [i + 1];
      for (let j = 0; j < right.length; j += 1) {
        const insertCost = current[j] + 1;
        const deleteCost = previous[j + 1] + 1;
        const substituteCost = previous[j] + (left[i] === right[j] ? 0 : 1);
        current.push(Math.min(insertCost, deleteCost, substituteCost));
      }
      previous = current;
    }
    return previous[right.length];
  }

  function toText(value) {
    return String(value || '')
      .normalize('NFKC')
      .trim();
  }

  function normalize(value) {
    return toText(value).toLowerCase();
  }

  function compact(value) {
    return normalize(value).replace(LETTER_OR_NUMBER_RE, '');
  }

  function similarity(left, right) {
    const a = compact(left);
    const b = compact(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const distance = levenshtein(a, b);
    return 1 - (distance / Math.max(a.length, b.length));
  }

  function isHanText(value) {
    return HAN_RE.test(String(value || ''));
  }

  function tokenizeWakeWords(value) {
    return String(value || '')
      .split(SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function expandWakeWordAliases(value) {
    const aliases = tokenizeWakeWords(value);
    const expanded = new Set();
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;
      expanded.add(normalizedAlias);
      const extras = WAKE_WORD_ALIAS_MAP[normalizedAlias] || [];
      for (const extra of extras) {
        const normalizedExtra = normalize(extra);
        if (normalizedExtra) expanded.add(normalizedExtra);
      }
    }
    return Array.from(expanded);
  }

  function tokenizeTranscript(value) {
    const normalized = normalize(value);
    if (!normalized) return [];
    const delimiterTokens = normalized
      .split(TRANSCRIPT_SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
    const hanTokens = normalized.match(/\p{Script=Han}+/gu) || [];
    const compactToken = compact(normalized);
    return [...new Set([...delimiterTokens, ...hanTokens, compactToken].filter(Boolean))];
  }

  function bestWakeWordMatch(transcript, wakeWordOrWords, threshold = 0.8) {
    const transcriptText = normalize(transcript);
    if (!transcriptText) {
      return { detected: false, score: 0, alias: '', transcriptToken: '' };
    }
    const transcriptCompact = compact(transcriptText);

    const aliases = expandWakeWordAliases(wakeWordOrWords);
    if (!aliases.length) {
      return { detected: false, score: 0, alias: '', transcriptToken: '' };
    }

    const transcriptTokens = tokenizeTranscript(transcript);
    let best = { detected: false, score: 0, alias: '', transcriptToken: '' };

    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;

      const aliasCompact = compact(normalizedAlias);
      if (!aliasCompact) continue;

      const exactHit = transcriptText.includes(normalizedAlias)
        || transcriptCompact.includes(aliasCompact)
        || transcriptTokens.some((token) => compact(token) === aliasCompact);
      if (exactHit) {
        return { detected: true, score: 1, alias: normalizedAlias, transcriptToken: normalizedAlias };
      }

      for (const token of transcriptTokens) {
        const score = similarity(token, normalizedAlias);
        if (score > best.score) {
          best = {
            detected: score >= threshold,
            score,
            alias: normalizedAlias,
            transcriptToken: token,
          };
        }
      }
    }

    return best;
  }

  function matchesWakeWord(transcript, wakeWord, threshold = 0.8) {
    return bestWakeWordMatch(transcript, wakeWord, threshold).detected;
  }

  function detectWakeWord(transcript, wakeWordOrWords, threshold = 0.8) {
    return bestWakeWordMatch(transcript, wakeWordOrWords, threshold).detected;
  }

  function getRecognitionLang(wakeWord, fallbackLanguage = 'en') {
    return isHanText(wakeWord) || fallbackLanguage === 'zh' ? 'zh-CN' : 'en-US';
  }

  return {
    compact,
    bestWakeWordMatch,
    detectWakeWord,
    expandWakeWordAliases,
    getRecognitionLang,
    isHanText,
    matchesWakeWord,
    normalize,
    similarity,
    tokenizeWakeWords,
    tokenizeTranscript,
  };
}));
