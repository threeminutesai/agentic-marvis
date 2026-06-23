---
name: agentic-jarvis-brief
description: Gather and write an agentic Jarvis routine status JSON brief. Use when Codex needs to fill or update a jarvis-status.json file, daily or morning dashboard payload, or personal briefing JSON with current viral global news, a user-profile-aware avatar briefing, unread Gmail, urgent unread Gmail for threeminutesai@gmail.com, and the latest local weather. Personalize news selection and the avatar briefing using any existing `User Profile` or similar profile field in the provided JSON format.
---

# Agentic Jarvis Brief

## Overview

Build a current status JSON for Jarvis-style dashboards or routine briefings. Read the target JSON first, preserve its shape, then gather fresh news, Gmail unread email, urgent unread email, and weather before writing the filled JSON.

When the format contains a `User Profile` entry, or a similarly named profile/background/preferences field, use it to personalize both the news selection and the avatar briefing. Prefer topics that match the user's stated interests, work, goals, and background while still keeping one or two major global developments when they materially matter.

## Required First Step

The target path is always a `data/` folder, resolved by `src/main/ipcHandlers.js` (`getDataDir()`):

- **Running from source (dev)**: `data/jarvis-status.json` in the project root — read by `src/main/status/statusFile.js`, rendered by `src/renderer/statusPanel.js`.
- **Running the packaged exe**: the project's `data/` folder is inside the read-only `app.asar` archive and is NOT used. The portable exe instead reads/writes a `data/jarvis-status.json` folder placed next to the exe itself (e.g. `D:\Jarvis\data\jarvis-status.json` if the exe is at `D:\Jarvis\Jarvis.exe`) - not Electron's `userData` directory. `settings.json` and `html-panels/_template.html` live in that same `data/` folder, alongside `jarvis-status.json`, in both dev and the packaged exe - the app auto-creates all three with sane defaults on first launch (or regenerates any one of them if later found missing/empty), so dev and a packaged exe share the exact same layout.

Ask the user (or check) whether they're running from source or the packaged exe before guessing the path — writing to the project's `data/jarvis-status.json` while a packaged exe elsewhere is running has no effect, since that app reads its own `data/` folder next to its exe. If unsure, ask where the exe is installed, or check both locations and prefer whichever one already exists.

Read the target JSON path and preserve its existing field names, nesting, and data types. If no path or format can be determined at all (e.g. neither default file exists and the user names no alternative), ask before collecting data.

