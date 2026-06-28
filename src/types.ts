export type MediaStatus = "idle" | "queued" | "generating" | "polling" | "ready" | "error";

export type ViewMode = "slideshow" | "showtime";

export interface ComfortSettings {
  captions: boolean;
  largeText: boolean;
  calmMotion: boolean;
  ttsRate: number;
  autoplay: boolean;
}

export interface Slide {
  id: string;
  text: string;
  narration?: string;
  imagePrompt: string;
  videoPrompt?: string;
  mediaType: "image" | "video";
  mediaUrl?: string; // URL when generated
  isLoading?: boolean;
  mediaStatus?: MediaStatus;
  mediaProgress?: string;
  mediaError?: string;
  operationName?: string;
  teacherNote?: string;
  interactionCue?: string;
  sensoryGoal?: string;
  safetyNotes?: string[];
}

export interface Lesson {
  id: string;
  title: string;
  objective?: string;
  audience?: string;
  sensoryNotes?: string[];
  estimatedDuration?: string;
  agentSummary?: string;
  slides: Slide[];
}
