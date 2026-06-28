import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = 3000;
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
const GEMINI_VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL || "veo-3.1-lite-generate-preview";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { headers: { "User-Agent": "storybridge-web-app" } },
});

interface AgentChatPayload {
  reply: string;
  readyToGenerate: boolean;
  draftTitle: string;
  learnerProfile?: {
    gradeBand?: string;
    supportNeeds?: string[];
  };
  recommendedFormat: "slideshow" | "showtime" | "mixed";
  suggestedSlides: string[];
  quickReplies: string[];
  safetyNotes: string[];
}

interface LessonSlidePayload {
  text: string;
  narration: string;
  imagePrompt: string;
  videoPrompt: string;
  mediaType: "image" | "video";
  teacherNote: string;
  interactionCue: string;
  sensoryGoal: string;
  safetyNotes: string[];
}

interface LessonPayload {
  title: string;
  objective: string;
  audience: string;
  estimatedDuration: string;
  sensoryNotes: string[];
  agentSummary: string;
  slides: LessonSlidePayload[];
}

interface ChatSession {
  previousInteractionId?: string;
  lastAgentState?: AgentChatPayload;
  lastLesson?: LessonPayload;
  updatedAt: number;
}

const chatSessions = new Map<string, ChatSession>();

const AGE_BAND_GUIDANCE = `
Age and grade-band guidance:
- K-2: use first-person or simple shared-language sentences ("I can...", "We..."), concrete routines, one action per slide, familiar places, gentle adult support nearby, no abstract social judgment.
- Grades 3-5: still concrete, but allow simple cause-and-effect, collaborative classroom examples, emotion naming, and choice language. Avoid babyish characters or wording.
- Grades 6-8: use a respectful preteen tone, more autonomy, privacy, boundaries, peer collaboration, transitions, and self-advocacy. Avoid infantilizing art, oversized toddler cues, or overly cute language.
- Grades 9-12: use a dignified teen tone, independence, real school/community/work-readiness contexts, self-advocacy, planning, and choice. Do not make teen lessons look like preschool content.
- If the teacher does not specify age or grade, infer a likely grade band from the topic and wording. Ask only if the content could be age-sensitive or the grade materially changes safety/appropriateness.

School-safe content:
- Keep all children fully clothed and in ordinary classroom, home-routine, or community-learning contexts.
- Hygiene topics may show hands, sinks, soap, towels, toothbrushes, or supplies; do not show bathing, toileting details, nudity, medical procedures, injuries, or private body areas.
- For body safety, sexuality, bullying, trauma, aggression, elopement, restraint, self-injury, or medical topics, recommend trusted-adult support and keep visuals non-graphic, calm, and school-appropriate.
- Do not generate stereotypes about autistic children. Do not imply all autistic learners have the same support needs.
`;

const STORYBRIDGE_AGENT_SYSTEM = `
You are StoryBridge, an agentic lesson-design partner for K-12 teachers who support autistic learners.

Design stance:
- Be neurodiversity-affirming, concrete, respectful, and low-arousal.
- Do not use shame, punishment, forced eye contact, compliance language, or ABA-style framing.
- Prefer predictability, choice, autonomy, sensory awareness, and communication supports.
- Keep visible slide language short, literal, and age-appropriate. Avoid idioms and sarcasm.
- Use one learning idea per slide and make every visual scene calm, uncluttered, and easy to scan.
- Infer sensible defaults from the teacher's sentence. Ask at most one clarifying question only when the missing detail would materially change safety, age appropriateness, or classroom usability.
- When a useful first draft is possible, be decisive: draft it and offer optional refinements as quick replies instead of asking another question in the main reply.
- Never make medical, diagnostic, or therapeutic claims. This is classroom support material, not clinical advice.

${AGE_BAND_GUIDANCE}
`;

