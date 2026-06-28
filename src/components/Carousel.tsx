import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Captions,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { ComfortSettings, Lesson, Slide, ViewMode } from '../types';
import { cn } from '../lib/utils';

interface CarouselProps {
  lesson: Lesson | null;
  viewMode: ViewMode;
  comfort: ComfortSettings;
  onRetryMedia?: (slideId: string) => void;
}

const statusCopy: Record<string, string> = {
  queued: 'Waiting for the visual studio...',
  generating: 'Creating the image...',
  polling: 'Rendering the video...',
};

const hasTeacherGuide = (lesson: Lesson | null, slide?: Slide) =>
  Boolean(
    lesson?.objective ||
      lesson?.audience ||
      lesson?.estimatedDuration ||
      lesson?.agentSummary ||
      lesson?.sensoryNotes?.length ||
      slide?.teacherNote ||
      slide?.interactionCue ||
      slide?.sensoryGoal ||
      slide?.safetyNotes?.length,
  );

export default function Carousel({ lesson, viewMode, comfort, onRetryMedia }: CarouselProps) {
  const slides = lesson?.slides || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const calmMotion = comfort.calmMotion || prefersReducedMotion;
  const activeSlide = slides[Math.min(currentIndex, Math.max(slides.length - 1, 0))];

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setIsGuideOpen(false);
  }, [lesson?.id]);

  useEffect(() => {
    setIsPlaying(viewMode === 'showtime' && comfort.autoplay);
  }, [viewMode, comfort.autoplay]);

  useEffect(() => {
    if (currentIndex > slides.length - 1) {
      setCurrentIndex(Math.max(slides.length - 1, 0));
    }
  }, [currentIndex, slides.length]);

  useEffect(() => {
    if (viewMode !== 'showtime' || !isPlaying || slides.length < 2) return;

    const timer = window.setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= slides.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        if (navigator.vibrate) navigator.vibrate(20);
        return prev + 1;
      });
    }, calmMotion ? 8500 : 6500);

    return () => window.clearInterval(timer);
  }, [calmMotion, isPlaying, slides.length, viewMode]);

  const transition = useMemo(
    () => (calmMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 300, damping: 30 }),
    [calmMotion],
  );

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      if (navigator.vibrate) navigator.vibrate(50);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      if (navigator.vibrate) navigator.vibrate(50);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const speak = (text: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = comfort.ttsRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  const openFullscreen = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    const element = containerRef.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    void element?.requestFullscreen?.();
  };

  if (!slides.length) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-brand-text opacity-50">No slides available.</p>
      </div>
    );
  }

  const renderMedia = (slide: Slide, isActive: boolean) => {
    const hasPendingStatus =
      slide.isLoading || slide.mediaStatus === 'queued' || slide.mediaStatus === 'generating' || slide.mediaStatus === 'polling';

    if (hasPendingStatus) {
      return (
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
          <div className="h-12 w-12 rounded-full border-4 border-brand-primary border-t-transparent motion-safe:animate-spin" />
          <div>
            <p className="font-extrabold text-brand-dark">
              {slide.mediaType === 'video' ? 'Preparing Show Time video' : 'Preparing slide image'}
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-text/60">
              {slide.mediaProgress || statusCopy[slide.mediaStatus || 'generating'] || 'Creating visual...'}
            </p>
          </div>
        </div>
      );
    }

    if (slide.mediaError || slide.mediaStatus === 'error') {
      return (
        <div className="mx-5 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-brand-primary/15 bg-white/85 px-5 py-5 text-center shadow-sm">
          <AlertCircle size={28} className="text-brand-primary" />
          <div>
            <p className="font-extrabold text-brand-dark">This visual needs another try.</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-brand-text/60">
              {slide.mediaError || 'StoryBridge could not finish this media item.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRetryMedia?.(slide.id)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-extrabold text-white transition-transform active:scale-95"
          >
            <RefreshCw size={15} />
            Retry visual
          </button>
        </div>
      );
    }

    if (slide.mediaUrl) {
      return slide.mediaType === 'video' ? (
        <video
          src={slide.mediaUrl}
          className="h-full w-full bg-white object-contain"
          autoPlay={viewMode === 'showtime' && isActive}
          controls={viewMode === 'showtime' && isActive}
          loop={viewMode !== 'showtime'}
          muted
          playsInline
        />
      ) : (
        <img
          src={slide.mediaUrl}
          alt={slide.text}
          className="h-full w-full bg-white object-contain"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div className="mx-5 max-w-xs rounded-3xl bg-white/75 px-6 py-5 text-center text-brand-text shadow-sm">
        <p className="font-extrabold">Visual pending</p>
        <p className="mt-1 text-sm font-semibold opacity-60">Generate or retry this scene when the AI studio is ready.</p>
        {onRetryMedia && (
          <button
            type="button"
            onClick={() => onRetryMedia(slide.id)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-xs font-extrabold text-white"
          >
            <RefreshCw size={14} />
            Generate visual
          </button>
        )}
      </div>
    );
  };

  const renderTranscript = (slide: Slide) => {
    if (!comfort.captions && !comfort.largeText) return null;

    return (
      <div
        className={cn(
          'border-t border-brand-primary/10 bg-white/95 px-5 py-3 text-center font-extrabold leading-snug text-brand-text',
          comfort.largeText ? 'text-lg sm:text-xl' : 'text-sm sm:text-base',
        )}
      >
        {slide.narration || slide.text}
      </div>
    );
  };

  const renderTeacherGuide = () => {
    if (!activeSlide || !hasTeacherGuide(lesson, activeSlide)) return null;

    return (
      <AnimatePresence>
        {isGuideOpen && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-brand-text/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
            <motion.button
              type="button"
              aria-label="Dismiss teacher guide backdrop"
              className="absolute inset-0 cursor-default"
              onClick={() => setIsGuideOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.section
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={transition}
              className="relative flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-bg-card shadow-2xl sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between border-b border-brand-primary/10 bg-white px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-brand-dark">Teacher Guide</p>
                  <p className="truncate text-xs font-bold text-brand-text/55">
                    Slide {currentIndex + 1} of {slides.length}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close teacher guide"
                  className="rounded-full p-2 text-brand-text/60 transition-colors hover:bg-brand-light"
                  onClick={() => setIsGuideOpen(false)}
                >
                  <ChevronRight size={20} className="rotate-90" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">Lesson</p>
                  <h2 className="mt-1 text-xl font-extrabold leading-tight text-brand-dark">{lesson?.title}</h2>
                  {lesson?.objective && (
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-brand-text/70">{lesson.objective}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold text-brand-text/60">
                    {lesson?.audience && <span className="rounded-full bg-brand-light px-3 py-1">{lesson.audience}</span>}
                    {lesson?.estimatedDuration && (
                      <span className="rounded-full bg-brand-light px-3 py-1">{lesson.estimatedDuration}</span>
                    )}
                  </div>
                </div>

                {(activeSlide.teacherNote || activeSlide.interactionCue || activeSlide.sensoryGoal) && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {activeSlide.teacherNote && (
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-extrabold text-brand-primary">Teacher note</p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-brand-text/70">{activeSlide.teacherNote}</p>
                      </div>
                    )}
                    {activeSlide.interactionCue && (
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-extrabold text-brand-primary">Interaction cue</p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-brand-text/70">{activeSlide.interactionCue}</p>
                      </div>
                    )}
                    {activeSlide.sensoryGoal && (
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-extrabold text-brand-primary">Sensory goal</p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-brand-text/70">{activeSlide.sensoryGoal}</p>
                      </div>
                    )}
                  </div>
                )}

                {Boolean(lesson?.sensoryNotes?.length || activeSlide.safetyNotes?.length) && (
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-brand-primary">
                      <ShieldCheck size={17} />
                      <p className="text-sm font-extrabold">Safety and sensory notes</p>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm font-bold leading-relaxed text-brand-text/70">
                      {[...(lesson?.sensoryNotes || []), ...(activeSlide.safetyNotes || [])].map((note, index) => (
                        <li key={`${note}-${index}`}>- {note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    );
  };

  const showtimePlayer = () => (
    <div ref={containerRef} className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-8">
	      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-xl">
	        <motion.div
	          className="relative flex min-h-[270px] flex-1 items-center justify-center overflow-hidden bg-brand-light sm:min-h-[430px]"
	          drag={slides.length > 1 ? 'x' : false}
	          dragConstraints={{ left: 0, right: 0 }}
	          dragElastic={0.16}
	          onDragEnd={(e, { offset }) => {
	            if (offset.x < -50) nextSlide();
	            if (offset.x > 50) prevSlide();
	          }}
	        >
	          {renderMedia(activeSlide, true)}
	        </motion.div>
        {renderTranscript(activeSlide)}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-primary/10 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(prev => !prev)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-extrabold text-white transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => speak(activeSlide.narration || activeSlide.text)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-light px-4 py-2 text-sm font-extrabold text-brand-dark transition-transform active:scale-95"
            >
              <Volume2 size={17} />
              Listen
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm font-extrabold text-brand-text/65">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="rounded-full p-2 transition-colors hover:bg-brand-light disabled:opacity-30"
            >
              <ChevronLeft size={19} />
            </button>
            <span>{currentIndex + 1} / {slides.length}</span>
            <button
              type="button"
              aria-label="Next slide"
              onClick={nextSlide}
              disabled={currentIndex === slides.length - 1}
              className="rounded-full p-2 transition-colors hover:bg-brand-light disabled:opacity-30"
            >
              <ChevronRight size={19} />
            </button>
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              disabled={!hasTeacherGuide(lesson, activeSlide)}
              className="rounded-full p-2 transition-colors hover:bg-brand-light disabled:opacity-30"
              aria-label="Open teacher guide"
            >
              <BookOpen size={18} />
            </button>
            <button type="button" onClick={openFullscreen} className="rounded-full p-2 transition-colors hover:bg-brand-light" aria-label="Fullscreen">
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      </div>
      {renderTeacherGuide()}
    </div>
  );

  const slideshowPlayer = () => (
    <div className="relative mx-auto flex h-[54dvh] min-h-[330px] w-full max-w-6xl items-center justify-center overflow-hidden px-4 max-[430px]:h-[46dvh] max-[430px]:min-h-[285px] max-[430px]:px-2 max-[360px]:h-[44dvh] max-[360px]:min-h-[245px] sm:h-[54vh] sm:min-h-[360px] sm:px-12">
      <button
        type="button"
        aria-label="Previous slide"
        onClick={prevSlide}
        disabled={currentIndex === 0}
        className={cn(
          'absolute left-4 z-20 hidden rounded-full bg-white p-3 text-brand-primary shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-30 sm:block',
          currentIndex > 0 && 'hover:bg-brand-light hover:scale-105 active:scale-95',
        )}
      >
        <ChevronLeft size={24} />
      </button>

      <button
        type="button"
        aria-label="Next slide"
        onClick={nextSlide}
        disabled={currentIndex === slides.length - 1}
        className={cn(
          'absolute right-4 z-20 hidden rounded-full bg-white p-3 text-brand-primary shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-30 sm:block',
          currentIndex < slides.length - 1 && 'hover:bg-brand-light hover:scale-105 active:scale-95',
        )}
      >
        <ChevronRight size={24} />
      </button>

      <div className="relative flex h-full w-full items-center justify-center">
        <AnimatePresence initial={false}>
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            const isPrev = index === currentIndex - 1;
            const isNext = index === currentIndex + 1;

            if (Math.abs(index - currentIndex) > 2) return null;

            const xOffset = isActive ? 0 : isPrev ? -65 : isNext ? 65 : index < currentIndex ? -100 : 100;
            const scale = isActive ? 1 : isPrev || isNext ? 0.85 : 0.7;
            const zIndex = isActive ? 10 : isPrev || isNext ? 5 : 1;
            const opacity = isActive ? 1 : isPrev || isNext ? 0.6 : 0;

            return (
	                <motion.div
	                  key={slide.id}
	                  initial={false}
	                  animate={{ x: `${xOffset}%`, scale, zIndex, opacity }}
	                  transition={transition}
	                  className={cn(
	                  'absolute bottom-0 top-0 m-auto flex aspect-[16/10] max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl max-[430px]:h-full max-[430px]:w-[94%] max-[430px]:max-w-none max-[430px]:aspect-auto max-[430px]:rounded-[1.35rem] sm:aspect-[16/9]',
	                  !isActive && 'pointer-events-none',
	                )}
                drag={isActive && !calmMotion ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, { offset }) => {
                  if (offset.x < -50) nextSlide();
                  if (offset.x > 50) prevSlide();
                }}
              >
                <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-brand-light">
                  {renderMedia(slide, isActive)}
                </div>
                {isActive && renderTranscript(slide)}
	                <div className="flex h-16 shrink-0 items-center justify-between border-t border-brand-primary/10 bg-white px-4 max-[430px]:h-14 max-[430px]:px-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => speak(slide.narration || slide.text)}
                    className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-brand-primary transition-colors hover:bg-brand-light active:scale-95 sm:px-4"
                  >
                    <Volume2 size={19} />
                    <span className="hidden min-[390px]:inline">Listen again</span>
                  </button>

                  <div className="flex items-center gap-2 text-sm font-extrabold text-brand-text/60">
                    <button type="button" aria-label="Previous slide" onClick={prevSlide} disabled={currentIndex === 0} className="p-2 disabled:opacity-30 sm:hidden">
                      <ChevronLeft size={20} />
                    </button>
                    <span>{index + 1} / {slides.length}</span>
                    <button type="button" aria-label="Next slide" onClick={nextSlide} disabled={currentIndex === slides.length - 1} className="p-2 disabled:opacity-30 sm:hidden">
                      <ChevronRight size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsGuideOpen(true)}
                      disabled={!hasTeacherGuide(lesson, slide)}
                      className="rounded-full p-2 transition-colors hover:bg-brand-light disabled:opacity-30"
                      aria-label="Open teacher guide"
                    >
                      <BookOpen size={18} />
                    </button>
                    {comfort.captions && <Captions size={17} className="text-brand-primary" aria-label="Captions on" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {renderTeacherGuide()}
    </div>
  );

  return viewMode === 'showtime' ? showtimePlayer() : slideshowPlayer();
}
