(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }
  root.MarvisReportOpenIntent = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function reportOpenIntentFactory() {
  function looksLikeReportOpenRequest(text) {
    const raw = String(text || '').trim();
    const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
    const mentionsReport = /\b(?:report|panel|dashboard|brief|html)\b/i.test(normalized)
      || /(?:报告|報告|面板|简报|簡報|仪表板|儀表板|html)/i.test(raw);
    const mentionsOpen = /^(?:\/?(?:open|show|display)\b|\/?(?:打开|打開|显示|顯示))/.test(normalized)
      || /(?:last|previous|latest|newest|most recent|just now|earlier)/i.test(normalized)
      || /(?:刚才|剛才|刚刚|剛剛|上一份|上一个|上一個|上次|最新|最近)/.test(raw);
    return mentionsReport && mentionsOpen;
  }

  function getReportOpenIntent(text) {
    const raw = String(text || '').trim();
    const normalized = raw
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const mentionsReport = /\b(?:report|panel|dashboard|brief)\b/i.test(normalized)
      || /(?:报告|報告|面板|简报|簡報|仪表板|儀表板)/.test(raw);
    if (!mentionsReport) return null;

    const trailingPunctuation = '[。．.!！?？]*$';
    const recentEnglish = new RegExp(
      `^(?:(?:\\/open|open|show)\\s+)?(?:the\\s+)?(?:last|previous|just now(?:'s)?|earlier)\\s+(?:html\\s+)?(?:report|panel|dashboard|brief)${trailingPunctuation}`,
      'i'
    );
    const recentChinese = new RegExp(
      `^(?:\\/?(?:打开|打開|显示|顯示))?\\s*(?:刚才|剛才|刚刚|剛剛|上一份|上一个|上一個|上次)(?:的|那份|那个|那個|這份|这份)?\\s*(?:html\\s*)?(?:报告|報告|面板|简报|簡報|仪表板|儀表板)${trailingPunctuation}`
    );
    if (recentEnglish.test(normalized) || recentChinese.test(raw)) {
      return { kind: 'recent' };
    }

    const latestEnglish = new RegExp(
      `^(?:(?:\\/open|open|show)\\s+)?(?:the\\s+)?(?:latest|newest|most recent)\\s+(?:html\\s+)?(?:report|panel|dashboard|brief)${trailingPunctuation}`,
      'i'
    );
    const latestChinese = new RegExp(
      `^(?:\\/?(?:打开|打開|显示|顯示))?\\s*(?:最新|最近)(?:的)?\\s*(?:html\\s*)?(?:报告|報告|面板|简报|簡報|仪表板|儀表板)${trailingPunctuation}`
    );
    if (latestEnglish.test(normalized) || latestChinese.test(raw)) {
      return { kind: 'latest' };
    }

    return null;
  }

  return {
    getReportOpenIntent,
    looksLikeReportOpenRequest,
  };
}));
