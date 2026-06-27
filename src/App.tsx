import React, { useState, useEffect } from 'react';
import { Leaf, Bell, Sparkles, Play, Presentation } from 'lucide-react';
import Carousel from './components/Carousel';
import CreateModal from './components/CreateModal';
import { Lesson, Slide } from './types';
import { cn } from './lib/utils';

// Helper to poll video status
async function pollVideo(operationName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });
        const data = await res.json();
        
        if (data.done) {
          // It's done, let's get the download URL. Wait, the download URL is retrieved by hitting /api/video-download but that streams the video.
          // In a real app we'd return a URL to the stream. Since we have a backend streaming it, we can just use the download endpoint directly in the video src!
          // We can construct a blob URL or just use the endpoint with query params. Let's just return a generic endpoint path and we'll attach the operationName.
          resolve(`/api/video-download?op=${encodeURIComponent(operationName)}`);
        } else {
          setTimeout(check, 5000);
        }
      } catch (err) {
        reject(err);
      }
    };
    check();
  });
}

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [viewMode, setViewMode] = useState<'slideshow' | 'showtime'>('slideshow');

  // Initial mockup lesson
  useEffect(() => {
    setActiveLesson({
      id: 'initial',
      title: 'Classroom Habits',
      slides: [
        {
          id: 's1',
          text: 'I can raise my hand and ask for help.',
          imagePrompt: '',
          mediaType: 'image',
          mediaUrl: 'https://picsum.photos/seed/school/1024/768',
          isLoading: false
        },
        {
          id: 's2',
          text: 'We take breaks when we need to.',
          imagePrompt: '',
          mediaType: 'image',
          mediaUrl: 'https://picsum.photos/seed/break/1024/768',
          isLoading: false
        },
        {
          id: 's3',
          text: 'Sharing makes everyone happy.',
          imagePrompt: '',
          mediaType: 'image',
          mediaUrl: 'https://picsum.photos/seed/share/1024/768',
          isLoading: false
        }
      ]
    });
  }, []);

  const handleLessonCreated = (lesson: Lesson, size: string, ratio: string) => {
    setActiveLesson(lesson);
    
    // Process media generation for each slide
    lesson.slides.forEach(async (slide) => {
      try {
        if (slide.mediaType === 'image') {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: slide.imagePrompt, size: size, aspectRatio: ratio })
          });
          const data = await res.json();
          if (data.imageUrl) {
            updateSlideMedia(lesson.id, slide.id, data.imageUrl);
          }
        } else {
          // Video
          const res = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: slide.imagePrompt, aspectRatio: ratio })
          });
          const data = await res.json();
          if (data.operationName) {
            const videoUrl = await pollVideo(data.operationName);
            updateSlideMedia(lesson.id, slide.id, videoUrl);
          }
        }
      } catch (err) {
        console.error("Failed to generate media for slide", slide.id, err);
        // Fallback image
        updateSlideMedia(lesson.id, slide.id, `https://picsum.photos/seed/${slide.id}/1024/768`);
      }
    });
  };

  const updateSlideMedia = (lessonId: string, slideId: string, url: string) => {
    setActiveLesson(prev => {
      if (!prev || prev.id !== lessonId) return prev;
      return {
        ...prev,
        slides: prev.slides.map(s => 
          s.id === slideId ? { ...s, mediaUrl: url, isLoading: false } : s
        )
      };
    });
  };

  return (
    <div className="min-h-screen bg-bg-card flex flex-col font-sans selection:bg-brand-primary selection:text-white">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-12">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="bg-brand-primary p-2 rounded-xl text-white">
            <Leaf size={24} />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-brand-dark">StoryBridge</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-3 bg-white rounded-full text-brand-text hover:bg-brand-light transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform">
            <img src="https://picsum.photos/seed/avatar/200/200" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center py-8 relative">
        <Carousel slides={activeLesson?.slides || []} />
        
        {/* Creation Hint */}
        <div className="absolute bottom-32 sm:bottom-28 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md px-6 py-3 rounded-full shadow-lg transform translate-y-6">
            <div>
              <p className="font-bold text-brand-text text-sm">Create anything with AI</p>
              <p className="text-xs text-brand-text/60">Chat, generate, and customize visual lessons in seconds.</p>
            </div>
            <Sparkles size={16} className="text-brand-primary" />
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 left-0 right-0 flex justify-center z-30">
        <button 
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(50);
            setIsModalOpen(true);
          }}
          className="w-20 h-20 bg-brand-primary hover:bg-brand-dark text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(89,123,101,0.4)] transition-all hover:scale-110 active:scale-95 group border-4 border-white"
        >
          <span className="text-4xl font-light group-hover:rotate-90 transition-transform duration-300">+</span>
        </button>
      </div>

      {/* Footer Toggle */}
      <footer className="h-24 flex items-end justify-center pb-6">
        <div className="bg-white rounded-full p-1.5 shadow-md flex items-center gap-2 border border-brand-primary/10">
          <button 
            onClick={() => setViewMode('slideshow')}
            className={cn(
              "px-6 py-2.5 rounded-full flex items-center gap-2 font-bold text-sm transition-all",
              viewMode === 'slideshow' ? "bg-brand-light text-brand-dark" : "text-brand-text/60 hover:text-brand-text"
            )}
          >
            <Presentation size={18} />
            Slide Show
          </button>
          <button 
            onClick={() => setViewMode('showtime')}
            className={cn(
              "px-6 py-2.5 rounded-full flex items-center gap-2 font-bold text-sm transition-all",
              viewMode === 'showtime' ? "bg-brand-light text-brand-dark" : "text-brand-text/60 hover:text-brand-text"
            )}
          >
            <Play size={18} />
            Show Time
          </button>
        </div>
      </footer>

      <CreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onLessonCreated={handleLessonCreated}
      />
    </div>
  );
}