const agentChatSchema = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "Warm, concise assistant reply. If readyToGenerate is true, summarize the draft direction without asking a question. Ask only when readyToGenerate is false and one critical clarification is needed.",
    },
    readyToGenerate: {
      type: "boolean",
      description:
        "True when there is enough information to generate a useful first lesson draft.",
    },
    draftTitle: { type: "string" },
    learnerProfile: {
      type: "object",
      properties: {
        gradeBand: { type: "string" },
        supportNeeds: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    recommendedFormat: {
      type: "string",
      enum: ["slideshow", "showtime", "mixed"],
    },
    suggestedSlides: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: { type: "string" },
    },
    quickReplies: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    safetyNotes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "reply",
    "readyToGenerate",
    "draftTitle",
    "recommendedFormat",
    "suggestedSlides",
    "quickReplies",
    "safetyNotes",
  ],
};

const lessonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    audience: { type: "string" },
    estimatedDuration: { type: "string" },
    sensoryNotes: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    agentSummary: { type: "string" },
    slides: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "Short learner-facing slide sentence, ideally 4 to 12 words.",
          },
          narration: {
            type: "string",
            description:
              "Read-aloud narration for TTS. Concrete, calm, and one or two short sentences.",
          },
          imagePrompt: {
            type: "string",
            description:
              "Prompt for a complete finished slide image that includes the exact slide text in the artwork.",
          },
          videoPrompt: {
            type: "string",
            description:
              "Prompt for a complete video clip or animated slide that includes the slide text as generated media, not app overlay.",
          },
          mediaType: { type: "string", enum: ["image", "video"] },
          teacherNote: { type: "string" },
          interactionCue: { type: "string" },
          sensoryGoal: { type: "string" },
          safetyNotes: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "text",
          "narration",
          "imagePrompt",
          "videoPrompt",
          "mediaType",
          "teacherNote",
          "interactionCue",
          "sensoryGoal",
          "safetyNotes",
        ],
      },
    },
  },
  required: [
    "title",
    "objective",
    "audience",
    "estimatedDuration",
    "sensoryNotes",
    "agentSummary",
    "slides",
  ],
};

function ensureGeminiKey(res: express.Response) {
  if (process.env.GEMINI_API_KEY) return true;

  res.status(503).json({
    error:
      "GEMINI_API_KEY is not configured. Add it to .env to use StoryBridge AI generation.",
  });
  return false;
}

app.get("/api/ai-status", (_req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  res.json({
    geminiConfigured,
    textGenerationReady: geminiConfigured,
    imageGenerationReady: geminiConfigured,
    videoGenerationReady: geminiConfigured && Boolean(GEMINI_VIDEO_MODEL),
    textModel: GEMINI_TEXT_MODEL,
    imageModel: GEMINI_IMAGE_MODEL,
    videoModel: GEMINI_VIDEO_MODEL,
  });
});

function getSession(sessionId: string) {
  const existing = chatSessions.get(sessionId);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }

  const created: ChatSession = { updatedAt: Date.now() };
  chatSessions.set(sessionId, created);
  return created;
}

function extractOutputText(interaction: any) {
  if (typeof interaction?.output_text === "string") return interaction.output_text;
  if (typeof interaction?.outputText === "string") return interaction.outputText;

  let text = "";

  const addText = (value: any) => {
    if (typeof value === "string") text += value;
  };

  for (const output of interaction?.outputs || []) {
    if (output?.type === "text") addText(output.text);
    if (typeof output?.content === "string") addText(output.content);
  }

  for (const step of interaction?.steps || []) {
    if (step?.type !== "model_output") continue;
    for (const content of step.content || []) {
      if (content?.type === "text") addText(content.text);
    }
  }

  return text.trim();
}

function extractOutputImage(interaction: any) {
  const candidates = [
    interaction?.output_image,
    interaction?.outputImage,
    ...(interaction?.outputs || []),
    ...(interaction?.steps || []).flatMap((step: any) => step?.content || []),
  ];

  for (const candidate of candidates) {
    if (candidate?.type !== "image") continue;
    if (candidate.data || candidate.uri) {
      return {
        data: candidate.data as string | undefined,
        uri: candidate.uri as string | undefined,
        mimeType: (candidate.mime_type || candidate.mimeType || "image/png") as string,
      };
    }
  }

  return null;
}

