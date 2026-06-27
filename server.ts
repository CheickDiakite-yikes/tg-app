import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "50mb" }));
const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

// Chat sessions store for multi-turn history
const chatSessions = new Map<string, string>(); // stores previous_interaction_id

// 1. Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message required" });
    }
    
    let previousId = chatSessions.get(sessionId);
    
    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: message,
      previous_interaction_id: previousId,
      system_instruction: "You are a helpful and creative assistant for teachers who work with autistic children (K-12). Your goal is to help them brainstorm ideas and write content for social skills lessons, good habits, and educational topics. You provide practical, easy-to-understand advice.",
    });
    
    chatSessions.set(sessionId, interaction.id);
    
    let text = interaction.output_text || "";
    if (!text && interaction.steps) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output') {
            const textContent = step.content?.find(c => c.type === 'text');
            if (textContent && textContent.text) {
              text += textContent.text;
            }
          }
        }
    }
    
    res.json({ text });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Generate Lesson Structure
app.post("/api/generate-lesson", async (req, res) => {
  try {
    const { topic } = req.body;
    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: `Create a lesson for autistic children about: ${topic}. 
      Return a JSON object with:
      - title: string
      - slides: array of objects { 
          text: string (the short sentence to display on the slide), 
          imagePrompt: string (detailed prompt for an illustrator to draw this scene. The style should be: "warm, soft watercolor illustration style, children's book style, comforting, friendly"),
          mediaType: string (either "image" or "video")
        }
      Keep it between 3 to 6 slides. Make the text very simple and clear.`,
      response_format: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                mediaType: { type: Type.STRING }
              },
              required: ["text", "imagePrompt", "mediaType"]
            }
          }
        },
        required: ["title", "slides"]
      }
    });
    
    let result = interaction.output_text;
    res.json(JSON.parse(result || "{}"));
  } catch (error: any) {
    console.error("Lesson gen error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Image
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1K", aspectRatio = "16:9" } = req.body;
    const interaction = await ai.interactions.create({
      model: "gemini-3-pro-image",
      input: prompt,
      response_modalities: ['image'],
      generation_config: {
        image_config: {
          aspect_ratio: aspectRatio,
          image_size: size
        }
      }
    });
    
    let imageUrl = null;
    if (interaction.steps) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output') {
            const imageContent = step.content?.find(c => c.type === 'image');
            if (imageContent && imageContent.data) {
              const base64EncodeString: string = imageContent.data;
              const mimeType = imageContent.mime_type || 'image/png';
              imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
              break;
            }
          }
        }
    }
    
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image gen error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Generate Video Start
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio = "16:9" } = req.body;
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });
    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Video gen start error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Video Poll Status
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done });
  } catch (error: any) {
    console.error("Video poll error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Video Download
app.get("/api/video-download", async (req, res) => {
  try {
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
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
    });
    
    res.setHeader('Content-Type', 'video/mp4');
    videoRes.body!.pipeTo(
      new WritableStream({
        write(chunk) { res.write(chunk); },
        close() { res.end(); },
      })
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
