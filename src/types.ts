export interface Slide {
  id: string;
  text: string;
  narration?: string;
  imagePrompt: string;
  videoPrompt?: string;
  mediaType: "image" | "video";
  mediaUrl?: string; // URL when generated
  isLoading?: boolean;
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