function stripJsonFences(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function parseJsonText<T>(text: string, fallback: T): T {
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(stripJsonFences(text)) as T;
  } catch (error) {
    console.error("Could not parse Gemini JSON:", error, text);
    return fallback;
  }
}

function stripReadyStateQuestions(reply: string) {
  if (!reply.includes("?")) return reply;
  const sentences = reply.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [reply];
  const declarative = sentences.filter(sentence => !sentence.includes("?")).join(" ").trim();
  return declarative || reply.replace(/\?/g, ".");
}

function normalizeAgentPayload(payload: Partial<AgentChatPayload>, rawText: string) {
  const reply =
    payload.reply ||
    rawText ||
    "I can help shape this into a calm visual lesson. Tell me the topic, grade band, and what the student should practice.";
  const readyToGenerate = Boolean(payload.readyToGenerate);
  const polishedReply = readyToGenerate ? stripReadyStateQuestions(reply) : reply;

  return {
    reply: polishedReply,
    text: polishedReply,
    readyToGenerate,
    draftTitle: payload.draftTitle || "New StoryBridge Lesson",
    learnerProfile: payload.learnerProfile || {},
    recommendedFormat: payload.recommendedFormat || "slideshow",
    suggestedSlides: Array.isArray(payload.suggestedSlides)
      ? payload.suggestedSlides.slice(0, 7)
      : [],
    quickReplies: Array.isArray(payload.quickReplies)
      ? payload.quickReplies.slice(0, 3)
      : ["Make it calmer", "Use younger language", "Add a break slide"],
    safetyNotes: Array.isArray(payload.safetyNotes) ? payload.safetyNotes : [],
  };
}

function normalizeLesson(payload: Partial<LessonPayload>, preferredMedia: string): LessonPayload {
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  const mediaOverride: "image" | "video" | null =
    preferredMedia === "video" || preferredMedia === "image" ? preferredMedia : null;

  return {
    title: payload.title || "StoryBridge Lesson",
    objective: payload.objective || "Practice one clear classroom skill with visual support.",
    audience: payload.audience || "K-12 autistic learners",
    estimatedDuration: payload.estimatedDuration || "3-5 minutes",
    sensoryNotes: Array.isArray(payload.sensoryNotes)
      ? payload.sensoryNotes
      : ["Use a calm voice.", "Pause between slides for processing time."],
    agentSummary:
      payload.agentSummary ||
      "A calm, visual-first lesson with one concrete idea per slide.",
    slides: slides.slice(0, 7).map((slide, index) => ({
      text: slide.text || `Step ${index + 1}`,
      narration: slide.narration || slide.text || `Step ${index + 1}`,
      imagePrompt: slide.imagePrompt || "A calm classroom scene in a warm storybook style.",
      videoPrompt:
        slide.videoPrompt ||
        `${slide.imagePrompt || "A calm classroom scene"} Gentle 4 second motion, no fast cuts.`,
      mediaType: mediaOverride || (slide.mediaType === "video" ? "video" : "image"),
      teacherNote: slide.teacherNote || "Pause and invite the student to notice one detail.",
      interactionCue: slide.interactionCue || "Offer a choice to point, say, type, or gesture.",
      sensoryGoal: slide.sensoryGoal || "Keep the scene predictable and uncluttered.",
      safetyNotes: Array.isArray(slide.safetyNotes) ? slide.safetyNotes : [],
    })),
  };
}

