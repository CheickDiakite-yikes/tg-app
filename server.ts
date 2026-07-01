import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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

function collectErrorText(error: any): string {
  const parts: string[] = [];
  let current = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current?.message === "string") parts.push(current.message);
    if (typeof current?.body === "string") parts.push(current.body);
    current = current?.cause;
  }

  return parts.join(" ");
}

function extractGeminiErrorMessage(text: string): string | undefined {
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) return undefined;

  try {
    const parsed = JSON.parse(text.slice(jsonStart));
    return parsed?.error?.message || parsed?.message;
  } catch {
    return undefined;
  }
}

function sendAiError(res: express.Response, label: string, error: any) {
  console.error(label, error);

  const rawText = collectErrorText(error);
  const lower = rawText.toLowerCase();
  const parsedMessage = extractGeminiErrorMessage(rawText);

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429")
  ) {
    return res.status(429).json({
      code: "GEMINI_QUOTA_EXHAUSTED",
      error:
        parsedMessage ||
        "Gemini quota is exhausted for this key or model. Check Google AI Studio billing and rate limits, then retry.",
    });
  }

  if (
    lower.includes("api key not valid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return res.status(401).json({
      code: "GEMINI_AUTH_ERROR",
      error: parsedMessage || "Gemini rejected the configured API key or model permissions.",
    });
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("eacces") ||
    lower.includes("network") ||
    lower.includes("connection")
  ) {
    return res.status(502).json({
      code: "GEMINI_NETWORK_ERROR",
      error:
        "StoryBridge could not reach Gemini from the server. Check the server network, firewall, proxy, or VPN settings.",
    });
  }

  return res.status(500).json({
    code: "GEMINI_REQUEST_FAILED",
    error: parsedMessage || error?.message || "Gemini request failed.",
  });
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
    const sourceLesson = context?.sourceLesson;
    const promptContext = sourceLesson ? { ...context, sourceLesson: "Provided below." } : context;

    const session = getSession(sessionId);
    const interaction = await ai.interactions.create({
      model: GEMINI_TEXT_MODEL,
      input: `
Teacher message:
${message}

Current creation settings:
${JSON.stringify(promptContext || {}, null, 2)}

${sourceLesson ? `Source lesson being edited or converted:
${JSON.stringify(sourceLesson, null, 2)}` : ""}

Agent behavior:
- If the teacher gives a usable request, become readyToGenerate and draft the lesson without asking for settings or another question.
- Infer grade band, slide count, format, and visual style when the teacher does not specify them.
- If the teacher writes "create", "make", or "generate", treat that as intent to build a draft.
- If the teacher asks for video, animation, or Show Time, recommend showtime and make the suggested slides motion-aware.
- If the teacher asks for both images and videos, recommend mixed and keep each moment visually simple.
- If a source lesson is provided, treat the teacher message as edits or conversion instructions for that lesson. Preserve the strongest useful structure and do not switch to an unrelated topic.
- If a source lesson is provided and mediaMode is "video", convert the source lesson into motion-friendly Show Time scenes.
- If a source lesson is provided and mediaMode is "mixed", revise the slideshow plan and add new video moments that match the revised lesson.
- For hygiene or self-care routines, suggest specific repeatable motor steps rather than broad summaries. For tooth brushing, include precise areas of the mouth when appropriate.
- If the teacher requests a familiar or character-like guide, keep the visual description consistent across every suggested slide or scene.
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
    sendAiError(res, "Chat error:", error);
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
    const sourceLesson = preferences?.sourceLesson;
    const promptPreferences = sourceLesson ? { ...preferences, sourceLesson: "Provided above." } : preferences;

    const interaction = await ai.interactions.create({
      model: GEMINI_TEXT_MODEL,
      input: `
Create a complete StoryBridge lesson draft.

Teacher topic or request:
${topic || "Use the conversation so far."}

${sourceLesson ? `Source lesson to revise or convert:
${JSON.stringify(sourceLesson, null, 2)}` : ""}

Last agent draft state:
${JSON.stringify(session?.lastAgentState || {}, null, 2)}

Teacher preferences:
${JSON.stringify(promptPreferences || {}, null, 2)}

Required lesson rules:
- If a source lesson is provided, this is an edit or conversion of that lesson. Keep the same core student need unless the teacher explicitly changes it.
- If a source lesson is provided, preserve the clearest useful steps, vocabulary, and safety framing while applying the teacher's requested edits.
- If a source lesson is provided and preferences.mediaMode is "video", create a Show Time version using brand-new video prompts based on the source lesson plus edits.
- If a source lesson is provided and preferences.mediaMode is "mixed", create a revised slideshow plan and choose new video moments where motion improves comprehension.
- Create exactly ${slideCount} slides unless the topic needs fewer for clarity.
- Learner-facing slide text should usually be 4 to 12 words.
- Each slide must carry one concrete idea only.
- Apply age-band appropriateness from the system guidance. If gradeBand is "Auto", infer the grade band from the teacher request and last agent draft.
- If preferences.mediaMode is "video", plan the lesson as a sequence of scenes that will become one continuous Show Time video, not separate clips.
- If preferences.mediaMode is "mixed", plan clear slideshow pages plus one continuous Show Time video scene sequence based on the same revised lesson.
- For hygiene and self-care tasks, break the physical routine into specific repeatable motor actions the student can imitate. For tooth brushing, include precise areas such as upper front teeth, upper outside, upper inside, lower front teeth, lower outside, lower inside, chewing surfaces, tongue, spit, and rinse when age-appropriate.
- For shower, hair, deodorant, toileting-adjacent, or privacy-sensitive routines, keep visuals school-safe and use clothed/non-private framing, close-ups of hands/tools/water controls, and clear safety actions.
- Include narration for text-to-speech.
- Include a teacher note and one interaction cue that accepts multiple communication modes.
- If the teacher asks for a familiar or character-like guide, translate that into a consistent original character description and repeat the same visible traits in every imagePrompt and videoPrompt: face shape, hair/color, outfit, accessory, approximate age, palette, and body proportions. Do not let the character's outfit, hair, accessory, or proportions drift between slides.
- Image prompts must describe a complete finished slide image, not a background. The app will render exact text separately, so image prompts must explicitly request no text, no letters, no labels, no captions, and no readable words inside the generated image.
- Image prompts must specify: warm watercolor children's book illustration, calm classroom or everyday setting, inclusive characters, soft daylight, uncluttered scene, no logos, same character design across all slides, one clear action, safe environment, and a clean lower caption-safe area with simple background.
- Video prompts must describe one complete multi-scene generated clip when the output is Show Time. Use scene changes or camera-angle changes inside the same video to show the lesson concepts.
- Video prompts must specify: 8 seconds when possible, gentle predictable motion, no fast cuts, no flashing lights, no sudden camera moves, no crowded scenes, no audio requirement, no readable text, no captions, no labels, same character design across every scene.
- If the teacher asks for social skills, frame it as choice, communication, and self-advocacy.
- Hygiene visuals must stay school-safe: hands/sink/soap/towels/water controls/deodorant/hair tools are fine; shower or hair-washing lessons should use clothed, non-private framing or close-ups of tools, hands, water, and hair only; no nudity, private body areas, toileting details, injuries, or medical procedure imagery.
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
    sendAiError(res, "Lesson gen error:", error);
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

${slideText ? `The app will render this exact learner-facing sentence below the image: "${slideText}". Do not draw or render this sentence inside the image.` : ""}

${prompt}

StoryBridge image constraints:
warm watercolor storybook illustration, calm low-arousal palette, soft daylight, friendly inclusive characters, same character design and outfit across the lesson, no readable text, no letters, no captions, no labels, no text on props/signs/cards/posters, no logos, no clutter, one clear repeatable action, safe classroom or everyday environment, clean lower caption-safe area with simple background, complete full-bleed slide composition. If a character guide is described, keep hair, face, outfit, accessories, colors, and proportions consistent.
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
    sendAiError(res, "Image gen error:", error);
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

${slideText ? `The app will display this learner-facing caption separately: "${slideText}". Do not render captions, subtitles, labels, or readable text inside the video.` : ""}

${prompt}

StoryBridge video constraints: one continuous multi-scene video, about 8 seconds when possible, gentle predictable motion, clear repeatable actions, no fast cuts, no flashing, no sudden camera moves, no crowded scenes, no distress, no readable text, no captions, no subtitles, no text on props/signs/cards/posters, no logos, calm inclusive storybook style, same character design and outfit across every scene.
      `.trim(),
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        durationSeconds: 8,
        aspectRatio: videoAspectRatio,
        generateAudio: false,
        negativePrompt:
          "misspelled text, garbled letters, captions, subtitles, logos, inconsistent character, changing outfit, changing hair, changing accessories, extra fingers, distorted hands, flashing lights, sudden cuts, crowded scenes",
      },
    });

    res.json({ operationName: operation.name, aspectRatio: videoAspectRatio });
  } catch (error: any) {
    sendAiError(res, "Video gen start error:", error);
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
    sendAiError(res, "Video poll error:", error);
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
    if (!res.headersSent) sendAiError(res, "Video download error:", error);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: false,
      plugins: [react(), tailwindcss()],
      build: {
        target: "es2019",
        cssTarget: "safari13",
      },
      esbuild: {
        target: "es2019",
      },
      resolve: {
        preserveSymlinks: true,
        alias: {
          "@": process.cwd(),
        },
      },
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
