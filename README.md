# StoryBridge

StoryBridge is a specialized platform designed for K-12 teachers who work with autistic children. It empowers educators to effortlessly create engaging, visual-first lessons and interactive slideshows focusing on social skills, good habits, and educational topics. 

By leveraging the power of multimodal AI, StoryBridge transforms simple text prompts into beautiful, custom-tailored images and videos that resonate with neurodivergent learners.

## Features

- **AI-Powered Lesson Generation**: Teachers can chat with a specialized AI assistant to brainstorm topics. The AI structures these into multi-slide lessons complete with narration text and detailed visual prompts.
- **Custom Image & Video Generation**: Uses Gemini's multimodal capabilities (`gemini-3-pro-image` and `veo-3.1-lite-generate-preview`) to generate high-quality, comforting, and stylized visuals for each slide.
- **Interactive Carousel**: A snappy, swipe-friendly slideshow viewer with text-to-speech ("Listen again") capabilities, designed to be accessible and distraction-free.
- **Responsive & Accessible Design**: Crafted with a calming color palette, readable typography (Nunito), and generous spacing to ensure a sensory-friendly experience.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS v4, `motion/react` for fluid animations, `lucide-react` for iconography.
- **Backend**: Express (Node.js) server to proxy API requests and securely manage API keys.
- **AI Integration**: `@google/genai` SDK using the **Interactions API** for stateful multi-turn chat, structured JSON output for lesson generation, and multimodal asset generation (images and videos).
- **Build Tool**: Vite & esbuild for a bundled full-stack deployment.

## Architecture & Code Structure

The application follows a full-stack architecture where the Express server proxies all AI requests to keep the `GEMINI_API_KEY` secure.

- `server.ts`: The Express backend entry point. Handles AI API calls using the Gemini Interactions API.
  - `/api/chat`: Stateful chat for brainstorming. Uses `previous_interaction_id` for memory.
  - `/api/generate-lesson`: Generates a structured JSON lesson plan.
  - `/api/generate-image`: Calls `gemini-3-pro-image` to create slide illustrations.
  - `/api/generate-video`: Initiates Veo video generation operations.
  - `/api/video-status` & `/api/video-download`: Polls and streams generated videos.
- `src/App.tsx`: The main React application container, managing global state, the header, and the main layout.
- `src/components/Carousel.tsx`: The interactive slideshow component supporting swipe gestures and text-to-speech.
- `src/components/CreateModal.tsx`: The chat interface and lesson generation configuration dialog.
- `src/types.ts`: Shared TypeScript interfaces (`Slide`, `Lesson`).
- `src/index.css`: Global styles and Tailwind configuration, defining the brand color variables and font family.

## Local Development

1. Install dependencies: `npm install`
2. Create a `.env` file based on `.env.example` and add your `GEMINI_API_KEY`.
3. Start the dev server: `npm run dev` (Runs both Vite and Express via `tsx`).

## Deployment

The app is built into a single self-contained unit using `npm run build`, which compiles the React frontend via Vite and bundles the Express server using esbuild into `dist/server.cjs`. 
The production server is then started via `npm start`.
