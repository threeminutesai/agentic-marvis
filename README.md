# Agentic Marvis
Agentic Marvis is a Jarvis-inspired desktop AI assistant that unifies Codex and Claude Code through an immersive voice-first interface, real-time status dashboard, and intelligent task orchestration.

Agentic Marvis 是一款受 Jarvis 启发的桌面 AI 助手，通过沉浸式语音交互、实时状态仪表盘和智能任务编排，将 Codex 与 Claude Code 无缝连接。

## Download

A packaged Windows build is available on the [Releases page](https://github.com/threeminutesai/agentic-marvis/releases). Download `Marvis-vX.X.X-win32-x64.zip`, extract it, and run `Marvis.exe` directly — no installation or Node.js required. macOS and Linux builds are coming.

已打包的 Windows 版本可在 [Releases 页面](https://github.com/threeminutesai/agentic-marvis/releases) 下载。下载 `Marvis-vX.X.X-win32-x64.zip` 后解压，直接运行 `Marvis.exe`，无需安装或 Node.js。macOS 与 Linux 版本即将推出。

## Setup

1. `npm install`
2. `npm start`
3. On first launch, choose DeepSeek, Gemini, or Ollama. DeepSeek and Gemini need an API key; Ollama uses your local runtime. Then set an active project folder in Settings.

1. `npm install`
2. `npm start`
3. 首次启动时选择 DeepSeek、Gemini 或 Ollama。DeepSeek 和 Gemini 需要 API key，Ollama 使用本地运行环境。然后在 Settings 中设置当前项目文件夹。

## AI Providers

Marvis combines three kinds of AI integration, each doing a different job:

- **Chat bot (DeepSeek, Gemini, or Ollama)** - powers Marvis's own conversational replies. Pick one from the Settings panel's provider dropdown:
  - **DeepSeek** (default) - paid, no free tier.
  - **Gemini** - has a free tier (Google AI Studio); get a key at https://aistudio.google.com/apikey.
  - **Ollama** - local model runtime. No API key is needed, but you do need a running Ollama server and a local model name such as `llama3.1:8b`.
- Cloud-provider keys are stored separately (encrypted at rest), so switching the dropdown doesn't lose another key. Ollama keeps its configured base URL and model in Settings.
- **Claude Code / Codex CLI (heavy lifting)** - not a chat provider; these are delegated to for actual work against your project (writing code, running tasks) when a plain chat reply isn't enough. See [CLI delegation channels](#cli-delegation-channels) below. Claude Code authenticates via its own CLI subscription login, not an API key.
- **ElevenLabs (speech)** - powers both directions of voice: text-to-speech for Marvis's spoken replies, and speech-to-text for transcribing what you say. You may gett API from https://elevenlabs.io/app/home. See [Voice](#voice) below.

Marvis 结合了三类 AI 能力，每一类负责不同的工作：

- **聊天机器人（DeepSeek、Gemini 或 Ollama）** - 负责 Marvis 自己的对话回复，可在 Settings 面板的 provider 下拉选单中选择：
  - **DeepSeek**（默认）- 付费服务，无免费额度。
  - **Gemini** - 提供免费额度（Google AI Studio）；可在 https://aistudio.google.com/apikey 获取密钥。
  - **Ollama** - 本地模型运行环境。不需要 API key，但需要本机正在运行的 Ollama 服务，以及一个本地模型名称，例如 `llama3.1:8b`。
- 云端 provider 的密钥会分别存储（静态加密），因此切换下拉选项时不会丢失另一边的密钥。Ollama 则会在 Settings 中保存它的地址与模型名称。
- **Claude Code / Codex CLI（重任务执行）** - 这不是聊天 provider；当普通对话回复不够时，Marvis 会把真正的项目工作（写代码、执行任务）委派给它们。详见下方的 [CLI delegation channels](#cli-delegation-channels)。Claude Code 使用自己的 CLI 订阅登录，而不是 API key。
- **ElevenLabs（语音）** - 负责双向语音能力，包括 Marvis 回复的文字转语音，以及将你的语音转写为文字。API获取 [https://elevenlabs.io/app/home](https://elevenlabs.io/app/home)。 详见下方的 [Voice](#voice)。

### Quick launch (Windows)

Double-click `run.bat` - installs dependencies on first run if needed, then starts the app.

双击 `run.bat` 即可启动；如有需要会在首次运行时自动安装依赖，然后启动应用。

## Testing

`npm test`

`npm test`

## Bundled skills

This repo also includes reusable Marvis skills under [`skills/`](skills):

- `agentic-marvis-brief` - fills `marvis-status.json` with profile-aware news, weather, Gmail triage, and avatar briefing data.
- `agentic-marvis-dashboard` - turns spreadsheets into a single-file HTML dashboard with KPI cards, charts, tables, and progress visuals.

这个仓库也在 [`skills/`](skills) 目录中附带了可复用的 Marvis skills：

- `agentic-marvis-brief` - 为 `marvis-status.json` 填入结合用户画像的新闻、天气、Gmail 分类与头像简报数据。
- `agentic-marvis-dashboard` - 把电子表格转换成单文件 HTML 仪表板，包含 KPI 卡片、图表、表格和进度可视化。

## Voice

Optional, configured in Settings:

- **Wake word** - not ready yet. The wake word flow is still in progress and should be treated as unfinished for now.
- **Speech-to-text (Mic button)** - recording your own messages via the Mic button is transcribed by ElevenLabs and requires an ElevenLabs API key configured in Settings; without one it reports that transcription isn't available rather than falling back.
- **Text-to-speech** - every reply is spoken aloud. Uses ElevenLabs if a key is configured (https://elevenlabs.io/), otherwise falls back to the browser's built-in voice. Use the Mute button to silence it - muting immediately interrupts any speech currently playing. Manage ElevenLabs voices in Settings: enter a voice's name and ID (find the ID on a voice's page in the ElevenLabs Voice Library) and click "Add Voice" to save it to the dropdown; pick the active voice from the "ElevenLabs Voice" dropdown, or remove a saved one with "Remove Selected". Defaults to "Adam" if none is selected.

可选功能，可在 Settings 中配置：

- **唤醒词** - 目前尚未完成。这个唤醒词流程仍在开发中，现阶段应视为未完成功能。
- **语音转文字（Mic 按钮）** - 通过 Mic 按钮录制的语音会由 ElevenLabs 转写，因此需要先在 Settings 中配置 ElevenLabs API key；如果没有配置，会直接提示当前无法转写，而不会自动切换到其他方案。
- **文字转语音** - 每条回复都会被朗读。如果已配置 ElevenLabs key，则优先使用 ElevenLabs（https://elevenlabs.io/）；否则回退到浏览器内建语音。使用 Mute 按钮可立即静音，并会马上打断当前正在播放的语音。你也可以在 Settings 中管理 ElevenLabs 声音：输入 voice name 和 ID（可在 ElevenLabs Voice Library 的对应声音页面找到 ID），点击 “Add Voice” 保存到下拉列表；在 “ElevenLabs Voice” 下拉中选择当前使用的声音，或用 “Remove Selected” 删除。若未选择，默认使用 “Adam”。

## Music

Settings -> Music lets you import your own tracks, build playlists, and schedule them by day-of-week and time-of-day (e.g. focus music on weekday mornings, something calmer in the evening). Music auto-plays on schedule, ducks under Marvis's speech, and has its own volume slider plus a loudness leveler so tracks mastered at different volumes don't require manual adjustment per track.

On first launch, the library is seeded with seven royalty-free sample tracks (in a "Sample Tracks" playlist, not assigned to any schedule slot) so the feature has something to play immediately - see [Sample Music Attribution](data/music/ATTRIBUTION.md) for credits. Delete them anytime; they're only seeded once, on the very first run.

在 Settings -> Music 中，你可以导入自己的音乐、建立播放列表，并按星期和时段设置播放排程（例如工作日上午播放专注音乐，晚上播放更舒缓的内容）。音乐会按排程自动播放，在 Marvis 讲话时自动压低音量，并带有独立音量滑杆和响度平衡，避免不同音量母带的歌曲需要逐首手动调整。

首次启动时，音乐库会预载七首免版税示例音乐（位于 “Sample Tracks” 播放列表中，不会自动分配到任何排程时段），让这个功能一开始就可以播放内容。署名信息请见 [Sample Music Attribution](data/music/ATTRIBUTION.md)。你可以随时删除它们；这些内容只会在第一次运行时初始化一次。

## HTML Panel Management

Store and quickly access HTML dashboards, reports, and visualizations:

### Search and Open Panels

Use natural language commands to find and display HTML files from the `data/html-panels` folder:

- `open <keyword>`, `show <keyword>`, or `/open <keyword>` - search for HTML panels by keyword (case-insensitive)
- Examples:
  - `open financial` -> finds and opens "Q2 financial report.html"
  - `open dashboard` -> finds and opens the matching dashboard file
  - `open Q2` -> searches for files containing "Q2"

### HTML Follow-up Routing

When Claude generates an HTML report, you can ask follow-up questions about it in plain chat — no need to re-run the CLI. Marvis detects that your question relates to the displayed content and routes it back to Claude in quiet mode: the HTML panel stays visible, the CLI activity panel stays hidden, and Claude reads the file and answers directly in chat.

If your next message is unrelated to the displayed report, Marvis closes the HTML panel and starts fresh.

Example flow:
```
/claude 找乐子新闻          → Claude runs, HTML report appears on the right panel
哪个新闻最出彩？            → Gemini detects follow-up → Claude reads HTML, answers in chat, panel stays
get me news on SpaceX      → Gemini detects unrelated → HTML panel closes, new Claude task starts
```

当 Claude 生成 HTML 报告后，你可以直接在聊天中追问，无需重新运行 CLI。Marvis 会检测到你的问题与当前显示的内容相关，并以静默模式将其路由回 Claude：HTML 面板保持可见，CLI 活动面板保持隐藏，Claude 读取文件后直接在聊天中回答。

如果下一条消息与当前显示的报告无关，Marvis 会关闭 HTML 面板并重新开始。

### Search Priority

Results are ranked by matching quality:

1. **Exact matches** (filename exactly equals keyword)
2. **Substring matches** (keyword found within filename)
3. **Fuzzy matches** (similar filenames using Levenshtein distance)

### Safe Display

HTML files are rendered in a **sandboxed iframe** to prevent CSS and script conflicts:

- CSS stays isolated inside the panel
- Main UI remains clean and unaffected
- Third-party HTML can't break the interface
- JavaScript is allowed but restricted from accessing the main page

用于存放并快速打开 HTML 仪表板、报告和可视化内容：

### 搜索与打开 Panels

可使用自然语言命令在 `data/html-panels` 文件夹中查找并显示 HTML 文件：

- `open <keyword>`、`show <keyword>` 或 `/open <keyword>` - 按关键词搜索 HTML panel（不区分大小写）
- 示例：
  - `open financial` -> 查找并打开 "Q2 financial report.html"
  - `open dashboard` -> 查找并打开匹配的 dashboard 文件
  - `open Q2` -> 搜索文件名中包含 "Q2" 的文件

### HTML 报告追问路由

当 Claude 生成 HTML 报告后，你可以直接在聊天中追问，无需重新运行 CLI。Marvis 会检测到你的问题与当前显示的内容相关，并以静默模式将其路由回 Claude：HTML 面板保持可见，CLI 活动面板保持隐藏，Claude 读取文件后直接在聊天中回答。

如果下一条消息与当前显示的报告无关，Marvis 会关闭 HTML 面板并重新开始。

示例流程：
```
/claude 找乐子新闻          → Claude 运行，右侧面板显示 HTML 报告
哪个新闻最出彩？            → Gemini 检测到追问 → Claude 读取 HTML，在聊天中回答，面板保持
get me news on SpaceX      → Gemini 检测到无关内容 → HTML 面板关闭，新 Claude 任务开始
```

### 搜索优先级

搜索结果会按照匹配质量排序：

1. **精确匹配**（文件名与关键词完全一致）
2. **子串匹配**（文件名中包含该关键词）
3. **模糊匹配**（使用 Levenshtein distance 查找相近文件名）

### 安全显示

HTML 文件会在 **sandboxed iframe** 中渲染，以避免 CSS 和脚本冲突：

- CSS 会被隔离在 panel 内部
- 主界面保持整洁，不受影响
- 第三方 HTML 不会破坏界面
- 允许 JavaScript 运行，但会限制其访问主页面

## CLI delegation channels

Marvis isn't limited to its own chat replies — it can hand a task off to the Claude Code or Codex CLI running against your active project. Set an active project folder in Settings first, then type:

- `/code <task>` or `/claude <task>` - delegates to the `claude` CLI (must be installed and logged in).
- `/codex <task>` - delegates to the `codex` CLI (must be installed and logged in).

For plain messages (no `/` prefix), Gemini decides the route automatically:
- **marvis** — answered directly in chat.
- **claudeCode** — delegated to the `claude` CLI; used for project work, code generation, and HTML report follow-ups.
- **codex** — delegated to the `codex` CLI; used for Codex-specific tasks.

Marvis tracks the active session across turns so follow-up messages carry context. The session closes when you switch topics or Gemini determines the conversation has moved on.

Marvis 不只会自己回复聊天，它也可以把任务转交给正在当前项目目录中运行的 Claude Code 或 Codex CLI。先在 Settings 中设置 active project folder，然后输入：

- `/code <task>` 或 `/claude <task>` - 把任务委派给 `claude` CLI（必须已安装并登录）。
- `/codex <task>` - 把任务委派给 `codex` CLI（必须已安装并登录）。

对于普通消息（不带 `/` 前缀），Gemini 会自动决定路由方式：
- **marvis** — 直接在聊天中回答。
- **claudeCode** — 委派给 `claude` CLI；用于项目工作、代码生成及 HTML 报告追问。
- **codex** — 委派给 `codex` CLI；用于 Codex 专属任务。

Marvis 会在多轮对话中跟踪当前 session，使追问消息携带上下文。当你切换话题或 Gemini 判断对话已结束时，session 会自动关闭。

## Briefing data (Weather, News, Email)

The status board and spoken greeting (Weather, Unread/Urgent Emails, News Briefing) are filled from `data/marvis-status.json` (dev) or the equivalent packaged-build location, but Marvis does **not** refresh that file on its own - it just reads whatever's there. Keeping it current is up to whatever process writes that file (manually, a script, or your own automation); without a periodic refresh the briefing will show stale data indefinitely.

状态看板和语音问候（Weather、Unread/Urgent Emails、News Briefing）都来自 `data/marvis-status.json`（开发环境）或打包版本中的对应位置，但 Marvis **不会** 自己刷新这个文件，它只会读取其中现有的内容。要保持内容最新，需要依赖写入该文件的流程来更新它（手动、脚本或你自己的自动化）；如果没有定期刷新，简报内容就会一直停留在旧数据。
