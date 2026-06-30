# Marvis Release Validator

This checklist captures the local QA expectations for Marvis builds before packaging or release upload.

## Wake Word Validation

Validate wake-word behavior with ElevenLabs STT configured.

- Turn on wake words in Settings and save.
- Confirm passive wake listening only runs when `wakeWordEnabled` is true.
- Say `Marvis` naturally and verify the wake STT notice shows a plausible full-word or near-name transcript, not a clipped tail like `itch`.
- Confirm passive wake listening waits for speech start and ends after user silence, not on a short fixed recording cutoff.
- Confirm a wake hit accepts common substitutions such as `mavis`, `maurice`, or `marcus`.
- Confirm Marvis speaks a short acknowledgement after a wake hit.
- Confirm the command mic opens automatically after the acknowledgement.
- Confirm the command mic auto-stops about 1 second after the user stops speaking.
- Confirm wake-word STT failures surface a visible UI message.

## Wake Word Training Validation

- Open Settings > Wake Word Training.
- Run all 3 trials and verify each trial waits for real speech before capturing.
- Verify the saved learned words reflect the STT outputs from the user voice trials.
- Change the bot name to another wake word such as `Jarvis`, `Cortana`, or `Mike` and verify the training prompt uses that exact configured name.
- Verify learned patterns only participate when they were trained for the current bot name.
- Verify `Clear Learned Words` removes the learned list from the panel.
- Verify saving Settings persists learned wake-word patterns.
- Verify clearing learned words and then saving Settings persists the cleared state.

## Packaging Gate

Run these before packaging:

```powershell
node --check src\main\main.js
node --check src\main\ipcHandlers.js
node --check src\renderer\renderer.js
node --check src\renderer\preload.js
npm test
```
