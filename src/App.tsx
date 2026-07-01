import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell,
  BookOpen,
  Captions,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Leaf,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import Carousel from './components/Carousel';
import CreateModal from './components/CreateModal';
import { ComfortSettings, Lesson, Slide, ViewMode } from './types';
import { cn } from './lib/utils';

const SAVED_LESSON_KEY = 'storybridge.savedLesson.v1';
const SAVED_LIBRARY_KEY = 'storybridge.lessonLibrary.v1';
const SAVED_LIBRARY_DB = 'storybridge.lessonLibrary.db';
const SAVED_LIBRARY_STORE = 'lessons';

type SavedLesson = Lesson & {
  savedAt?: string;
};

type LibraryFilter = 'all' | 'slideshow' | 'showtime';
type AiStatus = {
  geminiConfigured: boolean;
  textGenerationReady: boolean;
  imageGenerationReady: boolean;
  videoGenerationReady: boolean;
  textModel: string;
  imageModel: string;
  videoModel: string;
};

const makeId = () => {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  return `storybridge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
  objective: 'Practice simple classroom routines with calm, visual language.',
  audience: 'K-2 autistic learners',
  estimatedDuration: '3-5 minutes',
  sensoryNotes: ['Use a calm pace and pause after each slide.', 'Offer pointing, speaking, typing, or gesturing as valid responses.'],
  agentSummary: 'A starter visual lesson with predictable classroom routines.',
  slides: [
    {
      id: 's1',
      text: 'I can raise my hand and ask for help.',
      narration: 'I can raise my hand and ask for help. A teacher can come over and listen.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.help,
      isLoading: false,
      mediaStatus: 'ready',
      teacherNote: 'Pause and let students identify one way to ask for help.',
      interactionCue: 'Invite a point, gesture, word, or typed response.',
      sensoryGoal: 'Keep attention on one clear action.',
      safetyNotes: [],
    },
    {
      id: 's2',
      text: 'We take breaks when we need to.',
      narration: 'We take breaks when we need to. A break can help our bodies feel ready.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.break,
      isLoading: false,
      mediaStatus: 'ready',
      teacherNote: 'Normalize breaks as a self-advocacy choice, not a reward or punishment.',
      interactionCue: 'Ask students to choose a break signal that works for them.',
      sensoryGoal: 'Support body awareness without pressure.',
      safetyNotes: [],
    },
    {
      id: 's3',
      text: 'I can share when I am ready.',
      narration: 'I can share when I am ready. I can use words, a gesture, or another way.',
      imagePrompt: '',
      mediaType: 'image',
      mediaUrl: starterVisuals.share,
      isLoading: false,
      mediaStatus: 'ready',
      teacherNote: 'Emphasize readiness and choice instead of forced participation.',
      interactionCue: 'Offer multiple communication modes for sharing.',
      sensoryGoal: 'Reduce social pressure and keep the scene predictable.',
      safetyNotes: [],
    }
  ]
});

const isGeneratedLessonReady = (lesson?: Lesson | null) => {
  if (!lesson || lesson.id === 'initial') return false;
  const mediaComplete = lesson.slides.every(slide =>
    !slide.isLoading && !['queued', 'generating', 'polling'].includes(slide.mediaStatus || ''),
  );
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
async function pollVideo(operationName: string, onProgress?: (message: string) => void): Promise<string> {
  const maxAttempts = 36;
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        attempts += 1;
        onProgress?.(`Rendering video ${attempts}/${maxAttempts}. This can take a few minutes.`);
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
  const [isComfortOpen, setIsComfortOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('slideshow');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [generationDefaults, setGenerationDefaults] = useState({ size: '1K', ratio: '16:9' });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCreateChoiceOpen, setIsCreateChoiceOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'new' | 'edit'>('new');
  const [createSourceLesson, setCreateSourceLesson] = useState<Lesson | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [hiddenCreateHintIds, setHiddenCreateHintIds] = useState<string[]>([]);
  const [comfort, setComfort] = useState<ComfortSettings>(() => ({
    captions: false,
    largeText: false,
    calmMotion:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ttsRate: 0.9,
    autoplay: false,
  }));

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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let isMounted = true;

    void fetch('/api/ai-status')
      .then(response => response.json())
      .then((status: AiStatus) => {
        if (isMounted) setAiStatus(status);
      })
      .catch(err => {
        console.warn('Could not load StoryBridge AI status', err);
      });

    return () => {
      isMounted = false;
    };
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
    setPendingDeleteId(null);
    setIsProfileOpen(false);
  };

  const humanizeMediaError = (err: unknown, mediaType: Slide['mediaType']) => {
    const message = err instanceof Error ? err.message : String(err || '');
    const lower = message.toLowerCase();

    if (lower.includes('api key') || lower.includes('gemini_api_key')) {
      return 'The Gemini key is needed before StoryBridge can create this visual.';
    }

    if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
      return 'Gemini quota is exhausted for this visual model. Check Google AI Studio billing and rate limits, then retry.';
    }

    if (
      lower.includes('failed to fetch') ||
      lower.includes('fetch failed') ||
      lower.includes('network') ||
      lower.includes('gemini_network_error')
    ) {
      return 'StoryBridge could not reach Gemini from the server. Check the server network, firewall, proxy, or VPN settings.';
    }

    if (lower.includes('rate')) {
      return 'Gemini is rate limiting this visual. Wait a moment, then retry.';
    }

    if (mediaType === 'video' && lower.includes('processing')) {
      return 'The video is still rendering. Retry will check the studio again.';
    }

    return message || 'StoryBridge could not finish this visual.';
  };

  const updateSlideState = (lessonId: string, slideId: string, patch: Partial<Slide>) => {
    setActiveLesson(prev => {
      if (!prev || prev.id !== lessonId) return prev;
      return {
        ...prev,
        slides: prev.slides.map(s =>
          s.id === slideId ? { ...s, ...patch } : s
        )
      };
    });
  };

  const updateSlideMedia = (lessonId: string, slideId: string, url: string) => {
    updateSlideState(lessonId, slideId, {
      mediaUrl: url,
      isLoading: false,
      mediaStatus: 'ready',
      mediaProgress: 'Ready',
      mediaError: undefined,
    });
  };

  const generateSlideMedia = async (lessonId: string, slide: Slide, size: string, ratio: string) => {
    try {
      updateSlideState(lessonId, slide.id, {
        isLoading: true,
        mediaStatus: 'generating',
        mediaProgress: slide.mediaType === 'video' ? 'Sending video request...' : 'Sending image request...',
        mediaError: undefined,
      });

      if (slide.mediaType === 'image') {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: slide.imagePrompt,
            slideText: slide.text,
            size,
            aspectRatio: ratio,
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Image generation failed');
        if (!data.imageUrl) throw new Error('Gemini did not return an image.');
        updateSlideMedia(lessonId, slide.id, data.imageUrl);
        return;
      }

      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: slide.videoPrompt || slide.imagePrompt,
          slideText: slide.text,
          aspectRatio: ratio,
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Video generation failed');
      if (!data.operationName) throw new Error('Video generation did not return an operation.');

      updateSlideState(lessonId, slide.id, {
        mediaStatus: 'polling',
        mediaProgress: 'Video accepted. Waiting for the render...',
        operationName: data.operationName,
      });

      const videoUrl = await pollVideo(data.operationName, message => {
        updateSlideState(lessonId, slide.id, {
          mediaStatus: 'polling',
          mediaProgress: message,
          operationName: data.operationName,
        });
      });
      updateSlideMedia(lessonId, slide.id, videoUrl);
    } catch (err) {
      console.error('Failed to generate media for slide', slide.id, err);
      updateSlideState(lessonId, slide.id, {
        isLoading: false,
        mediaStatus: 'error',
        mediaProgress: undefined,
        mediaError: humanizeMediaError(err, slide.mediaType),
      });
    }
  };

  const handleLessonCreated = (lesson: Lesson, size: string, ratio: string) => {
    setGenerationDefaults({ size, ratio });
    const nextLesson: Lesson = {
      ...lesson,
      slides: lesson.slides.map(slide => ({
        ...slide,
        isLoading: true,
        mediaStatus: 'queued',
        mediaProgress: slide.mediaType === 'video' ? 'Queued for video rendering.' : 'Queued for image generation.',
        mediaError: undefined,
      })),
    };
    setActiveLesson(nextLesson);
    setViewMode(nextLesson.slides.some(slide => slide.mediaType === 'video') ? 'showtime' : 'slideshow');

    nextLesson.slides.forEach(slide => {
      void generateSlideMedia(nextLesson.id, slide, size, ratio);
    });
  };

  const retrySlideMedia = (slideId: string) => {
    const slide = activeLesson?.slides.find(item => item.id === slideId);
    if (!activeLesson || !slide) return;
    if (navigator.vibrate) navigator.vibrate(50);
    void generateSlideMedia(activeLesson.id, slide, generationDefaults.size, generationDefaults.ratio);
  };

  const openCreateChoice = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPendingDeleteId(null);
    setIsCreateChoiceOpen(true);
  };

  const openNewCreateAgent = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPendingDeleteId(null);
    setCreateMode('new');
    setCreateSourceLesson(null);
    setIsCreateChoiceOpen(false);
    setIsModalOpen(true);
  };

  const openEditCreateAgent = (lesson: Lesson) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPendingDeleteId(null);
    setCreateMode('edit');
    setCreateSourceLesson(lesson);
    setIsCreateChoiceOpen(false);
    setIsModalOpen(true);
    setIsProfileOpen(false);
  };

  const openCreateForActiveLesson = () => {
    if (!activeLesson) return;
    setHiddenCreateHintIds(prev => (prev.includes(activeLesson.id) ? prev : [...prev, activeLesson.id]));
    openEditCreateAgent(activeLesson);
  };

  const duplicateLesson = (lesson: SavedLesson) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const duplicated: SavedLesson = {
      ...lesson,
      id: makeId(),
      title: `${lesson.title} copy`,
      savedAt: new Date().toISOString(),
      slides: lesson.slides.map(slide => ({ ...slide, id: makeId() })),
    };
    setSavedLessons(prev => {
      const next = [duplicated, ...prev].slice(0, 20);
      writeSavedLibrary(next);
      return next;
    });
    setActiveLesson(duplicated);
    setViewMode(duplicated.slides.some(slide => slide.mediaType === 'video') ? 'showtime' : 'slideshow');
    setIsProfileOpen(false);
    setPendingDeleteId(null);
    setNotice(`Duplicated "${lesson.title}".`);
  };

  const deleteLesson = (lessonId: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    if (pendingDeleteId !== lessonId) {
      setPendingDeleteId(lessonId);
      setNotice('Tap confirm delete to remove this lesson.');
      return;
    }

    setSavedLessons(prev => {
      const removedLesson = prev.find(lesson => lesson.id === lessonId);
      const next = prev.filter(lesson => lesson.id !== lessonId);
      writeSavedLibrary(next);
      if (activeLesson?.id === lessonId) {
        setActiveLesson(next[0] || createStarterLesson());
        setViewMode(next[0]?.slides.some(slide => slide.mediaType === 'video') ? 'showtime' : 'slideshow');
      }
      setNotice(removedLesson ? `Deleted "${removedLesson.title}".` : 'Deleted lesson.');
      return next;
    });
    setPendingDeleteId(null);
  };

  const exportLesson = (lesson: SavedLesson) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'storybridge-lesson'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported "${lesson.title}".`);
  };

  const copyLessonSummary = async (lesson: SavedLesson) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const summary = [
      lesson.title,
      lesson.objective,
      `${lesson.slides.length} slides`,
      ...lesson.slides.map((slide, index) => `${index + 1}. ${slide.text}`),
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard?.writeText(summary);
      setNotice(`Copied summary for "${lesson.title}".`);
    } catch (err) {
      console.warn('Could not copy StoryBridge lesson summary', err);
      setNotice('Could not copy summary. You can still export the lesson.');
    }
  };

  const activeMediaJobs = useMemo(
    () =>
      (activeLesson?.slides || [])
        .map((slide, index) => ({ slide, slideNumber: index + 1 }))
        .filter(item => ['queued', 'generating', 'polling', 'error'].includes(item.slide.mediaStatus || '')),
    [activeLesson?.slides],
  );

  const filteredSavedLessons = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return savedLessons.filter(lesson => {
      const isVideoLesson = lesson.slides.some(slide => slide.mediaType === 'video');
      if (libraryFilter === 'slideshow' && isVideoLesson) return false;
      if (libraryFilter === 'showtime' && !isVideoLesson) return false;
      if (!query) return true;

      return [
        lesson.title,
        lesson.objective,
        lesson.audience,
        lesson.agentSummary,
        ...lesson.slides.map(slide => slide.text),
      ].filter(Boolean).some(value => value!.toLowerCase().includes(query));
    });
  }, [libraryFilter, libraryQuery, savedLessons]);

  const completionCount = activeLesson?.slides.filter(slide => slide.mediaStatus === 'ready' || slide.mediaUrl).length || 0;
  const totalSlides = activeLesson?.slides.length || 0;
  const activeLessonHasVideo = activeLesson?.slides.some(slide => slide.mediaType === 'video') || false;
  const canEditActiveLesson = Boolean(activeLesson && activeLesson.id !== 'initial' && activeLesson.slides.length > 0);
  const showCreateHint =
    Boolean(activeLesson && activeLesson.id !== 'initial' && totalSlides > 0) &&
    !hiddenCreateHintIds.includes(activeLesson!.id);

  return (
    <div className="min-h-screen bg-bg-card flex flex-col font-sans selection:bg-brand-primary selection:text-white">
      
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-3 max-[360px]:px-2 sm:px-12 sm:py-5">
        <div className="flex min-w-0 items-center gap-2 cursor-pointer sm:gap-3">
          <div className="shrink-0 rounded-xl bg-brand-primary p-1.5 text-white max-[360px]:rounded-lg max-[360px]:p-1.5 sm:p-2">
            <Leaf size={22} className="max-[360px]:h-5 max-[360px]:w-5" />
          </div>
          <span className="truncate text-lg font-extrabold tracking-tight text-brand-dark max-[360px]:hidden sm:text-2xl">StoryBridge</span>
        </div>
        
        <div className="flex shrink-0 items-center gap-2 max-[360px]:gap-1.5 sm:gap-4">
          <button
            type="button"
            onClick={openCreateChoice}
            aria-label="Create lesson"
            className="hidden items-center gap-2 rounded-full bg-brand-primary px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-transform active:scale-95 sm:inline-flex"
          >
            <Plus size={18} />
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50);
              setIsActivityOpen(true);
            }}
            aria-label="Open generation activity"
            className="relative rounded-full bg-white p-2 text-brand-text transition-colors hover:bg-brand-light max-[360px]:p-1.5 sm:p-3"
          >
            <Bell size={20} className="max-[360px]:h-[18px] max-[360px]:w-[18px]" />
            {activeMediaJobs.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50);
              setIsComfortOpen(true);
            }}
            aria-label="Open comfort controls"
            className="rounded-full bg-white p-2 text-brand-text transition-colors hover:bg-brand-light max-[360px]:p-1.5 sm:p-3"
          >
            <SlidersHorizontal size={20} className="max-[360px]:h-[18px] max-[360px]:w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50);
              setIsProfileOpen(true);
            }}
            aria-label="Open teacher profile and saved slideshows"
            className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-sm transition-transform hover:scale-105 max-[360px]:h-9 max-[360px]:w-9 sm:h-12 sm:w-12"
          >
            <img src={starterVisuals.teacher} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col justify-center gap-2 py-1 sm:gap-5 sm:py-5">
        {activeLesson && (
          <section className="mx-auto w-full max-w-6xl px-5 sm:px-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-xl font-extrabold leading-tight text-brand-dark sm:text-2xl">
                    {activeLesson.title}
                  </h1>
                    {activeLesson.id !== 'initial' && (
                    <button
                      type="button"
                      onClick={() => openEditCreateAgent(activeLesson)}
                      className="shrink-0 rounded-full bg-white p-2 text-brand-primary shadow-sm transition-transform active:scale-95 max-[360px]:hidden"
                      aria-label="Revise this lesson with the agent"
                    >
                      <Wand2 size={15} />
                    </button>
                  )}
                </div>
                <p className={cn(
                  'mt-1 line-clamp-2 max-w-2xl text-sm font-semibold leading-snug text-brand-text/65 max-[360px]:hidden',
                  viewMode === 'showtime' && 'hidden sm:block',
                )}>
                  {activeLesson.objective || activeLesson.agentSummary || 'A calm visual lesson for classroom learning.'}
                </p>
              </div>
              <div className={cn(
                'flex shrink-0 flex-wrap gap-2 text-xs font-extrabold text-brand-text/60 max-[360px]:hidden',
                viewMode === 'showtime' && 'hidden min-[430px]:flex',
              )}>
                {activeLesson.audience && <span className="rounded-full bg-white px-3 py-2 shadow-sm">{activeLesson.audience}</span>}
                {activeLesson.estimatedDuration && <span className="rounded-full bg-white px-3 py-2 shadow-sm">{activeLesson.estimatedDuration}</span>}
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                  {completionCount}/{totalSlides} ready
                </span>
              </div>
            </div>
          </section>
        )}

        <Carousel
          lesson={activeLesson}
          viewMode={viewMode}
          comfort={comfort}
          onRetryMedia={retrySlideMedia}
        />
        
        {showCreateHint && activeLesson && (
          <div className="absolute bottom-3 left-4 right-4 z-20 flex justify-center sm:left-auto sm:right-8 sm:justify-end">
            <div className="w-full max-w-sm rounded-[1.4rem] border border-brand-primary/10 bg-white/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
                  <Sparkles size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-brand-dark">Want to change this?</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-brand-text/65">
                    Use Create to edit this lesson or choose Show Time Video for a video version.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openCreateForActiveLesson}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-3 py-2 text-xs font-extrabold text-white transition-transform active:scale-95"
                    >
                      <Wand2 size={14} />
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHiddenCreateHintIds(prev => (prev.includes(activeLesson.id) ? prev : [...prev, activeLesson.id]))
                      }
                      className="rounded-full bg-brand-light px-3 py-2 text-xs font-extrabold text-brand-dark transition-colors hover:bg-brand-primary/10"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Toggle */}
      <footer className={cn(
        'flex items-end justify-center',
        viewMode === 'showtime' ? 'h-16 pb-3' : 'h-24 pb-6 max-[360px]:h-14 max-[360px]:pb-1',
      )}>
        <div className="flex items-center gap-2 rounded-full border border-brand-primary/10 bg-white p-1.5 shadow-md max-[360px]:gap-1 max-[360px]:p-1">
          <button 
            onClick={() => setViewMode('slideshow')}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all max-[430px]:gap-1 max-[430px]:px-3 max-[360px]:px-2.5 max-[360px]:py-2 max-[360px]:text-xs sm:px-6",
              viewMode === 'slideshow' ? "bg-brand-light text-brand-dark" : "text-brand-text/60 hover:text-brand-text"
            )}
          >
            <Presentation size={18} />
            Slide Show
          </button>
          {viewMode === 'slideshow' && (
            <button
              type="button"
              onClick={openCreateChoice}
              aria-label="Create lesson"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm transition-transform active:scale-95 max-[360px]:h-10 max-[360px]:w-10 sm:hidden"
            >
              <Plus size={22} />
            </button>
          )}
          <button 
            onClick={() => {
              if (activeLessonHasVideo) {
                setViewMode('showtime');
                return;
              }
              setNotice('Use Create to make a Show Time video version.');
            }}
            aria-disabled={!activeLessonHasVideo}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all max-[430px]:gap-1 max-[430px]:px-3 max-[360px]:px-2.5 max-[360px]:py-2 max-[360px]:text-xs sm:px-6",
              viewMode === 'showtime'
                ? "bg-brand-light text-brand-dark"
                : activeLessonHasVideo
                  ? "text-brand-text/60 hover:text-brand-text"
                  : "text-brand-text/35 hover:text-brand-text/60"
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
        mode={createMode}
        sourceLesson={createSourceLesson}
      />

      {isCreateChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Dismiss create choices"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsCreateChoiceOpen(false)}
          />
          <section className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-brand-dark">Create</p>
                <p className="text-xs font-bold text-brand-text/55">Start fresh or work from the open lesson.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateChoiceOpen(false)}
                aria-label="Close create choices"
                className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
              >
                <X size={22} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <button
                type="button"
                onClick={() => activeLesson && openEditCreateAgent(activeLesson)}
                disabled={!canEditActiveLesson}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[1.4rem] border px-4 py-4 text-left shadow-sm transition-all active:scale-[0.99]',
                  canEditActiveLesson
                    ? 'border-brand-primary/10 bg-white hover:border-brand-primary/30 hover:shadow-md'
                    : 'cursor-not-allowed border-brand-primary/5 bg-white/55 opacity-55',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
                  <Wand2 size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-brand-dark">Edit current lesson</span>
                  <span className="mt-1 block text-xs font-semibold leading-relaxed text-brand-text/60">
                    {canEditActiveLesson
                      ? `Revise "${activeLesson?.title}" or make a video version.`
                      : 'Generate a lesson first, then this option will turn on.'}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={openNewCreateAgent}
                className="flex w-full items-start gap-3 rounded-[1.4rem] border border-brand-primary/10 bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-brand-primary/30 hover:shadow-md active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-white">
                  <Plus size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-brand-dark">Create something new</span>
                  <span className="mt-1 block text-xs font-semibold leading-relaxed text-brand-text/60">
                    Start with a new slideshow, Show Time video, or both.
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-3xl border border-brand-primary/10 bg-white px-4 py-3 text-sm font-extrabold text-brand-dark shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-brand-primary" />
            <span className="min-w-0">{notice}</span>
          </div>
        </div>
      )}

      {isComfortOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Dismiss comfort backdrop"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsComfortOpen(false)}
          />
          <section className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-5 py-4">
              <div>
                <p className="text-lg font-extrabold text-brand-dark">Comfort Controls</p>
                <p className="text-xs font-bold text-brand-text/55">Keep viewing calm and readable.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsComfortOpen(false)}
                aria-label="Close comfort controls"
                className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
              >
                <X size={22} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {[
                {
                  key: 'captions',
                  icon: Captions,
                  title: 'Captions',
                  detail: 'Show narration below each visual.',
                },
                {
                  key: 'largeText',
                  icon: Type,
                  title: 'Larger transcript',
                  detail: 'Increase caption size for shared viewing.',
                },
                {
                  key: 'calmMotion',
                  icon: SlidersHorizontal,
                  title: 'Calmer motion',
                  detail: 'Reduce springy slide motion and swipe animation.',
                },
                {
                  key: 'autoplay',
                  icon: Play,
                  title: 'Show Time auto-advance',
                  detail: 'Advance slowly when Show Time is playing.',
                },
              ].map(option => {
                const Icon = option.icon;
                const key = option.key as keyof Pick<ComfortSettings, 'captions' | 'largeText' | 'calmMotion' | 'autoplay'>;
                return (
                  <label key={option.key} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-brand-dark">{option.title}</span>
                      <span className="block text-xs font-bold leading-snug text-brand-text/55">{option.detail}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(comfort[key])}
                      onChange={event => setComfort(prev => ({ ...prev, [key]: event.target.checked }))}
                      className="h-5 w-5 accent-brand-primary"
                    />
                  </label>
                );
              })}
              <label className="block rounded-3xl bg-white p-4 shadow-sm">
                <span className="flex items-center justify-between text-sm font-extrabold text-brand-dark">
                  Listen speed
                  <span className="text-brand-text/60">{comfort.ttsRate.toFixed(1)}x</span>
                </span>
                <input
                  type="range"
                  min="0.7"
                  max="1.2"
                  step="0.1"
                  value={comfort.ttsRate}
                  onChange={event => setComfort(prev => ({ ...prev, ttsRate: Number(event.target.value) }))}
                  className="mt-3 w-full accent-brand-primary"
                />
              </label>
            </div>
          </section>
        </div>
      )}

      {isActivityOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Dismiss activity backdrop"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsActivityOpen(false)}
          />
          <section className="relative w-full max-w-lg overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-5 py-4">
              <div>
                <p className="text-lg font-extrabold text-brand-dark">Generation Activity</p>
                <p className="text-xs font-bold text-brand-text/55">
                  {activeMediaJobs.length ? `${activeMediaJobs.length} item${activeMediaJobs.length === 1 ? '' : 's'} need attention` : 'Everything is calm and ready.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityOpen(false)}
                aria-label="Close activity"
                className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
              >
                <X size={22} />
              </button>
            </div>
            <div className="max-h-[65dvh] space-y-3 overflow-y-auto px-5 py-4">
              {activeMediaJobs.length ? activeMediaJobs.map(({ slide, slideNumber }) => (
                <div key={slide.id} className="rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-brand-dark">Slide {slideNumber}: {slide.text}</p>
                      <p className="mt-1 text-xs font-bold text-brand-text/60">
                        {slide.mediaError || slide.mediaProgress || 'Queued for generation.'}
                      </p>
                    </div>
                    {slide.mediaStatus === 'error' ? (
                      <button
                        type="button"
                        onClick={() => retrySlideMedia(slide.id)}
                        className="shrink-0 rounded-full bg-brand-light p-2 text-brand-primary"
                        aria-label={`Retry ${slide.text}`}
                      >
                        <RefreshCw size={16} />
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-brand-light px-3 py-1 text-[11px] font-extrabold text-brand-dark">
                        {slide.mediaStatus || 'queued'}
                      </span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-brand-primary shadow-sm">
                    <CheckCircle2 size={28} />
                  </div>
	                  <p className="text-lg font-extrabold text-brand-dark">No active generation jobs</p>
	                  <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed text-brand-text/60">
	                    {aiStatus?.videoGenerationReady
	                      ? 'Image and video generation are configured. New progress will appear here while StoryBridge creates lesson media.'
	                      : 'New image and video progress will appear here while StoryBridge creates lesson media.'}
	                  </p>
	                  {aiStatus && (
	                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] font-extrabold">
	                      <span className={cn(
	                        'rounded-full px-3 py-1.5',
	                        aiStatus.imageGenerationReady ? 'bg-brand-light text-brand-dark' : 'bg-white text-brand-text/50',
	                      )}>
	                        Images {aiStatus.imageGenerationReady ? 'ready' : 'setup needed'}
	                      </span>
	                      <span className={cn(
	                        'rounded-full px-3 py-1.5',
	                        aiStatus.videoGenerationReady ? 'bg-brand-light text-brand-dark' : 'bg-white text-brand-text/50',
	                      )}>
	                        Video {aiStatus.videoGenerationReady ? 'ready' : 'setup needed'}
	                      </span>
	                    </div>
	                  )}
	                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Dismiss profile backdrop"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsProfileOpen(false)}
          />
	          <section className="relative flex h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:h-[84vh] sm:max-h-[820px] sm:rounded-[2rem]">
	            <div className="border-b border-brand-primary/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex min-w-0 items-center gap-3">
	                  <img
	                    src={starterVisuals.teacher}
	                    alt=""
	                    className="h-11 w-11 shrink-0 rounded-2xl border-2 border-bg-card object-cover sm:h-12 sm:w-12"
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

	              <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row">
	                <label className="relative min-w-0 flex-1">
	                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/45" />
	                  <input
                    value={libraryQuery}
                    onChange={event => setLibraryQuery(event.target.value)}
                    placeholder="Search lessons, topics, or slides..."
	                    className="w-full rounded-full bg-brand-light py-2.5 pl-11 pr-4 text-sm font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-primary sm:py-3"
	                  />
	                </label>
	                <div className="flex overflow-x-auto rounded-full bg-brand-light p-1">
                  {[
                    ['all', 'All'],
                    ['slideshow', 'Slides'],
                    ['showtime', 'Show Time'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLibraryFilter(value as LibraryFilter)}
                      className={cn(
                        'rounded-full px-4 py-2 text-xs font-extrabold transition-colors',
                        libraryFilter === value ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-text/55',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

	            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
	              {filteredSavedLessons.length ? (
	                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pr-2 pb-4 sm:gap-4 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pr-0 lg:pb-0" aria-label="Saved lesson carousel">
	                  {filteredSavedLessons.map(lesson => {
                    const isActive = lesson.id === activeLesson?.id;
                    const videoCount = lesson.slides.filter(slide => slide.mediaType === 'video').length;
                    const readyCount = lesson.slides.filter(slide => slide.mediaUrl || slide.mediaStatus === 'ready').length;
                    const thumb = lessonThumb(lesson);
                    return (
	                      <article
	                        key={lesson.id}
	                        className={cn(
	                          'group flex w-[82vw] max-w-[24rem] shrink-0 snap-center flex-col overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[24rem] lg:w-auto lg:max-w-none',
	                          isActive ? 'border-brand-primary/35 ring-2 ring-brand-primary/10' : 'border-brand-primary/10',
	                        )}
	                      >
	                        <button type="button" onClick={() => openSavedLesson(lesson)} className="flex flex-1 flex-col text-left">
	                          <div className="aspect-[16/8] bg-brand-light sm:aspect-[16/9]">
                            {thumb?.startsWith('/api/video-download') ? (
                              <video src={thumb} className="h-full w-full object-cover" muted playsInline />
                            ) : (
                              <img src={thumb} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            )}
                          </div>
	                          <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
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
	                              <p className="mt-1 line-clamp-1 text-xs font-semibold leading-snug text-brand-text/60 sm:line-clamp-2">
	                                {lesson.objective || lesson.slides[0]?.text || 'Visual classroom lesson'}
	                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-brand-text/55">
                              <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1">
                                <BookOpen size={14} />
                                {lesson.slides.length} slides
                              </span>
                              {videoCount ? (
                                <span className="rounded-full bg-brand-light px-2.5 py-1">{videoCount} video</span>
                              ) : null}
                              <span className="rounded-full bg-brand-light px-2.5 py-1">{readyCount}/{lesson.slides.length} ready</span>
	                              <span className="hidden items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 sm:flex">
	                                <Clock3 size={14} />
	                                {formatSavedAt(lesson.savedAt)}
	                              </span>
                            </div>
                          </div>
                        </button>

	                        <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-brand-primary/10 px-3 py-2.5 sm:px-4 sm:py-3">
                          <button type="button" onClick={() => openEditCreateAgent(lesson)} className="rounded-full bg-brand-light p-2 text-brand-primary" aria-label={`Revise ${lesson.title} with the agent`}>
                            <Wand2 size={16} />
                          </button>
                          <button type="button" onClick={() => duplicateLesson(lesson)} className="rounded-full bg-brand-light p-2 text-brand-primary" aria-label={`Duplicate ${lesson.title}`}>
                            <Copy size={16} />
                          </button>
                          <button type="button" onClick={() => void copyLessonSummary(lesson)} className="rounded-full bg-brand-light p-2 text-brand-primary" aria-label={`Copy summary for ${lesson.title}`}>
                            <Presentation size={16} />
                          </button>
                          <button type="button" onClick={() => exportLesson(lesson)} className="rounded-full bg-brand-light p-2 text-brand-primary" aria-label={`Export ${lesson.title}`}>
                            <Download size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLesson(lesson.id)}
                            className={cn(
                              'rounded-full bg-brand-light text-brand-primary',
                              pendingDeleteId === lesson.id ? 'border border-brand-primary/20 px-3 py-2 text-[11px] font-extrabold text-brand-dark' : 'p-2',
                            )}
                            aria-label={pendingDeleteId === lesson.id ? `Confirm delete ${lesson.title}` : `Delete ${lesson.title}`}
                          >
                            {pendingDeleteId === lesson.id ? 'Confirm delete' : <Trash2 size={16} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-brand-primary shadow-sm">
                    <BookOpen size={30} />
                  </div>
                  <h2 className="text-xl font-extrabold text-brand-dark">
                    {savedLessons.length ? 'No lessons match that search' : 'No saved slideshows yet'}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-brand-text/60">
                    {savedLessons.length
                      ? 'Try another topic, grade band, or media type.'
                      : 'Generate a lesson and StoryBridge will keep it here so you can reopen it from your profile.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      openNewCreateAgent();
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
