# StoryBridge

StoryBridge is a web app for K-12 teachers who support autistic learners. It helps teachers describe a classroom need in plain language, then turns that conversation into calm, visual-first lessons that can be used as a slide show or as short Show Time video moments.

The product goal is simple: a teacher should be able to say something like "make a lesson about washing hands for first grade" or "create a teen-friendly lesson about asking for a break during group work" and receive an age-appropriate, sensory-friendly visual lesson without becoming a prompt engineer.

## What It Does Today

- Natural lesson creation chat with a StoryBridge agent.
- Structured lesson planning for titles, objectives, slides, narration, teacher notes, interaction cues, and sensory goals.
- AI image generation for full-slide images where the slide text is generated inside the artwork.
- AI video generation for Show Time clips using Veo long-running operations.
- Swipe-friendly slide viewing on desktop, iPad, and iPhone-sized screens.
- Saved Teacher Library with search and filters for slide lessons and Show Time lessons.
- Teacher profile/library entry from the top-right avatar.
- Native browser text-to-speech through "Listen again".
- Comfort controls for captions, larger text, calmer motion, autoplay, and TTS speed.
- Local persistence through IndexedDB with localStorage fallback.

## Product Principles

StoryBridge is built for teachers working with autistic children, so the design and AI outputs need to be calm, concrete, and respectful.

- Use neurodiversity-affirming language.
- Support choice, autonomy, sensory awareness, and communication.
- Avoid shame, punishment, forced eye contact, compliance framing, and medical claims.
- Keep slide language short, literal, and age-appropriate.
- Keep visuals uncluttered, predictable, and low-arousal.
- Do not overlay app text on top of generated slide images. The model should render the learner-facing text as part of the generated image or video whenever supported.

## Tech Stack

- React 19
- Vite 6
- TypeScript
- Express
- Tailwind CSS v4
- `motion/react`
- `lucide-react`
- `@google/genai`
- Gemini Interactions API for chat, structured lesson planning, and image generation
- Veo video generation through Gemini long-running video operations

## Repository Map

```text
.
|-- server.ts                         # Express server, Gemini API boundary, Vite middleware
|-- src/
|   |-- App.tsx                       # Main app shell, library state, media orchestration
|   |-- main.tsx                      # React entrypoint
|   |-- types.ts                      # Lesson, slide, media, and comfort setting types
|   |-- index.css                     # Brand tokens, Tailwind, global sensory-friendly styling
|   `-- components/
|       |-- Carousel.tsx              # Slide Show and Show Time player
|       |-- CreateModal.tsx           # Agentic creation chat
|       |-- Icon.tsx                  # StoryBridge brand/icon helpers
|       `-- LoadingSpinner.tsx
|-- docs/
|   `-- product-gap-tracker.md        # Product gap tracker and implementation notes
|-- .env.example                      # Safe environment template
`-- package.json
```

## AI Architecture

All Gemini calls must stay server-side in `server.ts`. The client should never receive or reference `GEMINI_API_KEY`.

### Server Endpoints

| Endpoint | Purpose | Gemini path |
| --- | --- | --- |
| `GET /api/ai-status` | Reports whether Gemini features are configured and which models are selected. | No generation call |
| `POST /api/chat` | Agentic teacher conversation with session memory. | `ai.interactions.create` |
| `POST /api/generate-lesson` | Creates structured lesson JSON. | `ai.interactions.create` |
| `POST /api/generate-image` | Creates a complete slide image. | `ai.interactions.create` with `response_modalities: ["image"]` |
| `POST /api/generate-video` | Starts a Veo video job. | `ai.models.generateVideos` |
| `POST /api/video-status` | Polls a Veo operation. | `ai.operations.getVideosOperation` |
| `GET /api/video-download?op=...` | Streams the completed MP4 to the app. | Fetches the generated video URI with server API key |

### Why Video Uses A Different Path

Text, chat, structured lesson output, and images use the Gemini Interactions API.

Video generation currently uses Veo's long-running operation flow through `ai.models.generateVideos` and `GenerateVideosOperation`. Do not replace this with a synchronous Interactions call unless Google exposes the same Veo operation lifecycle through Interactions and the app is updated to poll that lifecycle.

### Stateful Chat

`/api/chat` stores `previousInteractionId` in an in-memory `Map` by `sessionId`. This lets the StoryBridge agent carry context through a creation conversation.

This is prototype-grade state. If we add accounts or cloud persistence, move session state to durable storage.

## Environment Setup

Create a local `.env` file from the template:

```bash
cp .env.example .env
```

Then set a Gemini API key:

```bash
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

Get a key from Google AI Studio or the Gemini API console. The key must support the selected Gemini and Veo models.

Optional model overrides:

```bash
GEMINI_TEXT_MODEL="gemini-3.5-flash"
GEMINI_IMAGE_MODEL="gemini-3-pro-image"
GEMINI_VIDEO_MODEL="veo-3.1-lite-generate-preview"
```

Important:

- Never commit `.env`.
- `.gitignore` ignores `.env*` and explicitly allows `.env.example`.
- Do not add `VITE_` prefixes to secrets. Anything prefixed with `VITE_` can be exposed to the browser.
- Restart the dev server after changing `.env`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The Express server and Vite dev middleware run from `server.ts`, so API routes and the React app share the same origin.

## Build And Run Production Bundle

Build:

```bash
npm run build
```

Run:

```bash
npm run start
```

The build creates:

- Vite client output in `dist/`
- Bundled server at `dist/server.cjs`

## Validation Commands

Type-check the project:

```bash
npm run lint
```

Build the production bundle:

```bash
npm run build
```

Check AI configuration without triggering generation:

```bash
curl http://localhost:3000/api/ai-status
```

Expected shape:

```json
{
  "geminiConfigured": true,
  "textGenerationReady": true,
  "imageGenerationReady": true,
  "videoGenerationReady": true,
  "textModel": "gemini-3.5-flash",
  "imageModel": "gemini-3-pro-image",
  "videoModel": "veo-3.1-lite-generate-preview"
}
```

If `geminiConfigured` is false, check `.env`, confirm the variable is named `GEMINI_API_KEY`, and restart `npm run dev`.

## Testing Image Generation

Start the dev server, then run:

```bash
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "I wash my hands with soap.",
    "prompt": "A complete StoryBridge slide for young learners showing hands at a classroom sink with soap bubbles, warm watercolor storybook style, calm and uncluttered.",
    "aspectRatio": "16:9"
  }'
