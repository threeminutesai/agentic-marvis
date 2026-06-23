// src/main/status/htmlPanelTemplate.js
// Default style/structure reference template auto-generated into
// <dataDir>/html-panels/_template.html on first run (or if that file is
// ever missing/emptied) so delegated CLI report tasks always have a
// template to match their look and feel against - see getHtmlPanelTemplatePath
// in ipcHandlers.js.
const DEFAULT_TEMPLATE_HTML = `<article class="report-panel">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;600&display=swap');

    .report-panel {
      --rp-void: #07140d;
      --rp-night: #0c2117;
      --rp-night-2: #112d1f;
      --rp-ion: #4ade80;
      --rp-ion-soft: rgba(74, 222, 128, 0.35);
      --rp-ion-bright: #a7f3c6;
      --rp-amber: #d8a94e;
      --rp-text: #dcebe0;
      --rp-text-dim: #82a692;
      --rp-glass: rgba(13, 35, 24, 0.7);
      --rp-glass-border: rgba(74, 222, 128, 0.25);

      position: relative;
      max-width: 800px;
      margin: 0 auto;
      padding: 28px 30px 26px 32px;
      color: var(--rp-text);
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.6;
      background:
        radial-gradient(ellipse 140% 100% at 0% 0%, var(--rp-night-2) 0%, var(--rp-night) 55%, var(--rp-void) 100%);
      border: 1px solid var(--rp-glass-border);
      border-radius: 16px;
      box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.06), 0 18px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03);
      overflow: hidden;
    }

    .report-panel::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 3px;
      background: linear-gradient(180deg, var(--rp-ion) 0%, var(--rp-ion-soft) 55%, transparent 100%);
      box-shadow: 0 0 10px var(--rp-ion-soft);
    }

    .report-panel::after {
      content: '';
      position: absolute;
      top: 14px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-top: 1px solid var(--rp-ion-soft);
      border-right: 1px solid var(--rp-ion-soft);
      opacity: 0.6;
      pointer-events: none;
    }

    .report-header { margin: 0 0 22px; }

    .report-kicker {
      margin: 0 0 8px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--rp-ion-bright);
      font-family: 'Fraunces', serif;
      font-size: 11px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .report-kicker::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--rp-ion-bright);
      box-shadow: 0 0 8px 2px var(--rp-ion-soft);
    }

    .report-title {
      margin: 0;
      font-family: 'Fraunces', serif;
      color: var(--rp-ion-bright);
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      text-shadow: 0 0 18px var(--rp-ion-soft);
    }

    .report-meta {
      margin: 10px 0 0;
      color: var(--rp-text-dim);
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .report-stats {
      margin: 0 0 22px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .report-stat {
      background: var(--rp-glass);
      border: 1px solid var(--rp-glass-border);
      border-top: 2px solid var(--rp-ion);
      border-radius: 10px;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .report-stat-value {
      font-family: 'Fraunces', serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--rp-ion-bright);
      text-shadow: 0 0 12px var(--rp-ion-soft);
    }

    .report-stat-label {
      font-size: 10px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--rp-text-dim);
    }

    .report-image {
      margin: 0 0 22px;
      border: 1px solid var(--rp-glass-border);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(6, 16, 11, 0.55);
      position: relative;
    }

    .report-image::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.12), transparent 60%);
      pointer-events: none;
    }

    .report-image-label {
      min-height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: var(--rp-ion-bright);
      font-family: 'Fraunces', serif;
      font-size: 13px;
      letter-spacing: 1px;
      text-align: center;
    }

    .report-caption {
      margin: 0;
      padding: 10px 14px;
      color: var(--rp-text-dim);
      font-size: 12px;
      border-top: 1px solid var(--rp-glass-border);
    }

    .report-body { font-size: 15px; }
    .report-body p { margin: 0 0 14px; color: var(--rp-text); }
    .report-body p:last-child { margin-bottom: 0; }

    .report-highlights {
      margin: 0 0 22px;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .report-highlights li {
      position: relative;
      padding: 10px 14px 10px 30px;
      background: rgba(74, 222, 128, 0.07);
      border: 1px solid var(--rp-glass-border);
      border-radius: 8px;
      font-size: 14px;
      color: var(--rp-text);
    }

    .report-highlights li::before {
      content: '\\203A';
      position: absolute;
      left: 12px;
      top: 9px;
      color: var(--rp-ion-bright);
      font-weight: 700;
      text-shadow: 0 0 8px var(--rp-ion-soft);
    }

    .report-callout {
      margin: 0 0 22px;
      padding: 14px 16px;
      background: rgba(216, 169, 78, 0.1);
      border-left: 3px solid var(--rp-amber);
      border-radius: 6px;
      color: var(--rp-text);
      font-size: 14px;
      display: block;
    }

    .report-callout-label { color: var(--rp-amber); margin-right: 6px; }

    .report-sources {
      margin-top: 22px;
      padding-top: 14px;
      border-top: 1px solid var(--rp-glass-border);
      font-size: 13px;
      color: var(--rp-text-dim);
    }

    .report-sources ul { margin: 8px 0 0; padding-left: 18px; }
    .report-sources a { color: var(--rp-ion-bright); text-decoration: none; }
    .report-sources a:hover { text-decoration: underline; }
  </style>

  <header class="report-header">
    <p class="report-kicker">{{KICKER}}</p>
    <h1 class="report-title">{{TITLE}}</h1>
    <p class="report-meta">{{DATE}}</p>
  </header>

  <section class="report-stats">
    <div class="report-stat">
      <span class="report-stat-value">{{STAT_1_VALUE}}</span>
      <span class="report-stat-label">{{STAT_1_LABEL}}</span>
    </div>
    <div class="report-stat">
      <span class="report-stat-value">{{STAT_2_VALUE}}</span>
      <span class="report-stat-label">{{STAT_2_LABEL}}</span>
    </div>
    <div class="report-stat">
      <span class="report-stat-value">{{STAT_3_VALUE}}</span>
      <span class="report-stat-label">{{STAT_3_LABEL}}</span>
    </div>
  </section>

  <figure class="report-image">
    <div class="report-image-label">{{IMAGE_LABEL}}</div>
    <figcaption class="report-caption">{{IMAGE_CAPTION}}</figcaption>
  </figure>

  <div class="report-body">
    {{BODY}}
  </div>

  <ul class="report-highlights">
    <li>{{HIGHLIGHT_1}}</li>
    <li>{{HIGHLIGHT_2}}</li>
    <li>{{HIGHLIGHT_3}}</li>
  </ul>

  <aside class="report-callout">
    <strong class="report-callout-label">{{CALLOUT_LABEL}}</strong>
    <span class="report-callout-text">{{CALLOUT_TEXT}}</span>
  </aside>

  <footer class="report-sources">
    <strong>Sources</strong>
    <ul>
      {{SOURCES}}
    </ul>
  </footer>
</article>
`;

module.exports = { DEFAULT_TEMPLATE_HTML };
