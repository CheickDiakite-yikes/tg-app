export interface Slide {
  id: string;
  text: string;
  imagePrompt: string;
  mediaType: "image" | "video";
  mediaUrl?: string; // URL when generated
  isLoading?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  slides: Slide[];
}
