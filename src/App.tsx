import React, { useState, useEffect } from 'react';
import { BookOpen, Clock3, Leaf, Bell, Sparkles, Play, Presentation, X } from 'lucide-react';
import Carousel from './components/Carousel';
import CreateModal from './components/CreateModal';
import { Lesson, Slide } from './types';
import { cn } from './lib/utils';

const SAVED_LESSON_KEY = 'storybridge.savedLesson.v1';
const SAVED_LIBRARY_KEY = 'storybridge.lessonLibrary.v1';
const SAVED_LIBRARY_DB = 'storybridge.lessonLibrary.db';
const SAVED_LIBRARY_STORE = 'lessons';

type SavedLesson = Lesson & {
  savedAt?: string;
};

const toSvgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const starterVisuals = {
  help: toSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576">
      <defs>
        <linearGradient id="wall" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff7e8"/>
          <stop offset="1" stop-color="#eef7ef"/>
        </linearGradient>
        <linearGradient id="rug" x1="0" x2="1">
          <stop offset="0" stop-color="#d9ebee"/>
          <stop offset="1" stop-color="#f4e7c8"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#wall)"/>
      <path d="M0 414h1024v162H0z" fill="url(#rug)"/>
      <rect x="78" y="78" width="178" height="214" rx="18" fill="#d9eef1"/>
      <path d="M102 95h130v176H102z" fill="#f8fdff"/>
      <path d="M168 95v176M102 184h130" stroke="#c6dfe3" stroke-width="8"/>
      <rect x="684" y="146" width="200" height="286" rx="24" fill="#e6bd82" opacity=".65"/>
      <rect x="713" y="187" width="142" height="60" rx="12" fill="#f7e8c7"/>
      <rect x="713" y="285" width="142" height="86" rx="14" fill="#b6d2b6"/>
      <ellipse cx="780" cy="470" rx="228" ry="36" fill="#d8c2a1" opacity=".45"/>
      <rect x="438" y="415" width="315" height="45" rx="18" fill="#b97b48"/>
      <rect x="470" y="386" width="248" height="48" rx="18" fill="#d7a36d"/>
      <circle cx="598" cy="241" r="74" fill="#c9835b"/>
      <path d="M539 241c18-76 116-94 154-29 2-65-39-103-103-101-55 1-101 44-101 101 0 17 5 29 12 39 10-7 23-10 38-10z" fill="#523724"/>
      <circle cx="568" cy="247" r="10" fill="#193845"/>
      <circle cx="631" cy="247" r="10" fill="#193845"/>
      <path d="M576 286c24 16 47 16 70 0" fill="none" stroke="#815336" stroke-width="7" stroke-linecap="round"/>
      <path d="M502 414c20-82 51-123 93-123h28c56 0 96 45 112 123z" fill="#5d8a68"/>
      <path d="M675 345c40-18 63-58 70-119" fill="none" stroke="#5d8a68" stroke-width="44" stroke-linecap="round"/>
      <path d="M734 219c14-35 15-77 1-121" fill="none" stroke="#c9835b" stroke-width="30" stroke-linecap="round"/>
      <path d="M760 155c15-23 19-46 12-70" fill="none" stroke="#c9835b" stroke-width="18" stroke-linecap="round"/>
      <path d="M724 148c4-30 0-55-11-77" fill="none" stroke="#c9835b" stroke-width="18" stroke-linecap="round"/>
      <path d="M691 157c-6-27-16-48-31-63" fill="none" stroke="#c9835b" stroke-width="18" stroke-linecap="round"/>
      <path d="M464 430h318" stroke="#825a3d" stroke-width="8" stroke-linecap="round"/>
      <text x="76" y="172" font-family="Nunito, Arial, sans-serif" font-size="50" font-weight="800" fill="#193845">
        <tspan x="76" dy="0">I can raise</tspan>
        <tspan x="76" dy="62">my hand and</tspan>
        <tspan x="76" dy="62">ask for help.</tspan>
      </text>
    </svg>
  `),
  break: toSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576">
      <defs>
        <linearGradient id="room" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff9ed"/>
          <stop offset="1" stop-color="#eef5ed"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#room)"/>
      <path d="M0 414h1024v162H0z" fill="#dfeef0"/>
      <ellipse cx="690" cy="440" rx="235" ry="86" fill="#c5d8b7"/>
      <ellipse cx="704" cy="404" rx="158" ry="123" fill="#8fb381"/>
      <path d="M612 409c70 34 139 34 208 0" fill="none" stroke="#789c6e" stroke-width="22" stroke-linecap="round"/>
      <circle cx="348" cy="259" r="74" fill="#b87555"/>
      <path d="M292 244c15-62 100-81 140-28 5-55-31-91-88-91-61 0-105 45-105 102 0 19 5 34 15 47 9-19 21-29 38-30z" fill="#4c3526"/>
      <circle cx="321" cy="265" r="9" fill="#193845"/>
      <circle cx="377" cy="265" r="9" fill="#193845"/>
      <path d="M325 303c19 13 40 13 59 0" fill="none" stroke="#774d36" stroke-width="7" stroke-linecap="round"/>
      <path d="M265 427c12-81 47-128 96-128h11c49 0 85 47 96 128z" fill="#6f97a9"/>
      <path d="M218 423c56 35 120 51 191 48 69-2 125-19 169-51" fill="none" stroke="#d9b27b" stroke-width="42" stroke-linecap="round"/>
      <rect x="112" y="118" width="150" height="168" rx="24" fill="#d5ecef"/>
      <path d="M139 144h96v116h-96z" fill="#fbffff"/>
      <path d="M187 144v116M139 202h96" stroke="#c3dde0" stroke-width="8"/>
      <rect x="780" y="126" width="106" height="190" rx="20" fill="#dfb77a"/>
      <path d="M798 245c42-58 75-58 110 0" fill="#7ca071"/>
      <path d="M820 246c-7-54 6-93 39-117M852 250c12-52 40-84 83-96" stroke="#7ca071" stroke-width="16" stroke-linecap="round"/>
      <ellipse cx="195" cy="452" rx="96" ry="22" fill="#ccd7c8"/>
      <text x="76" y="164" font-family="Nunito, Arial, sans-serif" font-size="48" font-weight="800" fill="#193845">
        <tspan x="76" dy="0">We take</tspan>
        <tspan x="76" dy="60">breaks when</tspan>
        <tspan x="76" dy="60">we need to.</tspan>
      </text>
    </svg>
  `),
  share: toSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576">
      <defs>
        <linearGradient id="soft" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff5e6"/>
          <stop offset="1" stop-color="#edf6f2"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#soft)"/>
      <rect y="408" width="1024" height="168" fill="#e7eef1"/>
      <ellipse cx="560" cy="470" rx="326" ry="54" fill="#d8c6a5" opacity=".45"/>
      <rect x="364" y="344" width="312" height="78" rx="22" fill="#c88c58"/>
      <rect x="391" y="318" width="258" height="56" rx="18" fill="#e0af77"/>
      <rect x="462" y="270" width="48" height="48" rx="8" fill="#8cb57f"/>
      <rect x="522" y="266" width="48" height="52" rx="8" fill="#e7c46d"/>
      <rect x="492" y="218" width="50" height="50" rx="9" fill="#87b6c5"/>
      <circle cx="319" cy="243" r="63" fill="#bd7b5b"/>
      <path d="M266 242c16-60 95-76 129-27 1-57-34-89-87-87-54 1-96 43-96 96 0 17 5 31 14 43 8-15 21-24 40-25z" fill="#553827"/>
      <circle cx="296" cy="254" r="8" fill="#193845"/>
      <circle cx="346" cy="254" r="8" fill="#193845"/>
      <path d="M302 288c17 11 35 11 53 0" fill="none" stroke="#7a4e36" stroke-width="6" stroke-linecap="round"/>
      <path d="M239 393c17-67 49-101 97-101s81 34 99 101z" fill="#5d8a68"/>
      <path d="M401 337c45-14 80-36 103-66" fill="none" stroke="#bd7b5b" stroke-width="24" stroke-linecap="round"/>
      <circle cx="718" cy="241" r="65" fill="#c48664"/>
      <path d="M659 236c20-58 102-72 136-17 5-62-34-96-91-93-55 3-94 47-91 101 1 14 5 27 12 37 8-16 19-25 34-28z" fill="#4f3322"/>
      <circle cx="695" cy="253" r="8" fill="#193845"/>
      <circle cx="746" cy="253" r="8" fill="#193845"/>
      <path d="M698 288c18 11 37 11 56 0" fill="none" stroke="#7a4e36" stroke-width="6" stroke-linecap="round"/>
      <path d="M624 396c14-69 48-105 100-105s86 36 101 105z" fill="#6f97a9"/>
      <path d="M654 337c-44-14-78-36-101-66" fill="none" stroke="#c48664" stroke-width="24" stroke-linecap="round"/>
      <rect x="122" y="98" width="138" height="180" rx="26" fill="#d8ecea"/>
      <path d="M150 130h82v117h-82z" fill="#fcffff"/>
      <path d="M191 130v117M150 190h82" stroke="#c6dfe0" stroke-width="8"/>
      <text x="76" y="160" font-family="Nunito, Arial, sans-serif" font-size="46" font-weight="800" fill="#193845">
        <tspan x="76" dy="0">I can share</tspan>
        <tspan x="76" dy="58">when I am</tspan>
        <tspan x="76" dy="58">ready.</tspan>
      </text>
    </svg>
  `),
  teacher: toSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="80" fill="#f2dec0"/>
      <circle cx="80" cy="69" r="34" fill="#9d6a4e"/>
      <path d="M43 70c7-31 29-49 61-38 20 7 32 23 34 46-18-20-45-24-82-11-5 2-9 3-13 3z" fill="#3c2a20"/>
      <circle cx="68" cy="74" r="5" fill="#193845"/>
      <circle cx="93" cy="74" r="5" fill="#193845"/>
      <path d="M70 94c8 5 17 5 26 0" fill="none" stroke="#724a35" stroke-width="5" stroke-linecap="round"/>
      <path d="M31 160c9-38 28-58 57-58h8c29 0 48 20 57 58z" fill="#597B65"/>
      <path d="M56 105c14 13 31 13 47 0" fill="none" stroke="#f4d1aa" stroke-width="10" stroke-linecap="round"/>
    </svg>
  `),
};

