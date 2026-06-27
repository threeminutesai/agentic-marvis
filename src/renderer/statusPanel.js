// src/renderer/statusPanel.js
function showPanel(html) {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');
  panel.innerHTML = html;
  panel.dataset.panelType = 'status';
  delete panel.dataset.cliTitle;
  appBody.classList.add('panel-active');
}

function showCliActivityPanel(title, task, options = {}) {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');
  const { label = 'Live CLI', preserveLog = false } = options;
  const safeTitle = escapeHtml(title || 'CLI');
  const safeTask = escapeHtml(task || '');
  const safeLabel = escapeHtml(label);
  const canReuseLog = preserveLog && panel.dataset.panelType === 'cli' && panel.dataset.cliTitle === String(title || 'CLI');
  const existingLogHtml = canReuseLog ? (panel.querySelector('#cli-activity-log')?.innerHTML || '') : '';
  panel.innerHTML = `
    <div class="cli-activity-panel">
      <div class="cli-activity-header">
        <div class="cli-activity-label">${safeLabel}</div>
        <div class="cli-activity-title">${safeTitle}</div>
      </div>
      <div class="cli-activity-task">${safeTask}</div>
      <div class="cli-activity-log" id="cli-activity-log">${existingLogHtml}</div>
    </div>
  `;
  panel.dataset.panelType = 'cli';
  panel.dataset.cliTitle = String(title || 'CLI');
  appBody.classList.add('panel-active');
}