// 1. Agentic chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const { sessionId, message, context } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message required" });
    }

    const session = getSession(sessionId);
    const interaction = await ai.interactions.create({
      model: GEMINI_TEXT_MODEL,
      input: `
Teacher message:
${message}

Current creation settings:
${JSON.stringify(context || {}, null, 2)}

Agent behavior:
- If the teacher gives a usable request, become readyToGenerate and draft the lesson without asking for settings or another question.
- Infer grade band, slide count, format, and visual style when the teacher does not specify them.
- If the teacher writes "create", "make", or "generate", treat that as intent to build a draft.
- If the teacher asks for video, animation, or Show Time, recommend showtime and make the suggested slides motion-aware.
- If the teacher asks for both images and videos, recommend mixed and keep each moment visually simple.
- If readyToGenerate is true, the reply should be declarative and should not contain a question mark.
- If readyToGenerate is true, invite the teacher to keep chatting naturally: they can say "create it" or describe a change.
- Put optional refinements in quickReplies instead of making the teacher answer before creating.
- Do not mention clicking, menus, settings panels, buttons, or controls in the reply.
- Suggested slides should be short learner-facing ideas, not long production notes.
- Quick replies should feel like natural teacher choices, not settings labels, and should never block the main Create slideshow action.

Return only the JSON object requested by the response schema. Keep the reply under 75 words.
      `.trim(),
      previous_interaction_id: session.previousInteractionId,
      system_instruction: STORYBRIDGE_AGENT_SYSTEM,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: agentChatSchema,
      },
      generation_config: {
        temperature: 0.45,
      },
    } as any);

    session.previousInteractionId = interaction.id;
    const rawText = extractOutputText(interaction);
    const parsed = parseJsonText<Partial<AgentChatPayload>>(rawText, {});
    const normalized = normalizeAgentPayload(parsed, rawText);
    session.lastAgentState = normalized;

    res.json({ ...normalized, interactionId: interaction.id });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Generate lesson structure
