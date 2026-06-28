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
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
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

const starterMessage =
  'What should we make for your students today? You can say it naturally, like "washing hands before snack for kindergarten" or "make a short video about asking for a break."';

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

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return "StoryBridge could not reach the lesson studio. Your idea is still here, and you can retry in a moment.";
  }

  if (lower.includes('gemini_api_key') || lower.includes('api key')) {
    return 'StoryBridge needs the Gemini key before it can generate new lessons.';
  }

  if (lower.includes('quota') || lower.includes('rate')) {
    return 'The AI studio is busy right now. Retry soon, or simplify the request for a faster first draft.';
  }

  if (lower.includes('invalid lesson structure')) {
    return 'StoryBridge got an incomplete lesson draft. Retry and I will ask for a cleaner structure.';
  }

  return message || "I couldn't finish that request. Please retry or describe a small change.";
};

const formatLabel = (format?: AgentState['recommendedFormat']) => {
  if (format === 'showtime') return 'Show Time video';
  if (format === 'mixed') return 'Images + video';
  return 'Slide Show';
};

export default function CreateModal({
  isOpen,
  onClose,
  onLessonCreated,
  initialPrompt,
  onInitialPromptConsumed,
}: CreateModalProps) {
  const [sessionId] = useState(() => makeId());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: starterMessage,
    },
  ]);
  const [input, setInput] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [gradeBand, setGradeBand] = useState('Auto');
  const [lessonLength, setLessonLength] = useState(4);
  const [mediaMode, setMediaMode] = useState<MediaMode>('image');
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastInitialPromptRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentState]);

  useEffect(() => {
    if (!isOpen || !initialPrompt || initialPrompt === lastInitialPromptRef.current) return;
    lastInitialPromptRef.current = initialPrompt;
    setInput(initialPrompt);
    setMessages(prev => [
      ...prev,
      {
        id: makeId(),
        role: 'assistant',
        text: 'I can revise the open lesson from here. Adjust the note or send it as written.',
      },
    ]);
    onInitialPromptConsumed?.();
  }, [initialPrompt, isOpen, onInitialPromptConsumed]);

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
  });

  const isBusy = isTyping || isGeneratingLesson;

  const lastLessonRequest = () =>
    [...messages]
      .reverse()
      .find(message => message.role === 'user' && !isCreateConfirmation(message.text))?.text ||
    agentState?.draftTitle ||
    'A calm classroom social story';

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isBusy) return;

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
    if (inferred.mediaMode !== mediaMode) setMediaMode(inferred.mediaMode);

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
          context: getCreationContext(inferred),
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
      const initialSlides: Slide[] = structData.slides.map((slide: any) => {
        const slideMediaType =
          mediaMode === 'mixed' ? (slide.mediaType === 'video' ? 'video' : 'image') : mediaMode;

        return {
          id: makeId(),
          text: slide.text,
          narration: slide.narration,
          imagePrompt: slide.imagePrompt,
          videoPrompt: slide.videoPrompt,
          mediaType: slideMediaType,
          teacherNote: slide.teacherNote,
          interactionCue: slide.interactionCue,
          sensoryGoal: slide.sensoryGoal,
          safetyNotes: slide.safetyNotes,
          isLoading: true,
          mediaStatus: 'queued',
          mediaProgress: slideMediaType === 'video' ? 'Queued for video rendering.' : 'Queued for image generation.',
        };
      });

      const newLesson: Lesson = {
        id: lessonId,
        title: structData.title || agentState?.draftTitle || 'StoryBridge Lesson',
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
                  Describe the need. The agent infers the lesson plan.
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
                    {agentState.recommendedFormat === 'showtime' ? <Clapperboard size={21} /> : <Images size={21} />}
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
                        {formatLabel(agentState.recommendedFormat)}
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
                        Create {agentState.recommendedFormat === 'showtime' ? 'Show Time' : 'slideshow'}
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
