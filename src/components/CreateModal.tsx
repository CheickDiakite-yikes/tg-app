import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Clapperboard,
  Images,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { Lesson, Slide } from '../types';
import { cn } from '../lib/utils';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLessonCreated: (lesson: Lesson, size: string, ratio: string) => void;
  mode?: 'new' | 'edit';
  sourceLesson?: Lesson | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface AgentState {
  reply?: string;
  readyToGenerate?: boolean;
  draftTitle?: string;
  learnerProfile?: {
    gradeBand?: string;
    supportNeeds?: string[];
  };
  recommendedFormat?: 'slideshow' | 'showtime' | 'mixed';
  suggestedSlides?: string[];
  quickReplies?: string[];
  safetyNotes?: string[];
}

type MediaMode = 'image' | 'mixed' | 'video';
type RetryAction = { type: 'chat'; text: string } | { type: 'lesson' };

const modeOptions: Array<{
  mode: MediaMode;
  title: string;
  detail: string;
  Icon: typeof Images;
}> = [
  {
    mode: 'image',
    title: 'Slide Show',
    detail: 'Still visual pages with narration and teacher notes.',
    Icon: Images,
  },
  {
    mode: 'video',
    title: 'Show Time Video',
    detail: 'Short animated scenes for guided viewing.',
    Icon: Clapperboard,
  },
  {
    mode: 'mixed',
    title: 'Both',
    detail: 'A slide deck with selected video moments.',
    Icon: Sparkles,
  },
];

const editModeOptions: Array<{
  mode: MediaMode;
  title: string;
  detail: string;
  Icon: typeof Images;
}> = [
  {
    mode: 'image',
    title: 'Edit slideshow',
    detail: 'Revise the current lesson as a slide deck.',
    Icon: Images,
  },
  {
    mode: 'video',
    title: 'Make Show Time video',
    detail: 'Create brand-new video scenes from this lesson and your edits.',
    Icon: Clapperboard,
  },
  {
    mode: 'mixed',
    title: 'Make both',
    detail: 'Revise the slideshow and add new video moments from that revised version.',
    Icon: Sparkles,
  },
];

const starterMessageByMode: Record<MediaMode, string> = {
  image:
    'Slide Show selected. What should we make for your students today? You can say it naturally, like "washing hands before snack for kindergarten."',
  video:
    'Show Time Video selected. What should we make for your students today? You can say it naturally, like "asking for a break after loud work."',
  mixed:
    'Both selected. What should we make for your students today? StoryBridge will combine calm slides with video moments where motion helps.',
};

const gradeBandOptions = ['Auto', 'K-2', '3-5', '6-8', '9-12'];

const normalizeGradeBand = (value?: string) => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (gradeBandOptions.includes(value)) return value;
  if (/\bk[-\s]?2\b|kindergarten|grade 1|grade 2|first|second/.test(lower)) return 'K-2';
  if (/\b3[-\s]?5\b|grade 3|grade 4|grade 5|third|fourth|fifth/.test(lower)) return '3-5';
  if (/\b6[-\s]?8\b|middle|junior high|grade 6|grade 7|grade 8|sixth|seventh|eighth/.test(lower)) return '6-8';
  if (/\b9[-\s]?12\b|high school|teen|grade 9|grade 10|grade 11|grade 12|ninth|tenth|eleventh|twelfth/.test(lower)) return '9-12';
  return undefined;
};

