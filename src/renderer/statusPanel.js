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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined') {
  module.exports = { showPanel, showHTML, hidePanel, renderStatusBoard, extractHtmlBlock };
}
