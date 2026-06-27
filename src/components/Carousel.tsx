import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { Slide } from '../types';
import { cn } from '../lib/utils';

interface CarouselProps {
  slides: Slide[];
}

export default function Carousel({ slides }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

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
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!slides || slides.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-brand-text opacity-50">No slides available.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden px-4 sm:px-12">
      
      {/* Navigation Arrows (Desktop) */}
      <button 
        onClick={prevSlide}
        disabled={currentIndex === 0}
        className={cn(
          "absolute left-4 z-20 p-3 rounded-full bg-white shadow-md text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all hidden sm:block",
          currentIndex > 0 && "hover:bg-brand-light hover:scale-105 active:scale-95"
        )}
      >
        <ChevronLeft size={24} />
      </button>

      <button 
        onClick={nextSlide}
        disabled={currentIndex === slides.length - 1}
        className={cn(
          "absolute right-4 z-20 p-3 rounded-full bg-white shadow-md text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all hidden sm:block",
          currentIndex < slides.length - 1 && "hover:bg-brand-light hover:scale-105 active:scale-95"
        )}
      >
        <ChevronRight size={24} />
      </button>

      {/* Cards */}
      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence initial={false}>
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            const isPrev = index === currentIndex - 1;
            const isNext = index === currentIndex + 1;
            
            // Only render cards close to current for performance and layering
            if (Math.abs(index - currentIndex) > 2) return null;

            let xOffset = 0;
            let scale = 1;
            let zIndex = 0;
            let opacity = 1;

            if (isActive) {
              xOffset = 0;
              scale = 1;
              zIndex = 10;
              opacity = 1;
            } else if (isPrev) {
              xOffset = -65;
              scale = 0.85;
              zIndex = 5;
              opacity = 0.6;
            } else if (isNext) {
              xOffset = 65;
              scale = 0.85;
              zIndex = 5;
              opacity = 0.6;
            } else {
              xOffset = index < currentIndex ? -100 : 100;
              scale = 0.7;
              zIndex = 1;
              opacity = 0;
            }

            return (
              <motion.div
                key={slide.id}
                initial={false}
                animate={{ 
                  x: `${xOffset}%`, 
                  scale, 
                  zIndex, 
                  opacity,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                  "absolute top-0 bottom-0 m-auto w-full max-w-3xl aspect-[16/10] sm:aspect-[16/9] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col",
                  !isActive && "pointer-events-none"
                )}
                drag={isActive ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipe = offset.x;
                  if (swipe < -50) {
                    nextSlide();
                  } else if (swipe > 50) {
                    prevSlide();
                  }
                }}
              >
                {/* Image/Video Content */}
                <div className="relative flex-1 bg-brand-light w-full flex items-center justify-center overflow-hidden">
                  {slide.isLoading ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-full border-4 border-brand-primary border-t-transparent animate-spin"></div>
                      <p className="text-brand-text font-medium">Generating visual...</p>
                    </div>
                  ) : slide.mediaUrl ? (
                    slide.mediaType === 'video' ? (
                      <video 
                        src={slide.mediaUrl} 
                        className="w-full h-full object-cover" 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                      />
                    ) : (
                      <img 
                        src={slide.mediaUrl} 
                        alt={slide.text} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    )
                  ) : (
                    <div className="text-brand-text opacity-40">No media</div>
                  )}

                  {/* Overlaid Text */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent flex items-center p-8 sm:p-12 w-[60%] sm:w-[50%]">
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-brand-text leading-tight tracking-tight">
                      {slide.text}
                    </h2>
                  </div>
                </div>

                {/* Footer Toolbar */}
                <div className="h-16 border-t border-brand-primary/10 flex items-center justify-between px-6 bg-white shrink-0">
                  <button 
                    onClick={() => speak(slide.text)}
                    className="flex items-center gap-2 text-brand-primary font-semibold hover:bg-brand-light px-4 py-2 rounded-full transition-colors active:scale-95"
                  >
                    <Volume2 size={20} />
                    <span>Listen again</span>
                  </button>

                  <div className="flex items-center gap-4 text-brand-text/60 font-semibold text-sm">
                    {/* Mobile arrows inside card */}
                    <button onClick={prevSlide} disabled={currentIndex === 0} className="sm:hidden p-2 disabled:opacity-30">
                      <ChevronLeft size={20} />
                    </button>
                    <span>{index + 1} / {slides.length}</span>
                    <button onClick={nextSlide} disabled={currentIndex === slides.length - 1} className="sm:hidden p-2 disabled:opacity-30">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