app.post("/api/generate-lesson", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const { sessionId, topic, preferences } = req.body;
    if (!topic && !sessionId) {
      return res.status(400).json({ error: "topic or sessionId required" });
    }

    const session = sessionId ? getSession(sessionId) : undefined;
    const preferredMedia = preferences?.mediaMode || "image";
    const slideCount = Math.max(3, Math.min(Number(preferences?.lessonLength) || 5, 7));

    const interaction = await ai.interactions.create({
      model: GEMINI_TEXT_MODEL,
      input: `
Create a complete StoryBridge lesson draft.

Teacher topic or request:
${topic || "Use the conversation so far."}

Last agent draft state:
${JSON.stringify(session?.lastAgentState || {}, null, 2)}

Teacher preferences:
${JSON.stringify(preferences || {}, null, 2)}

Required lesson rules:
- Create exactly ${slideCount} slides unless the topic needs fewer for clarity.
- Learner-facing slide text should usually be 4 to 12 words.
- Each slide must carry one concrete idea only.
- Apply age-band appropriateness from the system guidance. If gradeBand is "Auto", infer the grade band from the teacher request and last agent draft.
- If preferences.mediaMode is "video", every slide should be planned as a complete short animated moment with gentle motion, not a still image description.
- If preferences.mediaMode is "mixed", choose video only when movement improves comprehension, otherwise use images.
- Include narration for text-to-speech.
- Include a teacher note and one interaction cue that accepts multiple communication modes.
- Image prompts must describe a complete finished slide image, not a background. The generated image itself must include the exact learner-facing slide text, spelled correctly, as large hand-lettered dark navy text integrated into the composition.
- Image prompts must specify: warm watercolor children's book illustration, calm classroom or everyday setting, inclusive characters, soft daylight, uncluttered scene, no logos, no extra labels or readable words on props/signs/cards, no crowded room, clear safe text area inside the image.
- Video prompts must describe a complete generated clip or animated slide, not a background for app overlay. Include the exact slide text as a stable opening card, classroom poster, or illustrated title area inside the video when text rendering is supported.
- Video prompts must specify: 4 to 6 seconds, gentle predictable motion, no fast cuts, no flashing lights, no sudden camera moves, no crowded scenes, no audio requirement.
- If the teacher asks for social skills, frame it as choice, communication, and self-advocacy.
- Hygiene visuals must stay school-safe: hands/sink/soap/towels are fine; no bathing, toileting details, nudity, private body areas, injuries, or medical procedure imagery.
- Do not include punishment, shame, forced eye contact, restraint, medical claims, or promises of behavior change.

Return only the JSON object requested by the response schema.
      `.trim(),
      previous_interaction_id: session?.previousInteractionId,
      system_instruction: STORYBRIDGE_AGENT_SYSTEM,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: lessonSchema,
      },
      generation_config: {
        temperature: 0.5,
      },
    } as any);

    if (session) session.previousInteractionId = interaction.id;

    const rawText = extractOutputText(interaction);
    const parsed = parseJsonText<Partial<LessonPayload>>(rawText, {});
    const lesson = normalizeLesson(parsed, preferredMedia);
    if (session) session.lastLesson = lesson;

    res.json({ ...lesson, interactionId: interaction.id });
  } catch (error: any) {
    console.error("Lesson gen error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate slide image
app.post("/api/generate-image", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const { prompt, slideText, size = "1K", aspectRatio = "16:9" } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    const interaction = await ai.interactions.create({
      model: GEMINI_IMAGE_MODEL,
      input: `
Create one complete StoryBridge slideshow image. This must be a finished slide frame, not a background for app text.

${slideText ? `Render this exact learner-facing sentence inside the image, spelled correctly and prominently: "${slideText}"` : ""}

${prompt}

StoryBridge image constraints:
warm watercolor storybook illustration, calm low-arousal palette, soft daylight, friendly inclusive characters, dark navy hand-lettered slide text, clear readable text area integrated into the artwork, no readable words except the exact slide sentence, no text on props/signs/cards/posters, no logos, no clutter, one clear action, safe classroom or everyday environment, complete full-bleed slide composition.
      `.trim(),
      response_modalities: ["image"],
      response_format: {
        type: "image",
        aspect_ratio: aspectRatio,
        image_size: size,
      },
    } as any);

    const image = extractOutputImage(interaction);
    if (!image) {
      return res.status(502).json({ error: "Gemini did not return an image." });
    }

    const imageUrl = image.uri || `data:${image.mimeType};base64,${image.data}`;
    res.json({ imageUrl, interactionId: interaction.id });
  } catch (error: any) {
    console.error("Image gen error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Generate video start
app.post("/api/generate-video", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const { prompt, slideText, aspectRatio = "16:9" } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    const videoAspectRatio = aspectRatio === "9:16" ? "9:16" : "16:9";

    const operation = await ai.models.generateVideos({
      model: GEMINI_VIDEO_MODEL,
      prompt: `
Create one complete StoryBridge animated slide or short lesson clip. Do not rely on app overlay text.

${slideText ? `Include this exact learner-facing sentence as a stable generated title card or poster inside the video when supported: "${slideText}"` : ""}

${prompt}

StoryBridge video constraints: 4 to 6 seconds, gentle predictable motion, no fast cuts, no flashing, no sudden camera moves, no crowded scenes, no distress, no readable words except the exact slide sentence, no text on props/signs/cards/posters, no logos, calm inclusive storybook style.
      `.trim(),
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: videoAspectRatio,
      },
    });

    res.json({ operationName: operation.name, aspectRatio: videoAspectRatio });
  } catch (error: any) {
    console.error("Video gen start error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Video poll status
app.post("/api/video-status", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const { operationName } = req.body;
    if (!operationName) return res.status(400).json({ error: "operationName required" });

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    const videoUri = updated.response?.generatedVideos?.[0]?.video?.uri;
    res.json({
      done: Boolean(updated.done),
      operationName: updated.name || operationName,
      hasVideo: Boolean(videoUri),
      error: (updated as any).error?.message,
    });
  } catch (error: any) {
    console.error("Video poll error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Video download
app.get("/api/video-download", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return;

    const operationName = req.query.op as string;
    if (!operationName) return res.status(400).json({ error: "Missing op" });

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return res.status(404).json({ error: "Video URI not found yet" });
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY as string },
    });

    if (!videoRes.ok || !videoRes.body) {
      return res.status(502).json({ error: "Could not download generated video." });
    }

    res.setHeader("Content-Type", "video/mp4");
    videoRes.body.pipeTo(
      new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
        close() {
          res.end();
        },
      }),
    );
  } catch (error: any) {
    console.error("Video download error:", error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
