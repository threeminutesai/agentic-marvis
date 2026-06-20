// src/renderer/statusPanel.js
function showPanel(html) {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');
  panel.innerHTML = html;
  appBody.classList.add('panel-active');
}

function showHTML(html) {
  // Wrap HTML to span full width of grid (replaces status cards)
  const wrapped = `<div style="grid-column: 1 / -1;">${html}</div>`;
  showPanel(wrapped);
}

function hidePanel() {
  const appBody = document.getElementById('app-body');
  appBody.classList.remove('panel-active');
}

function renderStatusBoard(rows) {
  const topCardTypes = ['Weather', 'Unread Emails', 'Urgent Emails'];
  const firstThree = topCardTypes
    .map((type) => rows.find((row) => row.type === type && row.value))
    .filter(Boolean);
  const emailContent = rows.find((row) => row.type === 'Email Content');
  const latestNews = rows.find((row) => row.type === 'News Briefing' && (row.value || row.detail));

  let html = '';

  firstThree.forEach((row) => {
    html += `
      <div class="status-card status-card-compact">
        <div class="status-card-type">${escapeHtml(row.type)}</div>
        <div class="status-card-value">${escapeHtml(row.value)}</div>
      </div>
    `;
  });

  // Render email content card (full-width)
  if (emailContent) {
    html += `
      <div class="status-card status-card-email-content">
        <div class="status-card-type">Email Content</div>
        <div class="status-card-body">
          ${escapeHtml(emailContent.detail || '')}
        </div>
      </div>
    `;
  }

  if (latestNews) {
    html += `
      <div class="status-card status-card-latest-news">
        <div class="status-card-type">Latest News</div>
        <div class="status-card-body">
          ${escapeHtml(latestNews.detail || latestNews.value || '')}
        </div>
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
    return {
      voiceText: voiceText.trim(),
      displayText: extractTaggedSection(text, ['content', 'display content']) || '',
      htmlPath: extractTaggedSection(text, ['html', 'html file']) || '',
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
    showHTML,
    hidePanel,
    renderStatusBoard,
    extractHtmlBlock,
    extractVoiceContentBlock,
    extractTaggedSection,
    renderContentBlock,
    renderResearchSummary,
  };
}