const createStarterLesson = (): Lesson => ({
  id: 'initial',
  title: 'Classroom Habits',
  slides: [
    {
      id: 's1',
      text: 'I can raise my hand and ask for help.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.help,
      isLoading: false
    },
    {
      id: 's2',
      text: 'We take breaks when we need to.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.break,
      isLoading: false
    },
    {
      id: 's3',
      text: 'I can share when I am ready.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.share,
      isLoading: false
    }
  ]
});

const isGeneratedLessonReady = (lesson?: Lesson | null) => {
  if (!lesson || lesson.id === 'initial') return false;
  const mediaComplete = lesson.slides.every(slide => !slide.isLoading);
  const hasGeneratedMedia = lesson.slides.some(slide => Boolean(slide.mediaUrl));
  return mediaComplete && hasGeneratedMedia;
};

const compactMediaUrl = (mediaUrl?: string) => {
  if (!mediaUrl) return undefined;
  if (mediaUrl.startsWith('data:') && mediaUrl.length > 120_000) return undefined;
  return mediaUrl.length > 240_000 ? undefined : mediaUrl;
};

const compactLessonForLocalStorage = (lesson: SavedLesson): SavedLesson => ({
  ...lesson,
  slides: lesson.slides.map(slide => ({
    ...slide,
    mediaUrl: compactMediaUrl(slide.mediaUrl),
  })),
});

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Could not write ${key}`, err);
    try {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.warn(`Could not rewrite ${key}`, retryErr);
      return false;
    }
  }
};

const openSavedLessonDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(SAVED_LIBRARY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVED_LIBRARY_STORE)) {
        db.createObjectStore(SAVED_LIBRARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open StoryBridge library.'));
  });

const readSavedLibraryFromIndexedDb = async (): Promise<SavedLesson[]> => {
  try {
    const db = await openSavedLessonDb();
    const lessons = await new Promise<SavedLesson[]>((resolve, reject) => {
      const transaction = db.transaction(SAVED_LIBRARY_STORE, 'readonly');
      const request = transaction.objectStore(SAVED_LIBRARY_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []) as SavedLesson[]);
      request.onerror = () => reject(request.error);
    });
    db.close();

    return lessons
      .filter((lesson): lesson is SavedLesson =>
        Boolean(lesson?.id && Array.isArray(lesson.slides) && lesson.slides.length),
      )
      .sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())
      .slice(0, 20);
  } catch (err) {
    console.warn('Could not load StoryBridge IndexedDB library', err);
    return [];
  }
};

const writeSavedLibraryToIndexedDb = async (lessons: SavedLesson[]) => {
  try {
    const db = await openSavedLessonDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SAVED_LIBRARY_STORE, 'readwrite');
      const store = transaction.objectStore(SAVED_LIBRARY_STORE);
      store.clear();
      lessons.slice(0, 20).forEach(lesson => store.put(lesson));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  } catch (err) {
    console.warn('Could not save StoryBridge IndexedDB library', err);
  }
};

const readSavedLibrary = (): SavedLesson[] => {
  try {
    const raw = window.localStorage.getItem(SAVED_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((lesson): lesson is SavedLesson =>
        Boolean(lesson?.id && Array.isArray(lesson.slides) && lesson.slides.length),
      )
      .slice(0, 20);
  } catch (err) {
    console.warn('Could not load StoryBridge library', err);
    return [];
  }
};

const writeSavedLibrary = (lessons: SavedLesson[]) => {
  const trimmed = lessons.slice(0, 20);
  void writeSavedLibraryToIndexedDb(trimmed);

  const compact = trimmed.map(compactLessonForLocalStorage);
  const didWrite = safeSetLocalStorage(SAVED_LIBRARY_KEY, JSON.stringify(compact));
  if (!didWrite) {
    try {
      window.localStorage.removeItem(SAVED_LESSON_KEY);
      safeSetLocalStorage(SAVED_LIBRARY_KEY, JSON.stringify(compact));
    } catch (err) {
      console.warn('Could not compact StoryBridge localStorage library', err);
    }
  }
};

const formatSavedAt = (value?: string) => {
  if (!value) return 'Saved recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const lessonThumb = (lesson: Lesson) =>
  lesson.slides.find(slide => Boolean(slide.mediaUrl))?.mediaUrl || starterVisuals.help;

// Helper to poll video status
async function pollVideo(operationName: string): Promise<string> {
  const maxAttempts = 36;
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        attempts += 1;
        const res = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Video status check failed');

        if (data.done && data.hasVideo) {
          resolve(`/api/video-download?op=${encodeURIComponent(operationName)}`);
        } else if (data.done) {
          reject(new Error('Video finished without a downloadable result.'));
        } else if (attempts >= maxAttempts) {
          reject(new Error('Video generation is still processing. Please try again shortly.'));
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const [viewMode, setViewMode] = useState<'slideshow' | 'showtime'>('slideshow');

  useEffect(() => {
    const library = readSavedLibrary();
    let nextLibrary = library;
    const hydrateFromIndexedDb = () => {
      void readSavedLibraryFromIndexedDb().then(indexedLibrary => {
        if (!indexedLibrary.length) return;
        setSavedLessons(indexedLibrary);
        setActiveLesson(currentLesson => {
          if (!currentLesson || currentLesson.id === 'initial') return indexedLibrary[0];
          const hydratedCurrentLesson = indexedLibrary.find(lesson => lesson.id === currentLesson.id);
          return hydratedCurrentLesson || currentLesson;
        });
        writeSavedLibrary(indexedLibrary);
      });
    };

    try {
      const savedLesson = window.localStorage.getItem(SAVED_LESSON_KEY);
      if (savedLesson) {
        const parsedLesson = JSON.parse(savedLesson) as Lesson;
        if (parsedLesson?.id && Array.isArray(parsedLesson.slides) && parsedLesson.slides.length) {
          if (isGeneratedLessonReady(parsedLesson) && !library.some(lesson => lesson.id === parsedLesson.id)) {
            nextLibrary = [{ ...parsedLesson, savedAt: new Date().toISOString() }, ...library].slice(0, 20);
            writeSavedLibrary(nextLibrary);
          }

          setSavedLessons(nextLibrary);
          setActiveLesson(nextLibrary[0] || parsedLesson);
          hydrateFromIndexedDb();
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load saved StoryBridge lesson', err);
    }

    setSavedLessons(nextLibrary);
    if (nextLibrary[0]) {
      setActiveLesson(nextLibrary[0]);
    } else {
      setActiveLesson(createStarterLesson());
    }

    hydrateFromIndexedDb();
  }, []);

  useEffect(() => {
    if (!isGeneratedLessonReady(activeLesson)) return;

    const compactActiveLesson = compactLessonForLocalStorage(activeLesson);
    const didWriteCurrentLesson = safeSetLocalStorage(SAVED_LESSON_KEY, JSON.stringify(compactActiveLesson));
    if (!didWriteCurrentLesson) {
      try {
        window.localStorage.removeItem(SAVED_LIBRARY_KEY);
        safeSetLocalStorage(SAVED_LESSON_KEY, JSON.stringify(compactActiveLesson));
      } catch (err) {
        console.warn('Could not compact StoryBridge current lesson', err);
      }
    }

    setSavedLessons(prev => {
      const existing = prev.find(lesson => lesson.id === activeLesson.id);
      const savedLesson: SavedLesson = {
        ...activeLesson,
        savedAt: existing?.savedAt || new Date().toISOString(),
      };
      const next = [
        savedLesson,
        ...prev.filter(lesson => lesson.id !== activeLesson.id),
      ].slice(0, 20);
      writeSavedLibrary(next);
      return next;
    });
  }, [activeLesson]);

  const openSavedLesson = (lesson: SavedLesson) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setActiveLesson(lesson);
    setViewMode(lesson.slides.some(slide => slide.mediaType === 'video') ? 'showtime' : 'slideshow');
    setIsProfileOpen(false);
  };

  const handleLessonCreated = (lesson: Lesson, size: string, ratio: string) => {
    setActiveLesson(lesson);
    
    // Process media generation for each slide
    lesson.slides.forEach(async (slide) => {
      try {
        if (slide.mediaType === 'image') {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: slide.imagePrompt,
              slideText: slide.text,
              size: size,
              aspectRatio: ratio
            })
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'Image generation failed');
          if (data.imageUrl) {
            updateSlideMedia(lesson.id, slide.id, data.imageUrl);
          }
        } else {
          // Video
          const res = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: slide.videoPrompt || slide.imagePrompt,
              slideText: slide.text,
              aspectRatio: ratio
            })
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'Video generation failed');
          if (data.operationName) {
            const videoUrl = await pollVideo(data.operationName);
            updateSlideMedia(lesson.id, slide.id, videoUrl);
          }
        }
      } catch (err) {
        console.error("Failed to generate media for slide", slide.id, err);
        clearSlideLoading(lesson.id, slide.id);
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

  const clearSlideLoading = (lessonId: string, slideId: string) => {
    setActiveLesson(prev => {
      if (!prev || prev.id !== lessonId) return prev;
      return {
        ...prev,
        slides: prev.slides.map(s =>
          s.id === slideId ? { ...s, isLoading: false } : s
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
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50);
              setIsProfileOpen(true);
            }}
            aria-label="Open teacher profile and saved slideshows"
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
          >
            <img src={starterVisuals.teacher} alt="Profile" className="w-full h-full object-cover" />
          </button>
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
          aria-label="Create lesson"
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

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Close profile"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsProfileOpen(false)}
          />
          <section className="relative flex h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:h-[78vh] sm:max-h-[760px] sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={starterVisuals.teacher}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-2xl border-2 border-bg-card object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-brand-dark">Teacher Library</p>
                  <p className="truncate text-xs font-bold text-brand-text/55">
                    {savedLessons.length
                      ? `${savedLessons.length} saved visual lesson${savedLessons.length === 1 ? '' : 's'}`
                      : 'Saved slideshows will appear here'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                aria-label="Close profile"
                className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
              >
                <X size={22} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {savedLessons.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedLessons.map(lesson => {
                    const isActive = lesson.id === activeLesson?.id;
                    const videoCount = lesson.slides.filter(slide => slide.mediaType === 'video').length;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => openSavedLesson(lesson)}
                        className={cn(
                          'group overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                          isActive ? 'border-brand-primary/35 ring-2 ring-brand-primary/10' : 'border-brand-primary/10',
                        )}
                      >
                        <div className="aspect-[16/9] bg-brand-light">
                          {lessonThumb(lesson)?.startsWith('/api/video-download') ? (
                            <video
                              src={lessonThumb(lesson)}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={lessonThumb(lesson)}
                              alt=""
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h2 className="line-clamp-2 text-base font-extrabold leading-tight text-brand-dark">
                                {lesson.title}
                              </h2>
                              {isActive && (
                                <span className="shrink-0 rounded-full bg-brand-light px-2 py-1 text-[10px] font-extrabold text-brand-dark">
                                  Open
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-brand-text/60">
                              {lesson.objective || lesson.slides[0]?.text || 'Visual classroom lesson'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-xs font-extrabold text-brand-text/55">
                            <span className="flex items-center gap-1.5">
                              <BookOpen size={14} />
                              {lesson.slides.length} slide{lesson.slides.length === 1 ? '' : 's'}
                              {videoCount ? ` · ${videoCount} video` : ''}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock3 size={14} />
                              {formatSavedAt(lesson.savedAt)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-brand-primary shadow-sm">
                    <BookOpen size={30} />
                  </div>
                  <h2 className="text-xl font-extrabold text-brand-dark">No saved slideshows yet</h2>
                  <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-brand-text/60">
                    Generate a lesson and StoryBridge will keep it here so you can reopen it from your profile.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="mt-5 rounded-full bg-brand-dark px-5 py-3 text-sm font-extrabold text-white shadow-md transition-transform active:scale-95"
                  >
                    Create a lesson
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
