# Agent Instructions for StoryBridge

When continuing development on StoryBridge, please adhere strictly to the following guidelines:

## 1. AI Integration (Gemini API)
- **Use the Interactions API**: We have migrated from the legacy `generateContent` to the new `ai.interactions.create` API. Do NOT use `generateContent` or `generateVideos` directly on models for text and image generation.
- **Server-Side Only**: All Gemini API calls MUST be routed through `server.ts`. Never expose the `GEMINI_API_KEY` to the client.
- **Stateful Chat**: The `/api/chat` endpoint uses `previous_interaction_id` to maintain conversation history. Store this ID mapping in memory on the server.
- **Multimodal Output**: Image generation is handled by `gemini-3-pro-image` using the Interactions API with `response_modalities: ['image']`.
- **Video Generation**: Video generation is handled by `veo-3.1-lite-generate-preview`. (Note: Continue using the legacy `ai.models.generateVideos` or `GenerateVideosOperation` for Veo video generation as it uses a long-running operation polling mechanism not fully mapped in synchronous interactions).

## 2. Design & Styling
- **Sensory-Friendly Design**: The target audience works with autistic children. Maintain a calm, soft, and friendly visual aesthetic.
- **Color Palette**: Stick to the CSS variables defined in `src/index.css` (e.g., `--color-brand-primary`, `--color-brand-light`, `--color-bg-card`). Avoid harsh colors or chaotic gradients.
- **Typography**: Use the 'Nunito' font for a friendly, approachable feel.
- **Animations**: Keep animations smooth and purposeful using `motion/react`. Avoid jarring or overly complex motion that could be overstimulating.

## 3. UI/UX
- **Single-Screen Focus**: Keep the app contained within a clean, single-view architecture. Do not add complex sidebars or deep navigation hierarchies.
- **Haptic Feedback**: Retain `navigator.vibrate(50)` on interactive elements (buttons, slide changes) to provide tactile feedback on supported devices.
- **Text-to-Speech**: The Carousel includes a native browser TTS feature (`window.speechSynthesis`). Ensure text remains simple and legible for this feature.
