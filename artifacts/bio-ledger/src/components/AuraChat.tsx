import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auraChat, type AuraChatRequest } from '@workspace/api-client-react';

export interface AuraBioContext {
  hrv: number;
  strain: number;
  apm: number;
  focusScore: number;
  postureWarning: boolean;
  isSessionActive: boolean;
  sessionDurationSeconds: number;
  hourOfDay: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  fallback?: boolean;
  timestamp: Date;
}

interface AuraChatProps {
  bioContext: AuraBioContext;
  nullifierHash: string;
  onInsightSigned?: (text: string) => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export default function AuraChat({ bioContext, onInsightSigned }: AuraChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `AURA online. Bio-link established. HRV ${bioContext.hrv}ms · Strain ${bioContext.strain}/21 · Vision ${bioContext.focusScore}/100. Awaiting query.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.pitch = 0.7;
    utt.volume = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.name.toLowerCase().includes('google') && v.lang === 'en-US')
      ?? voices.find((v) => v.lang.startsWith('en'))
      ?? voices[0];
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const historyForApi = messages.slice(-9).map((m) => ({ role: m.role, content: m.content }));

    try {
      const req: AuraChatRequest = {
        message: text.trim(),
        bioContext,
        history: historyForApi,
      };
      const result = await auraChat(req);
      const auraMsg: Message = {
        role: 'assistant',
        content: result.response,
        fallback: result.fallback,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, auraMsg]);
      speakText(result.response);
      onInsightSigned?.(result.response);
    } catch {
      const errMsg: Message = {
        role: 'assistant',
        content: `Signal degraded. Biometrics intact: HRV ${bioContext.hrv}ms, Strain ${bioContext.strain}/21. Retry query.`,
        fallback: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [bioContext, isLoading, messages, onInsightSigned, speakText]);

  const toggleListening = useCallback(() => {
    if (!speechSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInput(transcript);
        void sendMessage(transcript);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, sendMessage, speechSupported]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pr-2">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] px-3 py-2 text-xs font-terminal border relative',
                  msg.role === 'user'
                    ? 'bg-primary/10 border-primary/40 text-primary ml-6'
                    : 'bg-card border-secondary/40 text-foreground/90 mr-6'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-pixel text-[7px] text-accent">AURA</span>
                    {msg.fallback && (
                      <span className="font-pixel text-[6px] text-muted-foreground/50 border border-muted-foreground/20 px-1">
                        LOCAL
                      </span>
                    )}
                  </div>
                )}
                <p className="leading-relaxed break-words">{msg.content}</p>
                <span className="block text-[9px] text-muted-foreground/40 mt-1 text-right">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-card border border-secondary/40 px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-accent animate-spin" />
              <span className="font-pixel text-[7px] text-accent animate-pulse">AURA PROCESSING...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bio context bar */}
      <div className="px-4 py-1.5 border-t border-secondary/20 bg-background/50 flex items-center gap-3 flex-wrap">
        <span className="font-pixel text-[7px] text-muted-foreground/50">LIVE</span>
        <span className="font-terminal text-[9px] text-primary/70">HRV {bioContext.hrv}ms</span>
        <span className="font-terminal text-[9px] text-accent/70">Strain {bioContext.strain}</span>
        <span className="font-terminal text-[9px] text-foreground/50">Vision {bioContext.focusScore}/100</span>
        {bioContext.postureWarning && (
          <span className="font-pixel text-[7px] text-yellow-400 animate-pulse">⚠ POSTURE</span>
        )}
        {bioContext.isSessionActive && (
          <span className="font-pixel text-[7px] text-primary animate-pulse">● SESSION ACTIVE</span>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 pt-3 border-t border-secondary/30 flex gap-2 items-end">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'LISTENING...' : 'Query AURA...'}
            disabled={isLoading || isListening}
            className={cn(
              'w-full bg-background border-2 px-3 py-2 font-terminal text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary transition-colors',
              isListening ? 'border-red-500 animate-pulse' : 'border-secondary/50 focus:border-primary/70'
            )}
          />
        </div>

        {/* Mic button */}
        {speechSupported && (
          <button
            onClick={toggleListening}
            disabled={isLoading}
            title={isListening ? 'Stop listening' : 'Speak to AURA'}
            className={cn(
              'p-2 border-2 transition-colors cursor-pointer flex-shrink-0',
              isListening
                ? 'border-red-500 text-red-400 bg-red-900/20 animate-pulse'
                : 'border-secondary/50 text-muted-foreground hover:border-primary hover:text-primary'
            )}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* TTS toggle */}
        <button
          onClick={() => setTtsEnabled((v) => !v)}
          title={ttsEnabled ? 'Mute AURA voice' : 'Enable AURA voice'}
          className={cn(
            'p-2 border-2 transition-colors cursor-pointer flex-shrink-0',
            ttsEnabled
              ? 'border-primary text-primary bg-primary/10'
              : 'border-secondary/50 text-muted-foreground hover:border-primary hover:text-primary'
          )}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Send button */}
        <button
          onClick={() => void sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className={cn(
            'p-2 border-2 border-primary text-primary transition-all cursor-pointer flex-shrink-0',
            'hover:bg-primary/20 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
