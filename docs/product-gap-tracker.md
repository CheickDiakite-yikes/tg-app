# StoryBridge Product Gap Tracker

Last updated: 2026-06-27

## Scope

This tracker converts the product-gap audit into implementation work. The current pass targets the eight highest-priority gaps identified from the live app at `http://localhost:3000/`.

## Implementation Checklist

| Gap | Status | Implementation Notes |
| --- | --- | --- |
| 1. Show Time is not a real mode | Complete | `Carousel` now has a distinct presenter mode with play/pause, full-screen entry, calmer chrome, captions support, and video-aware playback. |
| 2. Agent draft state is not decisive enough | Complete | `CreateModal` now renders an inferred-plan card with one primary create action and filtered natural refinement chips. |
| 3. Teacher-critical metadata is hidden | Complete | `Carousel` now includes a Teacher Guide with objective, audience, duration, sensory notes, teacher notes, interaction cues, sensory goals, and safety notes. |
| 4. Media generation lacks progress/retry/recovery | Complete | `App` now tracks queued/generating/polling/ready/error states per slide and exposes retry actions in the player and activity panel. |
| 5. Library/profile is not a teacher workspace | Complete | Profile now includes search, media filters, open state, ready counts, duplicate, copy summary, export, and delete actions. |
| 6. Video generation is not productized | Complete | Video jobs now show queued/polling status, retryable errors, generated video controls, and default Show Time opening for video lessons. |
| 7. Accessibility and sensory controls are too thin | Complete | Added Comfort controls for captions, larger transcript text, calmer motion, TTS rate, and Show Time auto-advance. |
| 8. Error states are too raw | Complete | Agent and media errors now map to friendly retryable messages that preserve the teacher prompt or failed slide. |

## Verification Targets

- `npm run lint` - passed.
- `npm run build` - passed.
- Browser smoke: app loads, no framework overlay, no relevant console errors.
- Browser interaction: Show Time changes the player, Teacher Guide opens, Comfort controls update UI, Library actions are visible.
- Mobile viewport: 320x568 slideshow and 375x667 Show Time fit in one frame without extra page scroll.
- Desktop/default viewport: central player and library/profile state remain readable without blocked controls.

## Systematic Hardening Pass

Date: 2026-06-27

- Added a seeded revision path so a saved slideshow can reopen the StoryBridge Agent with context instead of forcing teachers to start over.
- Added non-destructive delete confirmation and toast-style feedback for library actions.
- Tightened activity job labels so generation status keeps the original slide number.
- Rechecked Browser evidence at 320x568 and 375x667. Screenshots are in `/tmp/storybridge-systematic`, with the final small-phone no-overlap proof at `07-main-iphone-se-no-fab-overlap-320x568.png`.