Accept any of these as the format source:
- An existing JSON file path to read and preserve (default: `data/jarvis-status.json` relative to the project root for dev, or relative to the exe's own folder for a packaged install)
- A pasted JSON schema or sample object
- A short description of required fields

If the user provides a format without a path, ask whether to return JSON in the reply or create a file.

## Personalization Rules

Look for profile context before gathering data. Common examples include `User Profile`, `profile`, `background`, `interests`, `preferences`, `goals`, or `about_user`.

If a profile field exists:
- Extract the user's likely interests, domain focus, and what kinds of stories will actually matter to them.
- Re-rank news so the most relevant items appear first, while keeping at least one globally important item when warranted.
- Tailor wording so the avatar briefing explains why the selected stories matter to this user, not just why they matter in general.
- Prefer practical implications, opportunities, risks, and decisions the user may care about.

If no profile field exists:
- Use broadly important global news and write a neutral avatar briefing.

Do not invent interests. If the profile is sparse, make only conservative inferences from explicit text.

## Data Gathering Workflow

1. Inspect format and profile: Read the target JSON first. Detect whether it includes a user-profile-style field and preserve its structure.
2. News: Browse the web for current, viral, high-impact global stories first, then add current trends aligned to the user's profile. Include finance, technology, politics, major business, markets, AI, security, or other widely discussed global events. Re-rank or filter those stories using the user's profile when available. Do not include email-related content in news. Include source URLs in the JSON if the format allows.
3. Gmail: Use the Gmail connector for `threeminutesai@gmail.com`. Search unread mail and summarize each relevant unread thread. Separately identify urgent unread mail that appears to need immediate attention.
4. Weather: Use a live geocoder plus met.no in two steps.
   - First geocode the profile location with Photon or another live no-key geocoder if Open-Meteo geocoding is unavailable. Prefer a result near the profile location name.
   - Then query `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=...&lon=...` with a unique `User-Agent` header. met.no returns `403` if the header is missing or too generic.
   - Read the current forecast and the next 1 to 3 hourly entries. Use current `air_temperature` plus the current and near-term `symbol_code` or precipitation fields to decide whether it is `sunny`, `cloudy`, or `raining`, and whether rain is likely to continue over the next couple of hours.
   - Keep the weather card compact: put a single readable sentence in `value` such as `30.2C, cloudy. Rain is likely over the next couple of hours.`
   - Use `detail` only for a short supporting note when helpful, such as the location or the near-term rain trend.
   - Source origin for the live weather flow: Photon for geocoding, then met.no Locationforecast for the forecast.
   - If the forecast request fails, retry once with the same geocoded coordinates and a clearly unique `User-Agent`.
   - Only if both attempts fail, record the limitation instead of fabricating weather.
5. Fill JSON: Map gathered data into the requested format. Preserve existing keys, add timestamps in ISO 8601 if the format allows, and use empty arrays or `null` for unavailable sections rather than inventing facts.
6. Write or return: If a writable path was provided, update that file. If not, return the JSON in the response.

## Jarvis Card Format Rules

When the target JSON is an array of cards with `type`, `value`, and `detail` fields:
- Put the user-facing content in `value`.
- Keep `detail` as an empty string unless the existing format clearly requires otherwise.
- Use bullet point text in `value` for `News Briefing`.
- For `Unread Emails`, put only the unread count in `value` and the unread summary in `detail`.
- For `Urgent Emails`, put only the urgent count in `value` and the urgent-email summary or titles in `detail`.
- Remove `Email Content` from the output if the existing format allows it.
- Keep `Avatar Briefing` as natural spoken prose in `value`, not bullets.
- Keep `Avatar Briefing.detail` empty.
- Do not add generic framing such as `today's briefing`, `for a robotics-focused user`, `for this user`, or similar profile-explainer phrases.

## News Selection and Avatar Briefing

Treat the avatar briefing as a synthesis of the chosen news content, not as a generic headline string.

For news:
- Prefer three to five items unless the requested format clearly wants more or fewer.
- Order news as: global news first, then latest trends based on the user's profile interests.
- Keep the selected items current and high-signal.
- Format dashboard news briefing content as concise bullet points when the schema allows free text. Each bullet should state what needs attention and why it matters.

For the avatar briefing:
- Base it only on the selected news items, not on Gmail content or email-derived wording.
- Summarize the news as 3-4 short, separate sentences, with one sentence per major story when possible.
- Keep it short, spoken-style, and high signal.
- Explain what changed and why it matters right now.
- When a profile exists, emphasize the parts most relevant to that user's interests or work.
- Avoid simply repeating headlines verbatim.
- Do not include email content, email counts, account alerts, Gmail action items, or permission-change wording from messages.
- Do not start with `today's briefing` or any similar intro label.
- Do not say phrases like `For a robotics-focused user`; make the relevance implicit and useful.
- Write for text-to-speech: short sentences, plain words, no dense lists, and no citations in the spoken line.

Good avatar briefing pattern:
- What changed.
- Why it matters.
- What needs attention now.

## Gmail Triage Rules

Treat unread email as urgent when it has one or more signals:
- Sender is a known client, partner, billing provider, platform/security service, bank, or domain authority.
- Subject/body includes urgent language such as `urgent`, `action required`, `deadline`, `overdue`, `security alert`, `failed payment`, `verify`, `incident`, `blocked`, `suspended`, `final notice`, or `expires today`.
- The message requests a reply, approval, payment, account recovery, calendar action, legal/admin action, or operational fix.
- The message is recent and tied to an active project, invoice, account access, delivery failure, or service outage.

Do not mark newsletters, promos, social notifications, routine digests, or low-value marketing mail as urgent unless they contain a concrete immediate action.

## Output Guidelines

Prefer concise summaries suitable for a dashboard:
- News items: bullet point content with title/topic, short summary, why it matters, source, URL, published time if available.
- Unread email items: keep only the unread count in `value` and put thread titles or a short summary in `detail`.
- Urgent email items: keep only the urgent count in `value` and put urgent email titles or a short action note in `detail`.
- Weather: location, temperature, and a simple condition label with a short near-term rain outlook when available.
- Weather: write a readable one-line summary in `value` when data is available; if not, use a short fallback like `Weather unavailable` and put the reason in `detail`.
- Do not use the unavailable fallback just because one request failed. Retry the forecast fetch once before falling back.
- Weather should never be a generic unavailable sentence unless the API truly returns no usable data after retrying with valid geocoded coordinates and headers.
- Avatar briefing: a short voice-friendly briefing derived only from the news content, personalized when useful, with all spoken content in `value` and empty `detail` for card formats.

When a connector or web access is unavailable, clearly record the limitation in the JSON if the format has an errors/status field, and mention it briefly to the user.

## Format Reference

For a generic fallback structure when the user has no schema, use `references/default-status-format.json`.