const inferSettingsFromText = (
  text: string,
  current: { gradeBand: string; lessonLength: number; mediaMode: MediaMode },
) => {
  const lower = text.toLowerCase();
  const slideMatch = lower.match(/\b([3-7])\s*(?:slide|slides|page|pages)\b/);

  let gradeBand = current.gradeBand;
  if (/\b(k|kindergarten|pre-k|prek|1st|first|2nd|second|grade 1|grade 2)\b/.test(lower)) {
    gradeBand = 'K-2';
  } else if (/\b(3rd|third|4th|fourth|5th|fifth|grade 3|grade 4|grade 5)\b/.test(lower)) {
    gradeBand = '3-5';
  } else if (/\b(6th|sixth|7th|seventh|8th|eighth|middle school|junior high|grade 6|grade 7|grade 8)\b/.test(lower)) {
    gradeBand = '6-8';
  } else if (/\b(9th|ninth|10th|tenth|11th|eleventh|12th|twelfth|high school|teen|teens|teenage|grade 9|grade 10|grade 11|grade 12)\b/.test(lower)) {
    gradeBand = '9-12';
  }

  let mediaMode = current.mediaMode;
  if (/\b(video|videos|animated|animation|showtime|show time)\b/.test(lower)) {
    mediaMode = 'video';
  } else if (/\b(mixed|images and videos|image and video)\b/.test(lower)) {
    mediaMode = 'mixed';
  } else if (/\b(image|images|slideshow|slide show)\b/.test(lower)) {
    mediaMode = 'image';
  }

  return {
    gradeBand,
    mediaMode,
    lessonLength: slideMatch ? Number(slideMatch[1]) : current.lessonLength,
  };
};

const isCreateConfirmation = (text: string) =>
  /\b(create it|make it|build it|generate it|go ahead|looks good|do it|yes,?\s*(create|make|build|generate)|start)\b/i.test(text);

