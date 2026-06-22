---
name: agentic-jarvis-brief
description: Gather fresh data and fill in (or refresh) a Jarvis-style status JSON brief — current viral global news, unread Gmail, urgent unread Gmail, live local weather, and a user-profile-aware spoken avatar briefing. Use this whenever the user asks to "update jarvis-status.json", "refresh the briefing/status board", "regenerate the morning briefing", "fill in the dashboard JSON", or similar — including when they just say something like "update my status file" or "run the briefing" without naming the skill explicitly. Also use it for any one-off request to compose a personalized news + email + weather summary for a dashboard or voice briefing, even if no JSON file is mentioned yet.
---

# Agentic Jarvis Brief

## Overview

Build a current status JSON for Jarvis-style dashboards or routine briefings: read the target JSON first, preserve its shape, then gather fresh news, Gmail unread email, urgent unread email, and weather before writing the filled JSON back out.

In this project the target file is [data/jarvis-status.json](../../../data/jarvis-status.json) when running from source (`npm start`), read by [src/main/status/statusFile.js](../../../src/main/status/statusFile.js) and rendered by [src/renderer/statusPanel.js](../../../src/renderer/statusPanel.js). A **packaged build** (the distributed `.exe`/AppImage/etc.) reads from a different, OS-specific location instead — see "Locating jarvis-status.json automatically" below; auto-detection only applies when no path/schema was given by the user. If the user names a different path, or pastes a schema/sample inline, use that instead — the row *shape* matters more than the specific file.

When the JSON contains a `User Profile` entry (or a similarly named profile/background/preferences field), use it to personalize the News Briefing selection and wording. Prefer topics matching the user's stated interests, work, goals, and background, while still keeping one or two major global developments when they materially matter — a personalized briefing that ignores the world isn't useful either.

## Required First Step

Read the target JSON path with the Read tool and preserve its existing field names, nesting, and data types — this skill fills in an existing shape, it does not invent a new one. If neither a path nor a format has been given, ask for one before collecting any data; gathering news/email/weather first and only then discovering the target shape wastes the work.

Accept any of these as the format source:
- An existing JSON file path to read and preserve (most common in this project: `data/jarvis-status.json`, but see auto-detection below — a packaged install uses a different path)
- A pasted JSON schema or sample object
- A short description of required fields

If no path is given but a format is, ask whether to return JSON in the reply or write it to a new file. If there is no schema at all, fall back to [references/default-status-format.json](references/default-status-format.json), which mirrors this project's card layout (`type` / `value` / `detail`).

## Locating jarvis-status.json automatically (this project)

Only run this when the user hasn't already given an explicit path or pasted a schema. The app's data file lives in different places depending on how it's running, and the wrong guess means updating a file the running app never reads:

