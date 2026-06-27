import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Sparkles, Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Lesson, Slide } from '../types';
import { cn } from '../lib/utils';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLessonCreated: (lesson: Lesson, size: string, ratio: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function CreateModal({ isOpen, onClose, onLessonCreated }: CreateModalProps) {
  const [sessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    role: 'assistant',
    text: "Hi there! I'm here to help you create visual lessons for your students. What topic would you like to teach today? (e.g., 'Sharing toys', 'Washing hands', 'Taking turns')"
  }]);
  const [input, setInput] = useState("");
  const [imageSize, setImageSize] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (navigator.vibrate) navigator.vibrate(50);
    
    const userMsg: Message = { id: uuidv4(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg.text })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', text: data.text }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', text: "Sorry, I had trouble thinking of a response. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateLesson = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    
    // Get the last user message as the topic, or default
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.text || "General social skills";
    
    setIsGeneratingLesson(true);
    
    try {
      // 1. Generate Structure
      const structRes = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: lastUserMsg })
      });
      const structData = await structRes.json();
      
      if (!structData.slides) throw new Error("Invalid structure returned");
      
      // Create initial lesson object
      const lessonId = uuidv4();
      const initialSlides: Slide[] = structData.slides.map((s: any) => ({
        id: uuidv4(),
        text: s.text,
        imagePrompt: s.imagePrompt,
        mediaType: s.mediaType === 'video' ? 'video' : 'image', // force valid type
        isLoading: true
      }));
      
      const newLesson: Lesson = {
        id: lessonId,
        title: structData.title || "New Lesson",
        slides: initialSlides
      };
      
      // Close modal and pass to parent immediately so user sees loading state
      onLessonCreated(newLesson, imageSize, aspectRatio);
      onClose();
      
    } catch (err) {
      console.error("Failed to generate lesson:", err);
      setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', text: "I'm sorry, I couldn't generate the lesson right now. Please try again." }]);
      setIsGeneratingLesson(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0">
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
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl bg-bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl h-[85vh] sm:h-[70vh] flex flex-col overflow-hidden self-end sm:self-center"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-primary/10 bg-white">
            <div className="flex items-center gap-2 text-brand-primary font-bold text-lg">
              <Sparkles size={24} className="text-brand-primary" fill="currentColor" />
              Create Lesson
            </div>
            <button onClick={onClose} className="p-2 hover:bg-brand-light rounded-full text-brand-text/60">
              <X size={24} />
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-3 text-sm sm:text-base shadow-sm",
                  msg.role === 'user' 
                    ? "bg-brand-primary text-white rounded-tr-sm" 
                    : "bg-white text-brand-text rounded-tl-sm border border-brand-primary/10"
                )}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-brand-primary/10 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-brand-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-brand-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Actions & Input */}
          <div className="p-4 bg-white border-t border-brand-primary/10 flex flex-col gap-4">
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-brand-text/70">
                 <label>Size:</label>
                 <select value={imageSize} onChange={e => setImageSize(e.target.value)} className="bg-brand-light p-1 rounded-md">
                   <option value="1K">1K</option>
                   <option value="2K">2K</option>
                   <option value="4K">4K</option>
                 </select>
                 <label className="ml-2">Ratio:</label>
                 <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-brand-light p-1 rounded-md">
                   <option value="16:9">16:9</option>
                   <option value="9:16">9:16</option>
                 </select>
              </div>

              <button 
                onClick={generateLesson}
                disabled={isGeneratingLesson || isTyping}
                className="w-full sm:w-auto px-8 py-3 bg-brand-dark text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGeneratingLesson ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generating Magic...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Lesson Now
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center">
              <input 
                type="text"
                placeholder="Ask me to create a lesson..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="w-full bg-brand-light border-none rounded-full py-4 pl-6 pr-14 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-2 p-2 bg-brand-primary text-white rounded-full disabled:opacity-50 hover:bg-brand-dark transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