function appendCliActivityLine(text) {
  const log = document.getElementById('cli-activity-log');
  if (!log || !text) return;
  const nextText = String(text).trim();
  if (!nextText) return;
  const lastLine = log.lastElementChild;
  if (lastLine?.textContent === nextText) return;
  const line = document.createElement('div');
  line.className = 'cli-activity-line';
  line.textContent = nextText;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function updateCliActivityPanel({ label, task } = {}) {
  const panel = document.getElementById('status-panel');
  if (!panel || panel.dataset.panelType !== 'cli') return;
  if (typeof label === 'string') {
    const labelEl = panel.querySelector('.cli-activity-label');
    if (labelEl) labelEl.textContent = label;
  }
  if (typeof task === 'string') {
    const taskEl = panel.querySelector('.cli-activity-task');
    if (taskEl) taskEl.textContent = task;
  }
}

function showHTML(html) {
  showHTMLSafe(html);
}

// Safely display HTML in an isolated iframe to prevent CSS/script conflicts
function showHTMLSafe(html) {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');

  // Create iframe container with safe styling
  const iframeContainer = document.createElement('div');
  iframeContainer.style.gridColumn = '1 / -1';
  iframeContainer.style.height = '100%';
  iframeContainer.style.overflow = 'auto';

  // Create iframe with sandbox restrictions
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.style.display = 'block';
  iframe.style.background = '#ffffff';
  iframe.sandbox.add('allow-same-origin');
  iframe.sandbox.add('allow-scripts');

  iframeContainer.appendChild(iframe);
  panel.innerHTML = '';
  panel.appendChild(iframeContainer);
  panel.dataset.panelType = 'html';
  delete panel.dataset.cliTitle;
  appBody.classList.add('panel-active');

  // Write content to iframe document
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  const source = String(html || '');
  const isFullDocument = /<!doctype\s+html|<html[\s>]/i.test(source);
  iframeDoc.open();
  iframeDoc.write(isFullDocument ? source : `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body { min-height: 100%; }
    body { margin: 0; padding: 16px; font-family: inherit; background: #ffffff; }
  </style>
</head>
<body>${html}</body>
</html>`);
  iframeDoc.close();
}

function hidePanel() {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');
  if (panel) {
    delete panel.dataset.panelType;
    delete panel.dataset.cliTitle;
  }
  appBody.classList.remove('panel-active');
}

function getCurrentLanguage() {
  return window.__marvisLanguage === 'zh' ? 'zh' : 'en';
}

function localizeStatusLabel(label) {
  const zh = {
    Weather: '天气',
    'Unread Emails': '未读邮件',
    'Urgent Emails': '紧急邮件',
    'Email Content': '邮件内容',
    'Latest News': '最新新闻',
    'News Briefing': '新闻简报',
    'Avatar Briefing': '语音简报',
    'User Profile': '用户档案',
    'Last Updated': '最后更新',
  };
  if (getCurrentLanguage() !== 'zh') return label;
  return zh[label] || label;
}

// How long each News Briefing item stays the focus, in ms. Shared with
// renderer.js so the avatar headline cycle and the stacked card entrances
// land in sync.
const NEWS_BRIEFING_ITEM_INTERVAL_MS = 3200;

// News Briefing rows store parallel value[]/detail[] arrays (one short
// headline + one longer detail per event). Older status files may still
// have a single string in each field; treat that as a one-item list.
// Capped at 15 items - if the source data has more, the newest items
// (the end of the array) replace the oldest rather than truncating to
// the first 15, since later entries are assumed to be the most current.
const NEWS_BRIEFING_MAX_ITEMS = 15;
const NEWS_URL_RE = /https?:\/\/\S+/gi;

function extractFirstHttpUrl(text) {
  const match = String(text || '').match(NEWS_URL_RE);
  return match ? match[0] : '';
}

function stripInlineUrls(text) {
  return String(text || '')
    .replace(NEWS_URL_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function getNewsSourceLabel(link) {
  if (!isSafeHttpUrl(link)) return 'Source';
  try {
    return new URL(link).hostname.replace(/^www\./i, '');
  } catch {
    return 'Source';
  }
}

function getNewsBriefingItems(row) {
  if (!row) return [];
  const headlines = Array.isArray(row.value) ? row.value : (row.value ? [row.value] : []);
  const details = Array.isArray(row.detail) ? row.detail : (row.detail ? [row.detail] : []);
  const images = Array.isArray(row.image) ? row.image : (row.image ? [row.image] : []);
  const links = Array.isArray(row.link) ? row.link : (row.link ? [row.link] : []);
  return headlines
    .map((headline, i) => {
      const cleanHeadline = stripInlineUrls(headline);
      const rawDetail = details[i] || '';
      const cleanDetail = stripInlineUrls(rawDetail);
      const inferredLink = links[i] || extractFirstHttpUrl(rawDetail) || extractFirstHttpUrl(headline) || '';
      return {
        headline: cleanHeadline,
        detail: cleanDetail || cleanHeadline,
        image: images[i] || '',
        link: inferredLink,
        sourceLabel: getNewsSourceLabel(inferredLink),
      };
    })
    .filter((item) => item.headline || item.detail)
    .slice(-NEWS_BRIEFING_MAX_ITEMS);
}

// Only allow http(s) URLs in src/href attributes - blocks javascript: and
// other script-bearing schemes from a status JSON that may include
// untrusted/fetched content.
function isSafeHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Channel resolution for image attachments - see docs/superpowers/specs/
// 2026-06-23-panel-screenshot-capture-design.md. Only the CLI delegate
// channels (Claude Code / Codex) can read a file off disk, so any send with
// a pending attachment is forced through one of these, never the plain
// chat providers.
const ATTACHMENT_CLI_PREFIXES = ['/code', '/claude', '/codex'];

function resolveAttachmentChannelKey(text, preferredCliChannel) {
  const trimmed = String(text || '').trim();
  const spaceIndex = trimmed.indexOf(' ');
  const prefix = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
  if (ATTACHMENT_CLI_PREFIXES.includes(prefix)) return prefix;
  return `/${preferredCliChannel || 'code'}`;
}

function renderStatusBoard(rows) {
  const topCardTypes = ['Weather', 'Unread Emails', 'Urgent Emails'];
  const firstThree = topCardTypes
    .map((type) => rows.find((row) => row.type === type && row.value))
    .filter(Boolean);
  const emailContent = rows.find((row) => row.type === 'Email Content');
  const urgentEmails = rows.find((row) => row.type === 'Urgent Emails');
  const emailContentDetail = emailContent?.detail || emailContent?.value || urgentEmails?.detail || urgentEmails?.value || '';
  const newsBriefingRow = rows.find((row) => row.type === 'News Briefing');
  const newsItems = getNewsBriefingItems(newsBriefingRow);

  let html = '';

  firstThree.forEach((row) => {
    const weatherClass = row.type === 'Weather' ? ' status-card-weather' : '';
    html += `
      <div class="status-card status-card-compact${weatherClass}">
        <div class="status-card-type">${escapeHtml(localizeStatusLabel(row.type))}</div>
        <div class="status-card-value">${escapeHtml(row.value)}</div>
      </div>
    `;
  });

  // Render email content card (full-width)
  if (emailContent) {
    html += `
      <div class="status-card status-card-email-content">
        <div class="status-card-type">${escapeHtml(localizeStatusLabel('Email Content'))}</div>
        <div class="status-card-body">
          ${escapeHtml(emailContentDetail)}
        </div>
      </div>
    `;
  }

  if (newsItems.length) {
    // Items start hidden; renderer.js reveals each one in sync with the
    // avatar headline/voice cycle (see playNewsBriefingCycle /
    // playNewsBriefingWithVoice) instead of a fixed CSS animation-delay.
    // No inline "details" link here - the whole card is clickable (see
    // renderer.js's news-briefing-stack click handler) and opens a floating
    // window with the full text and source link instead.
    const stackHtml = newsItems
      .map((item, i) => {
        const thumbHtml = isSafeHttpUrl(item.image)
          ? `<img class="news-briefing-thumb" src="${escapeHtml(item.image)}" alt="" />`
          : `<div class="news-briefing-thumb news-briefing-thumb-placeholder">${escapeHtml(item.sourceLabel || 'Source')}</div>`;
        const sourceHtml = isSafeHttpUrl(item.link)
          ? `<div class="news-briefing-source">${escapeHtml(item.sourceLabel || 'Source')}</div>`
          : '';
        return `
          <div class="news-briefing-item" id="news-briefing-item-${i}" data-news-index="${i}">
            ${thumbHtml}
            <div class="news-briefing-content">
              <div class="news-briefing-headline">${escapeHtml(item.headline)}</div>
              <div class="news-briefing-text">${escapeHtml(item.detail || item.headline)}</div>
              ${sourceHtml}
            </div>
          </div>
        `;
      })
      .join('');
    html += `
      <div class="status-card status-card-latest-news">
        <div class="status-card-type">${escapeHtml(localizeStatusLabel('Latest News'))}</div>
        <div class="status-card-body" id="news-briefing-stack">${stackHtml}</div>
      </div>
    `;
  }

  return html;
}

function extractHtmlBlock(text) {
  const match = /```html\r?\n([\s\S]*?)\r?\n```/.exec(text);
  if (!match) return null;
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return { html: match[1].trim(), before, after };
}

function extractVoiceContentBlock(text) {
  const voiceText = extractTaggedSection(text, ['voice', 'voice content']);
  if (voiceText !== null) {
    const htmlPath = extractTaggedSection(text, ['html', 'html file']) || '';
    return {
      voiceText: voiceText.trim(),
      displayText: extractTaggedSection(text, ['content', 'display content']) || '',
      htmlPath: normalizeHtmlPath(htmlPath),
    };
  }

  const legacyMarker = /\[voice content\]/i.exec(text);
  if (!legacyMarker) return null;
  const body = text.slice(legacyMarker.index + legacyMarker[0].length).trim();
  if (!body) return null;
  const parts = body.split(/\r?\n\s*\r?\n/);
  return {
    voiceText: parts.shift().trim(),
    displayText: parts.join('\n\n').trim(),
    htmlPath: '',
  };
}

function normalizeHtmlPath(value) {
  const firstLine = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
  return firstLine.replace(/^["']|["']$/g, '');
}

function extractTaggedSection(text, tags) {
  const tagPattern = tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const marker = new RegExp(`\\[(?:${tagPattern})\\]`, 'i').exec(text);
  if (!marker) return null;
  const after = text.slice(marker.index + marker[0].length);
  const next = /\r?\n\s*\[(?:voice|voice content|content|display content|html|html file)\]/i.exec(after);
  return (next ? after.slice(0, next.index) : after).trim();
}

function renderResearchSummary(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  let html = '<div class="research-summary">';
  let cardCount = 0;
  const looseLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const card = parseResearchBullet(trimmed);
    if (card) {
      cardCount += 1;
      html += `
        <article class="research-card">
          <div class="research-snapshot">${escapeHtml(card.source)}</div>
          <div class="research-content">
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.body)}</p>
            <a href="${escapeHtml(card.url)}">${escapeHtml(card.url)}</a>
          </div>
        </article>
      `;
    } else if (/^source basis:/i.test(trimmed)) {
      html += `<p class="research-source-note">${escapeHtml(trimmed)}</p>`;
    } else if (/^\[[^\]]*(?:snapshot|article img|contents?|link|display content)[^\]]*\]/i.test(trimmed)) {
      continue;
    } else if (/^below\b/i.test(trimmed)) {
      continue;
    } else {
      looseLines.push(trimmed);
    }
  }

  if (!cardCount && looseLines.length) {
    html += `<div class="research-plain">${escapeHtml(looseLines.join('\n'))}</div>`;
  } else if (looseLines.length) {
    html += `<div class="research-plain">${escapeHtml(looseLines.join('\n'))}</div>`;
  }

  html += '</div>';
  return html;
}

function renderContentBlock(markdown) {
  const content = String(markdown || '').trim();
  if (!content) return '';
  const research = renderResearchSummary(content);
  if (research.includes('research-card')) return research;
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = lines.shift() || 'Summary';
  const url = lines.find((line) => /^https?:\/\//.test(line));
  const body = lines.filter((line) => line !== url).join('\n');
  return `
    <div class="research-summary">
      <article class="research-card">
        <div class="research-snapshot">Image</div>
        <div class="research-content">
          <h3>${escapeHtml(title.replace(/^\[image\]\s*/i, ''))}</h3>
          <p>${escapeHtml(body)}</p>
          ${url ? `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : ''}
        </div>
      </article>
    </div>
  `;
}

function parseResearchBullet(line) {
  const match = /^-\s+\*\*(.+?):\*\*\s+([\s\S]*?)\s+\(\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)\s*$/.exec(line);
  if (!match) return null;
  return {
    title: match[1],
    body: match[2],
    source: match[3],
    url: match[4],
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined') {
  module.exports = {
    showPanel,
    showCliActivityPanel,
    appendCliActivityLine,
    updateCliActivityPanel,
    showHTML,
    hidePanel,
    renderStatusBoard,
    extractHtmlBlock,
    extractVoiceContentBlock,
    extractTaggedSection,
    renderContentBlock,
    renderResearchSummary,
    getNewsBriefingItems,
    isSafeHttpUrl,
    resolveAttachmentChannelKey,
    NEWS_BRIEFING_ITEM_INTERVAL_MS,
    NEWS_BRIEFING_MAX_ITEMS,
  };
}