- **Dev/source checkout** (`npm start` from this repo): `data/jarvis-status.json`, relative to the project root.
- **Packaged build, Windows**: `%APPDATA%\agentic-jarvis\jarvis-status.json` (Electron's per-user `userData` dir, keyed off `package.json`'s `"name"` field — `agentic-jarvis`, NOT the `Jarvis` product/display name).
- **Packaged build, Linux**: `~/.config/agentic-jarvis/jarvis-status.json` (Electron's XDG-standard `userData` dir on Linux; same `agentic-jarvis` app-name key).
- **Packaged build, macOS** (not yet shipped per the README, but check anyway in case a user builds it themselves): `~/Library/Application Support/agentic-jarvis/jarvis-status.json`.

Check all four candidates in one shell call rather than guessing — this works unmodified on both Windows (Git Bash) and Linux (`$APPDATA` is simply unset/empty on Linux, so that line harmlessly evaluates to false instead of erroring):

```bash
for p in \
  "data/jarvis-status.json" \
  "$APPDATA/agentic-jarvis/jarvis-status.json" \
  "$HOME/.config/agentic-jarvis/jarvis-status.json" \
  "$HOME/Library/Application Support/agentic-jarvis/jarvis-status.json"; do
  [ -f "$p" ] && echo "FOUND: $p"
done
```

Then:
- **Exactly one candidate found** — use it, no need to ask.
- **Multiple candidates found** (e.g. both a dev checkout and a packaged install exist on the same machine) — ask the user which one to update, or whether to update all of them; don't silently pick one, since updating the wrong file means the briefing the user actually sees never changes.
- **None found** — this is a genuinely fresh setup. Fall back to the dev-mode default (`data/jarvis-status.json`) and create it there, matching this skill's existing default behavior.

## Personalization Rules

Look for profile context before gathering data. Common field names: `User Profile`, `profile`, `background`, `interests`, `preferences`, `goals`, `about_user`.

If a profile field exists:
- Extract the user's likely interests, domain focus, and what kinds of stories will actually matter to them.
- Re-rank news so the most relevant items appear first, while keeping at least one globally important item when warranted.
- Tailor each `detail[i]` so it explains why that story matters to this user, not just why it matters in general.
- Prefer practical implications, opportunities, risks, and decisions the user may care about.

If no profile field exists, use broadly important global news and keep News Briefing wording neutral. Do not invent interests — if the profile is sparse, make only conservative inferences from explicit text.

## Data Gathering Workflow

1. **Inspect format and profile.** Read the target JSON first. Detect whether it includes a user-profile-style field and note the geolocation if one is present (in this project it lives in the `User Profile` row's `detail`, e.g. `Geolocation: Bayan Lepas`).
2. **News.** Use WebSearch (and WebFetch for promising article pages) for current, high-impact global stories first, then add trends aligned to the user's profile. Cover finance, technology, politics, major business, markets, AI, security, or other widely discussed global events. Re-rank or filter using the profile when available. Do not include email-related content in news. For each selected item, also capture the article's thumbnail/og:image URL and its canonical article URL — these go in the `image`/`link` arrays (see Jarvis Card Format Rules). If a usable image URL can't be found for an item, leave that slot as `""` rather than guessing one.
3. **Gmail.** If a Gmail MCP connector is available in this session (tools such as `search_threads` / `get_thread`), use it to search unread mail and summarize each relevant unread thread, then separately identify urgent unread mail needing immediate attention (see Gmail Triage Rules below). If no Gmail connector is connected, say so plainly in the output instead of fabricating email content.
4. **Weather.** Use a live geocoder plus a shared global current+forecast API, cross-checked against real station observations. Both APIs below are free, require no API key, and work uniformly worldwide (USA, Europe, Asia, anywhere) — there is no need to branch logic by region or let the user pick a region-specific source.
   - Geocode the profile location (e.g. with Photon, `https://photon.komoot.io/api/?q=<location>`) to get lat/lon. Prefer a result near the profile location name.
   - **Forecast (current + next few hours):** query Open-Meteo, which has no key requirement and auto-selects the best available national weather model for the queried location (HRRR/NAM in North America, ICON-D2/ICON-EU in Europe, falls back to ECMWF/GFS/ICON-Global elsewhere, with JMA/KMA/BOM/CMA also integrated for Asia-Pacific) — this is what makes it a single shared source across regions:
     `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,precipitation,weather_code,rain,relative_humidity_2m,cloud_cover&hourly=temperature_2m,precipitation,weather_code,precipitation_probability&forecast_hours=3&timezone=auto`
     Read `current` for the present temperature/condition, and the first 1-3 `hourly` entries for the near-term trend (precipitation amount + `precipitation_probability`).
   - **Ground-truth sanity check (current only):** cross-check against a real station observation via the Aviation Weather Center's global METAR API (works at any ICAO-coded airport worldwide, not just the US, despite the `.gov` domain) — free, no key:
     `https://aviationweather.gov/api/data/metar?bbox=<lat-0.5>,<lon-0.5>,<lat+0.5>,<lon+0.5>&format=json`
     This returns the nearest station(s) within the box without needing to know the ICAO code in advance; pick the closest one. Use `rawOb`/`wxString` to confirm or override Open-Meteo's current read if they materially disagree (e.g. Open-Meteo shows light drizzle but METAR shows none, or vice versa) — METAR is a real ground observation and wins over the model for "is it raining right now."
   - Use current `temperature_2m` plus current/near-term `weather_code` and `precipitation` fields (reconciled against METAR) to decide whether it's sunny, cloudy, or raining, and whether rain is likely to continue.
   - Keep `value` to a short phrase only, e.g. `30.2°C, cloudy` or `29°C with rain showers` — no trailing sentence. The greeting voice line wraps this directly as `it's ${value} out` (see `buildIntroFragments` in [src/renderer/renderer.js](../../../src/renderer/renderer.js)), so a multi-sentence value reads as broken speech ("it's 30.2°C, cloudy. Rain is likely... out").
   - Put the near-term rain outlook and location name in `detail` instead (e.g. `Bayan Lepas. Rain is likely to continue over the next couple of hours.`), not in `value`.
   - If the Open-Meteo request fails, retry once with the same geocoded coordinates — a single transient failure shouldn't make the weather card go blank. If METAR has no nearby station (e.g. far from any airport), fall back to Open-Meteo alone rather than blocking on it.
   - Only if Open-Meteo fails after a retry and no METAR station is available either, record the limitation instead of fabricating weather.
5. **Fill JSON.** Map gathered data into the requested format. Preserve existing keys, add ISO 8601 timestamps if the format allows them, and use empty strings/arrays rather than inventing facts for unavailable sections.
6. **Write or return.** If a writable path was given, write the updated JSON with the Write or Edit tool (matching the original array/object shape exactly). If not, return the JSON in the reply.

## Jarvis Card Format Rules

When the target JSON is an array of cards with `type`, `value`, and `detail` fields (the shape used in this project — see the live example at [data/jarvis-status.json](../../../data/jarvis-status.json)):

- Put the user-facing content in `value`.
- Keep `detail` as an empty string unless the existing format clearly requires otherwise.
- For `Unread Emails`, put the unread count in `value` (e.g. `"15 unread messages"` or `"15"`) and put the unread summary/thread titles in `detail`. The greeting voice line never reads this field aloud — `buildIntroFragments` in [src/renderer/renderer.js](../../../src/renderer/renderer.js) intentionally skips Unread/Urgent Emails so the spoken intro only covers weather — so this only needs to read well as a status card, not as speech.
- For `Urgent Emails`, same rule: put the urgent count in `value` (e.g. `"2 urgent items"` or `"2"`) — also never spoken aloud. Put the urgent-email summary or subject lines in `detail`.
- Omit a separate `Email Content` row if the existing format allows it — `Urgent Emails` already carries that content, and a duplicate empty card is a known bug to avoid (see [src/renderer/statusPanel.js](../../../src/renderer/statusPanel.js), which falls back to `Urgent Emails`' detail when `Email Content` is empty).
- `News Briefing` uses **parallel arrays**, not a single bullet string: `value` is a list of short headlines (one per news item, e.g. `"Global Geopolitics"`), and `detail` is a same-length list of the corresponding full write-ups, in the same order. The renderer shows `value[i]` on the avatar one at a time (replacing the previous headline) while `detail[i]` stacks into the Latest News panel, so the two arrays must line up index-for-index. Two more parallel arrays carry per-item media: `image` (a thumbnail/og:image URL) and `link` (the article URL) — same index alignment, same length, use `""` for an item with no usable image or link. Both must be plain `http://`/`https://` URLs; the renderer ([src/renderer/statusPanel.js](../../../src/renderer/statusPanel.js)) drops anything else (e.g. `javascript:` or malformed values) rather than rendering it. The thumbnail renders to the left of each Latest News entry and the link renders below it as a plain "details" link (never the raw URL). For example:

  ```json
  {
    "type": "News Briefing",
    "value": ["Global Geopolitics", "Humanoid Robotics Milestone"],
    "detail": [
      "The Ukraine-Russia war and US-Iran tensions remain elevated: Ukraine launched one of its largest strikes on Moscow since the invasion began...",
      "Figure AI's BotQ factory is now building Figure 03 units at a rate of one robot per hour, and Boston Dynamics' electric Atlas has begun shipping..."
    ],
    "image": ["https://example.com/thumb1.jpg", ""],
    "link": ["https://example.com/article1", "https://example.com/article2"]
  }
  ```

- Keep `Avatar Briefing`'s `value` and `detail` **empty** (`""`) — the News Briefing headline/detail pairs now drive what's shown and spoken, so a separate avatar-briefing summary is redundant. Leave the row in the JSON (don't delete it) so older renderers/tooling that still expect the field don't break.
- Do not add generic framing such as "today's briefing", "for a robotics-focused user", "for this user", or similar profile-explainer phrases — keep relevance implicit in the content itself.

## News Selection

Each news item becomes one `value[i]`/`detail[i]` pair (see the News Briefing format above) — `value[i]` is read aloud and shown on the avatar one item at a time, and `detail[i]` is what stacks into the Latest News panel and gets spoken in full, so both need to read naturally out loud as well as on screen.

For news:
- Aim for roughly **5-15 items**, scaled to how much is actually worth telling — a quiet news day might only have 5 stories worth a slot, a busy one (major global event plus a wave of profile-relevant developments) can justify the full 15. Don't pad with marginal items just to hit a number, and don't trim genuinely high-signal items just to keep the list short. The renderer ([src/renderer/statusPanel.js](../../../src/renderer/statusPanel.js)) caps `News Briefing` at 15 and, if given more than that, keeps only the **last** 15 entries (newest replaces oldest), silently dropping anything earlier in the array. Don't rely on that truncation; just keep the list to 15 or fewer. Playback plays through the list once in order and stops — it does not loop or repeat.
- Order: global news first, then trends matching the user's profile interests.
- Keep selected items current and high-signal — every item should clear the bar of "this is worth this user's attention," not just "this technically relates to their interests."
- `value[i]`: a short topic/headline label (2-5 words, e.g. `"Global Geopolitics"`, `"Humanoid Robotics Milestone"`) — this is what flashes on the avatar, so keep it terse and scannable, not a full sentence.
- `detail[i]`: a single self-contained sentence or two with the full story — what changed, why it matters, source. This is what's spoken and what stacks in the Latest News panel.
- Base each item only on the selected news content, never on Gmail content or email-derived wording.
- When a profile exists, emphasize the parts most relevant to that user's interests or work, but don't say so explicitly.
- Avoid simply repeating the headline verbatim inside its own detail.
- Never include email content, email counts, account alerts, Gmail action items, or permission-change wording from messages in News Briefing.
- Don't open any detail with "today's briefing" or similar intro labels.
- Write for text-to-speech: short sentences, plain words, no dense lists, no citations spoken aloud (URLs/source names can still live in the JSON for display, just keep the spoken sentence itself clean).

Good detail pattern per item: what changed → why it matters → what needs attention now.

## Gmail Triage Rules

Treat unread email as urgent when it has one or more signals:
- Sender is a known client, partner, billing provider, platform/security service, bank, or domain authority.
- Subject/body includes urgent language: "urgent", "action required", "deadline", "overdue", "security alert", "failed payment", "verify", "incident", "blocked", "suspended", "final notice", "expires today".
- The message requests a reply, approval, payment, account recovery, calendar action, legal/admin action, or operational fix.
- The message is recent and tied to an active project, invoice, account access, delivery failure, or service outage.

Do not mark newsletters, promos, social notifications, routine digests, or low-value marketing mail as urgent unless they contain a concrete immediate action.

## Output Guidelines

Prefer concise, dashboard-ready summaries:
- News items: title/topic, short summary, why it matters, source, URL, published time if available.
- Unread email items: keep only the bare unread count (no trailing words) in `value`; put thread titles or a short summary in `detail`.
- Urgent email items: keep only the bare urgent count (no trailing words) in `value`; put urgent email titles or a short action note in `detail`.
- Weather: temperature plus a short condition label only in `value` (no second sentence); location and near-term rain outlook go in `detail`. Source is Open-Meteo (current + 3h hourly) cross-checked against METAR ground observations. Don't fall back to "unavailable" just because one request failed — retry the Open-Meteo fetch once first. Only use the generic unavailable sentence if Open-Meteo genuinely returns no usable data after retrying with valid geocoded coordinates and no METAR station is found nearby either.
- Avatar Briefing: leave `value` and `detail` empty — News Briefing's `detail[i]` entries now carry the spoken content.

When a connector or web access is unavailable, record the limitation clearly in the JSON (if the format has a place for it) and mention it briefly to the user rather than silently producing thinner output.

## Format Reference

For a generic fallback structure when the user has no schema of their own, use [references/default-status-format.json](references/default-status-format.json).