```

The response should include an `imageUrl`, usually as a data URL or Gemini-hosted URI depending on the model response.

## Testing Video Generation

Video generation can take a few minutes and may incur provider cost. Use short prompts and avoid repeatedly starting jobs while one is still polling.

Start a video operation:

```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "I wash my hands with soap.",
    "prompt": "A complete StoryBridge animated slide showing hands washing with soap at a classroom sink. Gentle predictable motion, no fast cuts, calm watercolor storybook style.",
    "aspectRatio": "16:9"
  }'
```

Copy the returned `operationName`, then poll:

```bash
curl -X POST http://localhost:3000/api/video-status \
  -H "Content-Type: application/json" \
  -d '{"operationName":"PASTE_OPERATION_NAME_HERE"}'
```

When `done` and `hasVideo` are true, download or open:

```text
http://localhost:3000/api/video-download?op=PASTE_OPERATION_NAME_HERE
```

In the app, lessons with video media should play from the Show Time tab.

## Data Storage

StoryBridge currently stores teacher library data locally in the browser.

Primary storage:

- IndexedDB database: `storybridge.lessonLibrary.db`
- Object store: `lessons`

Fallback and metadata:

- `storybridge.lessonLibrary.v1`
- `storybridge.savedLesson.v1`

This means generated lessons are local to the current browser profile. Clearing browser storage can remove saved lessons. Cloud accounts and shared school libraries are future product work.

## Accessibility And Sensory-Friendly UX

Keep UI work aligned with the app's audience:

- Prefer one focused screen over complex navigation.
- Use calm spacing, clear hierarchy, and predictable controls.
- Keep animation purposeful and smooth.
- Preserve haptic feedback with `navigator.vibrate(50)` where supported.
- Keep touch targets large enough for iPhone SE and up.
- Preserve horizontal swipe behavior for slide browsing and saved lessons.
- Maintain readable text for browser TTS.

## AI Prompting Guidelines

Generation prompts should enforce:

- One learning idea per slide.
- Age-appropriate tone and visuals.
- Inclusive characters and school-safe settings.
- No clutter, fast cuts, flashing lights, or sudden camera moves.
- No shame, punishment, restraint, forced eye contact, or compliance framing.
- No stereotypes about autistic learners.
- Hygiene visuals limited to school-safe items like hands, sinks, soap, towels, and toothbrushes.
- Sensitive topics such as body safety, bullying, self-injury, medical issues, aggression, or elopement should stay calm, non-graphic, and trusted-adult oriented.

Age guidance:

- K-2: simple first-person or shared-language sentences, one concrete action per slide.
- Grades 3-5: concrete cause-and-effect, simple emotion naming, collaborative classroom examples.
- Grades 6-8: respectful preteen tone, autonomy, boundaries, transitions, and self-advocacy.
- Grades 9-12: dignified teen tone, independence, planning, school/community/work-readiness contexts.

## Development Guardrails

- Keep all Gemini API calls in `server.ts`.
- Do not expose `GEMINI_API_KEY` to React code.
- Do not use legacy `generateContent` for chat, lesson JSON, or images.
- Use Interactions API for text, structured output, stateful chat, and images.
- Keep Veo video generation on the long-running operation path until the provider supports equivalent Interactions behavior.
- Do not overlay slide text in the app over AI images. The generated media should contain the text.
- Use the CSS variables in `src/index.css` instead of adding unrelated color systems.
- Keep generated media, secrets, and local test artifacts out of git.

## Troubleshooting

### `GEMINI_API_KEY is not configured`

Create `.env`, set `GEMINI_API_KEY`, and restart the dev server.

### `/api/ai-status` says video is not ready

Confirm `GEMINI_API_KEY` is present and `GEMINI_VIDEO_MODEL` is not empty. The default model is `veo-3.1-lite-generate-preview`.

### Video generation starts but does not play

Poll `/api/video-status` until `done` and `hasVideo` are true. If the operation is done without a video, inspect the server log for provider errors. If the MP4 exists but the browser does not autoplay, open Show Time and start playback manually.

### Images or videos have bad text

Model-rendered text can be imperfect. Keep slide text short, literal, and high contrast. The prompt should say the exact text must be rendered inside the generated media and that no other readable text should appear.

### Saved lessons disappear

The current library is local-browser storage. Check whether the browser profile, storage, or site data was cleared.

### Port 3000 is already in use

Stop the other process or update `PORT` in `server.ts` before running the dev server.

## Current Verification Snapshot

As of June 28, 2026:

- `npm run lint` passes.
- `npm run build` passes.
- Real Gemini image generation has been exercised through `/api/generate-image`.
- Real Veo generation has produced a playable MP4 through `/api/generate-video`, `/api/video-status`, and `/api/video-download`.
- The generated video plays in the Show Time tab.

Re-run the validation commands after changes that touch `server.ts`, `src/App.tsx`, `src/components/Carousel.tsx`, or `src/components/CreateModal.tsx`.
