// tests/renderer/statusPanel.test.js
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

function loadStatusPanel(html) {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  delete require.cache[require.resolve('../../src/renderer/statusPanel')];
  const mod = require('../../src/renderer/statusPanel');
  return { dom, mod };
}

test('showPanel injects HTML and activates the panel-active class', () => {
  const { dom, mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  mod.showPanel('<p>hello</p>');

  const appBody = dom.window.document.getElementById('app-body');
  const panel = dom.window.document.getElementById('status-panel');
  assert.ok(appBody.classList.contains('panel-active'));
  assert.strictEqual(panel.innerHTML, '<p>hello</p>');

  delete global.document;
});

test('hidePanel removes the panel-active class', () => {
  const { dom, mod } = loadStatusPanel('<div id="app-body" class="panel-active"><div id="status-panel"><p>x</p></div></div>');

  mod.hidePanel();

  const appBody = dom.window.document.getElementById('app-body');
  assert.ok(!appBody.classList.contains('panel-active'));

  delete global.document;
});

test('renderStatusBoard renders a card per row with type and value, omitting empty values', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C and sunny', detail: 'Clear skies.' },
    { type: 'Unread Emails', value: '', detail: '' },
  ]);

  assert.match(html, /Weather/);
  assert.match(html, /22C and sunny/);
  assert.doesNotMatch(html, /Clear skies\./);

  delete global.document;
});

test('extractHtmlBlock returns null when there is no fenced html block', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  assert.strictEqual(mod.extractHtmlBlock('just plain text, no code fence here'), null);

  delete global.document;
});

test('extractHtmlBlock extracts the block and surrounding text', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const text = 'Here is the report, sir.\n```html\n<table><tr><td>1</td></tr></table>\n```\nLet me know if you need more.';
  const result = mod.extractHtmlBlock(text);

  assert.strictEqual(result.html, '<table><tr><td>1</td></tr></table>');
  assert.strictEqual(result.before, 'Here is the report, sir.');
  assert.strictEqual(result.after, 'Let me know if you need more.');

  delete global.document;
});

test('extractHtmlBlock returns null for an unclosed fence', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const text = 'Here:\n```html\n<table></table>\nno closing fence';
  assert.strictEqual(mod.extractHtmlBlock(text), null);

  delete global.document;
});

test('renderStatusBoard renders compact top cards, email content, and latest news below it', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C and sunny', detail: 'Clear.' },
    { type: 'Unread Emails', value: '5', detail: '' },
    { type: 'Urgent Emails', value: '1', detail: '' },
    { type: 'News Briefing', value: 'Markets up, no major headlines.', detail: '' },
    { type: 'Email Content', value: '', detail: 'Recent emails summary.' },
  ]);

  const compactCardMatches = html.match(/status-card status-card-compact/g) || [];
  const emailCardMatches = html.match(/<div class="status-card status-card-email-content">/g) || [];
  const latestNewsMatches = html.match(/<div class="status-card status-card-latest-news">/g) || [];
  assert.strictEqual(compactCardMatches.length, 3);
  assert.strictEqual(emailCardMatches.length, 1);
  assert.strictEqual(latestNewsMatches.length, 1);

  assert.match(html, /Weather/);
  assert.match(html, /Unread Emails/);
  assert.match(html, /Urgent Emails/);
  assert.match(html, /Recent emails summary/);
  assert.match(html, /Latest News/);
  assert.match(html, /Markets up, no major headlines/);
  assert.ok(html.indexOf('Email Content') < html.indexOf('Latest News'));

  delete global.document;
});

test('renderStatusBoard accepts numeric status values without crashing', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Unread Emails', value: 5, detail: '' },
    { type: 'Urgent Emails', value: 1, detail: '' },
  ]);

  assert.match(html, /Unread Emails/);
  assert.match(html, />5</);
  assert.match(html, /Urgent Emails/);
  assert.match(html, />1</);

  delete global.document;
});

test('renderStatusBoard renders email content box even if detail is empty', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Email Content', value: '', detail: '' },
  ]);

  // Should still render the card, just empty
  assert.match(html, /status-card-email-content/);

  delete global.document;
});

test('renderStatusBoard filters out rows with empty value except Email Content', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C', detail: 'Clear.' },
    { type: 'Unread Emails', value: '', detail: '' },
    { type: 'Email Content', value: '', detail: 'Some content' },
  ]);

  // Should have Weather (has value) and Email Content (always rendered)
  const compactCardMatches = html.match(/status-card status-card-compact/g) || [];
  const emailCardMatches = html.match(/<div class="status-card status-card-email-content">/g) || [];
  assert.strictEqual(compactCardMatches.length, 1);
  assert.strictEqual(emailCardMatches.length, 1);

  assert.match(html, /Weather/);
  assert.doesNotMatch(html, /Unread Emails/);
  assert.match(html, /Some content/);

  delete global.document;
});
