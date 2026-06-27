# Agentic Marvis

A Jarvis-inspired desktop AI assistant with voice, a live status dashboard, music scheduling, and one-click delegation to Claude Code and Codex CLI.

受 Jarvis 启发的桌面 AI 助手，支持语音交互、实时状态仪表盘、音乐排程，以及一键将任务委派给 Claude Code 和 Codex CLI。

---

## Download

Windows build available on the [Releases page](https://github.com/threeminutesai/agentic-marvis/releases). Download `Marvis-vX.X.X-win32-x64.zip`, extract, run `Marvis.exe` — no installation or Node.js required. macOS and Linux builds are coming.

Windows 版本可在 [Releases 页面](https://github.com/threeminutesai/agentic-marvis/releases) 下载。下载 `Marvis-vX.X.X-win32-x64.zip` 解压后直接运行 `Marvis.exe`，无需安装或 Node.js。macOS 与 Linux 版本即将推出。

## Run from source

```bash
npm install
npm start
```

Windows: double-click `run.bat` — installs on first run, then launches.

Windows：双击 `run.bat`，首次运行自动安装依赖后启动。

---

## First-time setup

Open **Settings** and fill in:

| What | Where to get it |
|------|----------------|
| Chat provider (DeepSeek / Gemini / Ollama) | [DeepSeek](https://platform.deepseek.com/) · [Google AI Studio](https://aistudio.google.com/apikey) · local Ollama server |
| ElevenLabs API key (voice, optional) | [elevenlabs.io](https://elevenlabs.io/app/home) |
| Active project folder | any folder on your machine |

That's it. Marvis starts a spoken briefing on launch once the status data is in place (see [Briefing](#briefing-weather-news-email) below).

打开 **Settings** 填写：

| 内容 | 获取方式 |
|------|---------|
| 聊天 provider（DeepSeek / Gemini / Ollama） | [DeepSeek](https://platform.deepseek.com/) · [Google AI Studio](https://aistudio.google.com/apikey) · 本地 Ollama 服务 |
| ElevenLabs API key（语音，可选） | [elevenlabs.io](https://elevenlabs.io/app/home) |
| 当前项目文件夹 | 本机任意文件夹 |

完成后启动即可。如果简报数据已就位，Marvis 会在启动时播报语音简报（详见下方 [简报](#briefing-weather-news-email)）。

---

## Talking to Marvis

Just type — Marvis decides whether to answer directly or delegate to Claude Code / Codex based on what you asked. You can also be explicit:

| Command | What it does |
|---------|-------------|
| `<anything>` | Marvis answers, or auto-routes to Claude / Codex if it's a project task |
| `/claude <task>` or `/code <task>` | Delegates straight to the `claude` CLI |
| `/codex <task>` | Delegates straight to the `codex` CLI |
| `open <keyword>` | Opens a saved HTML report by keyword |

直接输入即可，Marvis 会判断是直接回答还是委派给 Claude Code / Codex。也可以明确指定：

| 命令 | 说明 |
|------|------|
| `<任意内容>` | Marvis 直接回答，或自动路由到 Claude / Codex |
| `/claude <任务>` 或 `/code <任务>` | 直接委派给 `claude` CLI |
| `/codex <任务>` | 直接委派给 `codex` CLI |
| `open <关键词>` | 按关键词打开已保存的 HTML 报告 |

**HTML report follow-ups:** after `/claude` generates a report, ask follow-up questions in plain chat — the panel stays open and Claude reads the file to answer. Switching to an unrelated topic closes the panel automatically.

**HTML 报告追问：** `/claude` 生成报告后，可直接在聊天中追问，面板保持打开，Claude 读取文件后回答。切换到无关话题时面板自动关闭。

---

## Voice

Configure in Settings → Voice:

- **Mic button** — records your message and transcribes it via ElevenLabs (requires ElevenLabs key).
- **Text-to-speech** — every reply is spoken aloud. Uses ElevenLabs if a key is set, otherwise the browser's built-in voice. Mute button silences immediately.
- **ElevenLabs voices** — add voices by name + ID (find IDs in the [ElevenLabs Voice Library](https://elevenlabs.io/app/voice-library)), pick the active one from the dropdown.
- **Wake word** — not ready yet.

在 Settings → Voice 中配置：

- **Mic 按钮** — 录音后由 ElevenLabs 转写（需要 ElevenLabs key）。
- **文字转语音** — 每条回复都会被朗读。已配置 ElevenLabs key 则使用 ElevenLabs，否则使用浏览器内建语音。Mute 按钮立即静音。
- **ElevenLabs 声音** — 填写 name + ID（在 [ElevenLabs Voice Library](https://elevenlabs.io/app/voice-library) 找 ID），从下拉中选择当前声音。
- **唤醒词** — 尚未完成。

---

## Music

Settings → Music: import tracks, build playlists, and schedule by day and time (e.g. focus music on weekday mornings). Music auto-plays on schedule, ducks when Marvis speaks, and has a loudness leveler so tracks at different volumes don't need manual adjustment.

Seven royalty-free sample tracks are included on first launch — see [ATTRIBUTION.md](data/music/ATTRIBUTION.md). Delete them anytime.

Settings → Music：导入音乐、建立播放列表，按星期和时段设置排程。音乐按时自动播放，Marvis 讲话时自动压低，内置响度平衡避免手动调整音量。

首次启动预载七首免版税示例音乐，详见 [ATTRIBUTION.md](data/music/ATTRIBUTION.md)，可随时删除。

---

## HTML reports

When Claude or Codex generates a report, it appears in the right panel. Reports are saved to `data/html-panels` and can be reopened anytime:

- `open financial` → opens the matching saved report
- `show Q2` → same
- `/open dashboard` → same

Ask follow-up questions about the displayed report in plain chat — Marvis keeps the panel open and answers from the file content.

Claude 或 Codex 生成报告后会显示在右侧面板，并保存到 `data/html-panels`，随时可以重新打开：

- `open financial` → 打开匹配的已保存报告
- `show Q2` → 同上
- `/open dashboard` → 同上

可在聊天中直接追问当前报告，Marvis 保持面板打开并从文件内容中回答。

---

## Briefing (Weather, News, Email)

The status board and spoken greeting pull from `data/marvis-status.json`. Marvis reads this file on launch but does not refresh it — you control when it updates.

**To automate:** use the bundled `agentic-marvis-brief` skill with Claude Code or Codex to regenerate `marvis-status.json` on a schedule (news, weather, Gmail triage). Run it manually or set up a cron / task scheduler to call it periodically.

```bash
# example: regenerate briefing data with Claude Code
claude --skill skills/agentic-marvis-brief
```

状态看板和语音简报来自 `data/marvis-status.json`。Marvis 启动时读取，但不会自动刷新，更新时机由你决定。

**自动化方式：** 使用内置的 `agentic-marvis-brief` skill，通过 Claude Code 或 Codex 定期重新生成 `marvis-status.json`（包含新闻、天气、Gmail 分类）。可手动运行，也可通过计划任务或 cron 定期触发。

```bash
# 示例：用 Claude Code 重新生成简报数据
claude --skill skills/agentic-marvis-brief
```

---

## Bundled skills

| Skill | What it does |
|-------|-------------|
| [`agentic-marvis-brief`](skills/agentic-marvis-brief) | Fills `marvis-status.json` with news, weather, Gmail triage, and briefing data |
| [`agentic-marvis-dashboard`](skills/agentic-marvis-dashboard) | Turns spreadsheets into a single-file HTML dashboard with KPI cards, charts, and tables |

| Skill | 说明 |
|-------|------|
| [`agentic-marvis-brief`](skills/agentic-marvis-brief) | 生成包含新闻、天气、Gmail 分类的 `marvis-status.json` |
| [`agentic-marvis-dashboard`](skills/agentic-marvis-dashboard) | 将电子表格转换为含 KPI 卡片、图表与表格的单文件 HTML 仪表板 |
