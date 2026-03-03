Original prompt: хочу и 1 и 2

- 2026-03-03: Starting second iteration of the React simulator.
- Goal: add a real world-map scene plus a proper turn-based game loop with resources, world events, and win/lose states.
- Testing requirements for this pass: expose `window.render_game_to_text`, expose `window.advanceTime(ms)`, and validate the app in a browser after implementation.
- TODO: replace the current dashboard shell with a playable campaign structure and verify interactions end-to-end.
- 2026-03-03: Replaced the dashboard shell with a turn-based campaign loop, SVG world map, timed world phase, resource model, region statuses, and win/lose logic.
- 2026-03-03: Added deterministic state hooks: `window.render_game_to_text` and `window.advanceTime(ms)`.
- 2026-03-03: Fixed browser console noise by adding `favicon.svg`.
- 2026-03-03: Browser validation completed on the local app in Chrome and via the automated browser session:
  - Start campaign unlocks decisions and starts the threat clock.
  - Region selection updates the selected theater panel.
  - Decision actions spend resources and insert feed events.
  - End turn resolves a world event and resets operations for the next turn.
  - Accessibility snapshot and screenshot captured in `output/web-game/` during validation.
- Note: the skill-specific Playwright client still needed a browser download (`npx playwright install chromium`), which was not approved, so validation used the available browser tooling instead.
- Next TODO: add richer event branching and an explicit campaign summary modal on win/loss.