const makeId = () => {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  return `storybridge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const friendlyAiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();

  if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    return 'Gemini quota is exhausted for this key or model. Check Google AI Studio billing and rate limits, then retry.';
  }

  if (lower.includes('gemini_api_key') || lower.includes('api key')) {
    return 'StoryBridge needs the Gemini key before it can generate new lessons.';
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
    return 'Gemini is rate limiting this request. Wait a moment, then retry a smaller first draft.';
  }

  if (lower.includes('invalid lesson structure')) {
    return 'StoryBridge got an incomplete lesson draft. Retry and I will ask for a cleaner structure.';
  }

  return message || "I couldn't finish that request. Please retry or describe a small change.";
};

const compactLessonContext = (lesson?: Lesson | null) => {
  if (!lesson) return undefined;

  return {
    id: lesson.id,
    title: lesson.title,
    objective: lesson.objective,
    audience: lesson.audience,
    sensoryNotes: lesson.sensoryNotes,
    estimatedDuration: lesson.estimatedDuration,
    agentSummary: lesson.agentSummary,
    slides: lesson.slides.map(slide => ({
      text: slide.text,
      narration: slide.narration,
      imagePrompt: slide.imagePrompt,
      videoPrompt: slide.videoPrompt,
      mediaType: slide.mediaType,
      teacherNote: slide.teacherNote,
      interactionCue: slide.interactionCue,
      sensoryGoal: slide.sensoryGoal,
      safetyNotes: slide.safetyNotes,
    })),
  };
};

const formatLabel = (format?: AgentState['recommendedFormat'] | MediaMode) => {
  if (format === 'showtime' || format === 'video') return 'Show Time video';
  if (format === 'mixed') return 'Images + video';
  return 'Slide Show';
};

const recommendedFormatForMediaMode = (mode: MediaMode): AgentState['recommendedFormat'] =>
  mode === 'video' ? 'showtime' : mode === 'mixed' ? 'mixed' : 'slideshow';

const editGreetingForMode = (lessonTitle: string, mode: MediaMode) => {
  if (mode === 'video') {
    return `You are making a Show Time video version of "${lessonTitle}". Tell me any changes, or create the video draft when it looks right.`;
  }

  if (mode === 'mixed') {
    return `You are making both from "${lessonTitle}". StoryBridge will revise the slideshow plan and create brand-new video moments from that revised version.`;
  }

  return `You are editing "${lessonTitle}". Tell me what to change, or create a revised slideshow when it looks right.`;
};

const stepText = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const buildSlide = (slide: any, mediaType: Slide['mediaType']): Slide => ({
  id: makeId(),
  text: stepText(slide.text) || 'Watch this step.',
  narration: stepText(slide.narration) || stepText(slide.text) || 'Watch this step.',
  imagePrompt: stepText(slide.imagePrompt) || 'A calm watercolor classroom routine scene with one clear action.',
  videoPrompt: stepText(slide.videoPrompt) || stepText(slide.imagePrompt),
  mediaType,
  teacherNote: slide.teacherNote,
  interactionCue: slide.interactionCue,
  sensoryGoal: slide.sensoryGoal,
  safetyNotes: slide.safetyNotes,
  isLoading: true,
  mediaStatus: 'queued',
  mediaProgress: mediaType === 'video' ? 'Queued for video rendering.' : 'Queued for image generation.',
});

const buildSingleShowtimeSlide = (lessonTitle: string, draftSlides: any[]): Slide => {
  const cleanedSlides = draftSlides.length ? draftSlides : [{ text: lessonTitle }];
  const sceneLines = cleanedSlides
    .map((slide, index) => {
      const action = stepText(slide.narration) || stepText(slide.text) || `Step ${index + 1}`;
      const visual = stepText(slide.videoPrompt) || stepText(slide.imagePrompt) || action;
      return `Scene ${index + 1}: ${action}. Visual direction: ${visual}`;
    })
    .join('\n');
  const narration = cleanedSlides
    .map(slide => stepText(slide.narration) || stepText(slide.text))
    .filter(Boolean)
    .join(' ');

  return {
    id: makeId(),
    text: cleanedSlides.length > 1 ? `Watch the ${cleanedSlides.length} steps.` : stepText(cleanedSlides[0]?.text) || 'Watch the routine.',
    narration: narration || lessonTitle,
    imagePrompt: stepText(cleanedSlides[0]?.imagePrompt) || 'A calm watercolor classroom routine scene with one clear action.',
    videoPrompt: `
Create one single continuous Show Time video for "${lessonTitle}".
Use one consistent character design, outfit, proportions, colors, hairstyle, accessories, and environment across the entire clip.
Show the concepts as clear scene changes or camera-angle changes inside the same video, not separate videos.
Each scene must show a specific, repeatable action a student can imitate.
Keep motion slow, predictable, and low-arousal.
Do not render captions, subtitles, logos, labels, or any readable text inside the video.

Scene plan:
${sceneLines}
    `.trim(),
    mediaType: 'video',
    teacherNote: 'Use the video as one complete model, pausing afterward to practice each step.',
    interactionCue: 'Invite the student to point to, say, gesture, or imitate one step at a time.',
    sensoryGoal: 'Keep the pace steady and the character visually consistent across every scene.',
    safetyNotes: cleanedSlides.flatMap(slide => (Array.isArray(slide.safetyNotes) ? slide.safetyNotes : [])).slice(0, 4),
    isLoading: true,
    mediaStatus: 'queued',
    mediaProgress: 'Queued for one multi-scene video render.',
  };
};

export default function CreateModal({
  isOpen,
  onClose,
  onLessonCreated,
  mode = 'new',
  sourceLesson,
}: CreateModalProps) {
  const [sessionId, setSessionId] = useState(() => makeId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [gradeBand, setGradeBand] = useState('Auto');
  const [lessonLength, setLessonLength] = useState(4);
  const [mediaMode, setMediaMode] = useState<MediaMode>('image');
  const [hasChosenMode, setHasChosenMode] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didResetOnOpenRef = useRef(false);
  const isEditMode = mode === 'edit' && Boolean(sourceLesson);
  const sourceLessonTitle = sourceLesson?.title || 'this lesson';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentState]);

  useEffect(() => {
    if (!isOpen) {
      didResetOnOpenRef.current = false;
      return;
    }
    if (didResetOnOpenRef.current) return;

    didResetOnOpenRef.current = true;
    setSessionId(makeId());
    setMessages([]);
    setInput('');
    setImageSize('1K');
    setAspectRatio('16:9');
    setGradeBand(sourceLesson?.audience?.match(/K-2|3-5|6-8|9-12/)?.[0] || 'Auto');
    setLessonLength(sourceLesson?.slides.length || 4);
    setMediaMode('image');
    setHasChosenMode(false);
    setAgentState(null);
    setIsTyping(false);
    setIsGeneratingLesson(false);
    setRetryAction(null);
  }, [isOpen, mode, sourceLesson?.id, sourceLesson?.slides.length, sourceLesson?.audience]);

  const getCreationContext = (overrides: Partial<{
    gradeBand: string;
    lessonLength: number;
    mediaMode: MediaMode;
    imageSize: string;
    aspectRatio: string;
  }> = {}) => ({
    gradeBand: overrides.gradeBand ?? gradeBand,
    lessonLength: overrides.lessonLength ?? lessonLength,
    mediaMode: overrides.mediaMode ?? mediaMode,
    imageSize: overrides.imageSize ?? imageSize,
    aspectRatio: overrides.aspectRatio ?? aspectRatio,
    audience: 'K-12 teachers supporting autistic learners',
    workflowMode: isEditMode ? 'edit' : 'new',
    sourceLesson: isEditMode ? compactLessonContext(sourceLesson) : undefined,
  });

  const isBusy = isTyping || isGeneratingLesson;

  const chooseMediaMode = (nextMode: MediaMode) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setMediaMode(nextMode);
    setHasChosenMode(true);

    if (isEditMode) {
      const suggestedSlides = sourceLesson?.slides.map(slide => slide.text).slice(0, 5) || [];
      setMessages([
        {
          id: makeId(),
          role: 'assistant',
          text: editGreetingForMode(sourceLessonTitle, nextMode),
        },
      ]);
      setAgentState({
        readyToGenerate: true,
        draftTitle: sourceLessonTitle,
        recommendedFormat: recommendedFormatForMediaMode(nextMode),
        suggestedSlides,
        safetyNotes: sourceLesson?.sensoryNotes,
      });
      return;
    }

    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        text: starterMessageByMode[nextMode],
      },
    ]);
  };

  const defaultEditTopic = () => {
    if (!isEditMode) return 'A calm classroom social story';
    if (mediaMode === 'video') return `Create a Show Time video version of "${sourceLessonTitle}" using the source lesson and teacher edits.`;
    if (mediaMode === 'mixed') return `Revise "${sourceLessonTitle}" as a slideshow and add new video moments based on the revised lesson.`;
    return `Revise "${sourceLessonTitle}" as a calmer, age-appropriate slideshow.`;
  };

  const lastLessonRequest = () =>
    [...messages]
      .reverse()
      .find(message => message.role === 'user' && !isCreateConfirmation(message.text))?.text ||
    agentState?.draftTitle ||
    defaultEditTopic();

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isBusy || !hasChosenMode) return;

    if (navigator.vibrate) navigator.vibrate(50);

    if (agentState?.readyToGenerate && isCreateConfirmation(text)) {
      setMessages(prev => [...prev, { id: makeId(), role: 'user', text }]);
      setInput('');
      generateLesson();
      return;
    }

    const inferred = inferSettingsFromText(text, { gradeBand, lessonLength, mediaMode });
    if (inferred.gradeBand !== gradeBand) setGradeBand(inferred.gradeBand);
    if (inferred.lessonLength !== lessonLength) setLessonLength(inferred.lessonLength);

    const userMsg: Message = { id: makeId(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMsg.text,
          context: getCreationContext({ ...inferred, mediaMode }),
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const assistantText = data.reply || data.text || 'I drafted a direction for this lesson.';
      setAgentState(data);
      setRetryAction(null);
      if (Array.isArray(data.suggestedSlides) && data.suggestedSlides.length >= 3 && data.suggestedSlides.length <= 7) {
        setLessonLength(data.suggestedSlides.length);
      }
      const normalizedGradeBand = normalizeGradeBand(data.learnerProfile?.gradeBand);
      if (gradeBand === 'Auto' && normalizedGradeBand) {
        setGradeBand(normalizedGradeBand);
      }
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', text: assistantText }]);
    } catch (err) {
      setRetryAction({ type: 'chat', text: userMsg.text });
      setMessages(prev => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: friendlyAiError(err),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateLesson = async () => {
    if (!hasChosenMode) return;

    if (navigator.vibrate) navigator.vibrate(50);

    const lastUserMsg = lastLessonRequest();

    setIsGeneratingLesson(true);

    try {
      const structRes = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic: lastUserMsg,
          preferences: getCreationContext(),
        }),
      });
      const structData = await structRes.json();

      if (structData.error) throw new Error(structData.error);
      if (!Array.isArray(structData.slides)) throw new Error('Invalid lesson structure returned');
      setRetryAction(null);

      const lessonId = makeId();
      const draftSlides = structData.slides as any[];
      const title = structData.title || agentState?.draftTitle || 'StoryBridge Lesson';
      const imageSlides = draftSlides.map(slide => buildSlide(slide, 'image'));
      const showtimeSlide = buildSingleShowtimeSlide(title, draftSlides);
      const initialSlides: Slide[] =
        mediaMode === 'video' ? [showtimeSlide] : mediaMode === 'mixed' ? [...imageSlides, showtimeSlide] : imageSlides;

      const newLesson: Lesson = {
        id: lessonId,
        title,
        objective: structData.objective,
        audience: structData.audience,
        sensoryNotes: structData.sensoryNotes,
        estimatedDuration: structData.estimatedDuration,
        agentSummary: structData.agentSummary,
        slides: initialSlides,
      };

      setIsGeneratingLesson(false);
      onLessonCreated(newLesson, imageSize, aspectRatio);
      onClose();
    } catch (err) {
      setRetryAction({ type: 'lesson' });
      setMessages(prev => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: friendlyAiError(err),
        },
      ]);
      setIsGeneratingLesson(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-0 sm:px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-brand-text/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 210 }}
          className="relative flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:h-[78vh] sm:max-h-[760px] sm:rounded-[2rem]"
        >
          <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
                <Wand2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-brand-dark sm:text-lg">
                  StoryBridge Agent
                </p>
                <p className="truncate text-xs font-semibold text-brand-text/55">
                  {hasChosenMode
                    ? `${formatLabel(mediaMode)} selected`
                    : isEditMode
                      ? 'Choose how to revise this lesson'
                      : 'Choose the output first'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>

          {!hasChosenMode ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-4 py-2">
                <div className="rounded-[1.6rem] border border-brand-primary/10 bg-white px-5 py-5 shadow-sm">
                  <p className="text-lg font-extrabold text-brand-dark">What are we making?</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-brand-text/60">
                    {isEditMode
                      ? `Choose what to do with "${sourceLessonTitle}".`
                      : 'Pick the format first so StoryBridge knows exactly what to generate.'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {(isEditMode ? editModeOptions : modeOptions).map(({ mode, title, detail, Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => chooseMediaMode(mode)}
                      className="group flex min-h-[158px] flex-col items-start justify-between rounded-[1.4rem] border border-brand-primary/10 bg-white px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-md active:translate-y-0"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
                        <Icon size={22} />
                      </span>
                      <span>
                        <span className="block text-base font-extrabold text-brand-dark">{title}</span>
                        <span className="mt-1 block text-sm font-semibold leading-snug text-brand-text/60">
                          {detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {isEditMode && (
                  <div className="rounded-[1.4rem] bg-brand-light px-4 py-3 text-sm font-semibold leading-relaxed text-brand-text/70">
                    You can describe changes after choosing an option. The current lesson stays hidden as context.
                  </div>
                )}

                {input.trim() && (
                  <div className="rounded-[1.4rem] bg-brand-light px-4 py-3 text-sm font-semibold leading-relaxed text-brand-text/70">
                    Your revision note is ready. Choose a format, then send it.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              {messages.map(message => (
              <div
                key={message.id}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[86%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[78%] sm:text-base',
                    message.role === 'user'
                      ? 'rounded-tr-md bg-brand-primary text-white'
                      : 'rounded-tl-md border border-brand-primary/10 bg-white text-brand-text',
                  )}
                >
                  {message.text}
                </div>
              </div>
              ))}

              {agentState?.readyToGenerate ? (
              <div className="rounded-[1.6rem] border border-brand-primary/10 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
                    {mediaMode === 'video' ? <Clapperboard size={21} /> : mediaMode === 'mixed' ? <Sparkles size={21} /> : <Images size={21} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-brand-dark">
                        {agentState.draftTitle || 'Ready to create'}
                      </p>
                      <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-extrabold text-brand-dark">
                        {agentState.learnerProfile?.gradeBand || gradeBand}
                      </span>
                      <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-extrabold text-brand-dark">
                        {formatLabel(mediaMode)}
                      </span>
                    </div>

                    {agentState.suggestedSlides?.length ? (
                      <ol className="mt-3 grid gap-2 text-sm font-bold leading-snug text-brand-text/75 sm:grid-cols-2">
                        {agentState.suggestedSlides.slice(0, 4).map((slide, index) => (
                          <li key={`${slide}-${index}`} className="rounded-2xl bg-brand-light/70 px-3 py-2">
                            {index + 1}. {slide}
                          </li>
                        ))}
                      </ol>
                    ) : null}

                    {agentState.safetyNotes?.length ? (
                      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-bg-card px-3 py-2 text-xs font-bold leading-relaxed text-brand-text/65">
                        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-primary" />
                        <span>{agentState.safetyNotes[0]}</span>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateLesson}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
                      >
                        {isGeneratingLesson ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                        Create {formatLabel(mediaMode)}
                      </button>
                      {agentState.quickReplies
                        ?.filter(reply => !isCreateConfirmation(reply) && !/\b(create|generate|make|slideshow now)\b/i.test(reply))
                        .slice(0, 2)
                        .map(reply => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => sendMessage(reply)}
                          disabled={isBusy}
                          className="rounded-full border border-brand-primary/12 bg-white px-4 py-3 text-sm font-extrabold text-brand-text/70 transition-colors hover:bg-brand-light disabled:opacity-60"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              ) : agentState ? (
              <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-brand-primary/10 bg-white/80 px-3 py-2 text-xs font-extrabold text-brand-text/70 shadow-sm">
                <Wand2 size={14} className="text-brand-primary" />
                <span>I can keep refining from here</span>
              </div>
              ) : null}

              {retryAction && !isBusy && (
              <div className="flex justify-start">
                <div className="max-w-[86%] rounded-3xl rounded-tl-md border border-brand-primary/10 bg-white px-4 py-3 text-sm font-semibold text-brand-text shadow-sm sm:max-w-[78%]">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={17} className="mt-0.5 shrink-0 text-brand-primary" />
                    <div>
                      <p className="font-extrabold text-brand-dark">That request can be retried.</p>
                      <button
                        type="button"
                        onClick={() => (retryAction.type === 'chat' ? sendMessage(retryAction.text) : generateLesson())}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-2 text-xs font-extrabold text-brand-dark"
                      >
                        <RefreshCw size={14} />
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-brand-primary/10 bg-white px-5 py-4 shadow-sm">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-brand-primary/40" />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-brand-primary/40"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-brand-primary/40"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
              )}

              {isGeneratingLesson && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-3xl rounded-tl-md border border-brand-primary/10 bg-white px-4 py-3 text-sm font-semibold text-brand-text shadow-sm">
                  <Loader2 size={17} className="animate-spin text-brand-primary" />
                  Building your lesson now.
                </div>
              </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {hasChosenMode && (
          <div className="shrink-0 border-t border-brand-primary/10 bg-white p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  placeholder={
                    agentState?.readyToGenerate
                      ? 'Ask for a change, like "make it calmer"...'
                      : 'Tell StoryBridge what to make...'
                  }
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && sendMessage()}
                  className="w-full rounded-full border-none bg-brand-light py-4 pl-5 pr-12 text-sm font-semibold text-brand-text outline-none transition-shadow placeholder:text-brand-text/45 focus:ring-2 focus:ring-brand-primary sm:text-base"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isBusy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-brand-primary p-2 text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                  aria-label="Send message"
                >
                  {isGeneratingLesson ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
                </button>
              </div>
            </div>
          </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
