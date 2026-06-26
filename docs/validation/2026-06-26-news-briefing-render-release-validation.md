# Marvis News Briefing Render and Release Validation

- Date: 2026-06-26
- Scope: news briefing layout hardening, missing-thumbnail fallback, first-run fallback briefing voice behavior, and spec/validator alignment updates

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Renderer syntax | Pass | `renderer.js`, `statusPanel.js`, and `ttsController.js` parse successfully. |
| Automated tests | Pass | `npm test` passed, 2/2 tests. |
| News text cleanup | Pass | Renderer now strips inline URLs from rendered/spoken news text and prefers `link[]` for source URLs. |
| Missing thumbnail handling | Pass | News cards now render a stable placeholder when `image[]` is empty. |
| First-run fallback briefing voice | Pass | If status rows are empty, Marvis now still shows Continue and can speak a fallback stage-2 line instead of going silent. |
| App spec alignment | Pass | Spec now explicitly covers URL-free `detail[]`, stable placeholder behavior, and first-run fallback voice. |
| Validator alignment | Pass | Checklist now validates those same failure modes. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| News cards accept parallel arrays | Pass | Existing array-based contract is preserved. |
| `detail[]` remains readable | Pass | Raw `http(s)` URLs are stripped from rendered and spoken detail text. |
| `link[]` remains source of truth for article URLs | Pass | Renderer infers links if embedded URLs exist, but display/speech uses cleaned text. |
| Missing thumbnails keep layout stable | Pass | Placeholder block renders when `image[]` is empty. |
| First-run empty status does not create silent stage-2 flow | Pass | Fallback briefing branch added when no status row has content yet. |
| TTS still uses existing path | Pass | No changes to provider routing; only fallback briefing selection and cleanup behavior changed. |

## Commands Run

```powershell
node --check src\renderer\renderer.js
node --check src\renderer\statusPanel.js
node --check src\renderer\voice\ttsController.js
npm test
```

## Residual Risks

- The generator can still write empty `image[]` values; the app now degrades cleanly, but real thumbnails still depend on the briefing-generation workflow finding usable image URLs.
- Existing status JSON files with mojibake-like terminal display still warrant a follow-up encoding audit if the issue reproduces inside the app itself rather than only in shell output.
