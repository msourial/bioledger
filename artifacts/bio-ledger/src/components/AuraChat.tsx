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

export interface ReceiptSummaryItem {
  receiptType: string;
  hrv: number;
  strain: number;
  apm: number;
  durationSeconds: number;
  createdAt: string;
  insightText?: string;
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
  /** A proactive nudge queued by Dashboard — auto-sent once then cleared */
  proactiveNudge?: string | null;
  onNudgeClear?: () => void;
  /** Last 3 receipts for AURA context */
  recentReceipts?: ReceiptSummaryItem[];
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

function formatReceiptSummary(r: ReceiptSummaryItem): string {
  const mins = Math.round(r.durationSeconds / 60);
  const date = new Date(r.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (r.receiptType === 'insight' && r.insightText) {
    return `[${date}] AURA Insight: "${r.insightText.slice(0, 80)}${r.insightText.length > 80 ? '...' : ''}"`;
  }
  return `[${date}] Work session ${mins}min — HRV ${r.hrv}ms, Strain ${r.strain}/21, APM ${r.apm}`;
}

export default function AuraChat({
  bioContext,
  onInsightSigned,
  proactiveNudge,
  onNudgeClear,
  recentReceipts = [],
}: AuraChatProps) {
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
  const [speechSupported] = useState(
    () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nudgeSentRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = useCallback(
    (text: string) => {
      if (!ttsEnabled || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.9;
      utt.pitch = 0.7;
      utt.volume = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.toLowerCase().includes('google') && v.lang === 'en-US') ??
        voices.find((v) => v.lang.startsWith('en')) ??
        voices[0];
      if (preferred) utt.voice = preferred;
      window.speechSynthesis.speak(utt);
    },
    [ttsEnabled]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      const historyForApi = messages
        .slice(-9)
        .map((m) => ({ role: m.role, content: m.content }));

      const summaries = recentReceipts
        .slice(-3)
        .map(formatReceiptSummary);

      try {
        const req: AuraChatRequest = {
          message: text.trim(),
          bioContext,
          history: historyForApi,
          recentReceiptSummaries: summaries.length > 0 ? summaries : undefined,
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
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Signal degraded. Biometrics intact: HRV ${bioContext.hrv}ms, Strain ${bioContext.strain}/21. Retry query.`,
            fallback: true,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [bioContext, isLoading, messages, onInsightSigned, recentReceipts, speakText]
  );

  // Auto-dispatch proactive nudge from Dashboard when it changes
  useEffect(() => {
    if (!proactiveNudge || proactiveNudge === nudgeSentRef.current) return;
    nudgeSentRef.current = proactiveNudge;
    // Small delay so the tab switch animation completes before sending
    const timer = setTimeout(() => {
      void sendMessage(proactiveNudge);
      onNudgeClear?.();
    }, 400);
    return () => clearTimeout(timer);
    // sendMessage changes identity when messages/bioContext change; use a stable callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proactiveNudge]);

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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' ? (
                /* AURA bubble — cyan glow */
                <div className="max-w-[82%] flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="font-pixel text-[7px] text-primary/80">AURA</span>
                    {msg.fallback && (
                      <span className="font-pixel text-[6px] text-muted-foreground/40 border border-muted-foreground/20 px-1">
                        LOCAL
                      </span>
                    )}
                  </div>
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed break-words"
                    style={{
                      background: 'rgba(0, 245, 255, 0.06)',
                      border: '1px solid rgba(0, 245, 255, 0.18)',
                      boxShadow: '0 0 16px rgba(0, 245, 255, 0.12)',
                      color: 'rgba(220, 240, 255, 0.9)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/30 ml-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                /* User bubble — magenta glow */
                <div className="max-w-[82%] flex flex-col gap-1 items-end">
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed break-words"
                    style={{
                      background: 'rgba(255, 0, 200, 0.08)',
                      border: '1px solid rgba(255, 0, 200, 0.22)',
                      boxShadow: '0 0 14px rgba(255, 0, 200, 0.1)',
                      color: 'rgba(255, 220, 255, 0.9)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/30 mr-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-start"
          >
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2"
              style={{
                background: 'rgba(0, 245, 255, 0.05)',
                border: '1px solid rgba(0, 245, 255, 0.15)',
              }}
            >
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span className="font-pixel text-[7px] text-primary/70">AURA PROCESSING...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Live bio-context bar */}
      <div
        className="px-4 py-2 flex items-center gap-3 flex-wrap text-[11px]"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span className="font-pixel text-[7px] text-muted-foreground/40">LIVE</span>
        <span className="font-mono text-primary/70">HRV {bioContext.hrv}ms</span>
        <span className="font-mono text-accent/60">Strain {bioContext.strain}</span>
        <span className="font-mono text-foreground/40">Vision {bioContext.focusScore}/100</span>
        {bioContext.postureWarning && (
          <span className="font-pixel text-[7px] text-yellow-400 animate-pulse">⚠ POSTURE</span>
        )}
        {bioContext.isSessionActive && (
          <span className="font-pixel text-[7px] text-primary animate-pulse">● ACTIVE</span>
        )}
        {recentReceipts.length > 0 && (
          <span className="font-pixel text-[7px] text-muted-foreground/40">{recentReceipts.length} RECEIPTS</span>
        )}
      </div>

      {/* Input */}
      <div
        className="p-3 flex gap-2 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : 'Query AURA...'}
          disabled={isLoading || isListening}
          className={cn(
            'flex-1 bg-white/5 px-4 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/30',
            'outline-none transition-all duration-200',
            'border',
            isListening
              ? 'border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse'
              : 'border-white/10 focus:border-primary/40 focus:shadow-[0_0_12px_rgba(0,245,255,0.15)]'
          )}
        />

        {speechSupported && (
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={cn(
              'p-2.5 rounded-xl border transition-all cursor-pointer flex-shrink-0',
              isListening
                ? 'border-red-500/60 text-red-400 bg-red-900/20'
                : 'border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary'
            )}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={() => setTtsEnabled((v) => !v)}
          className={cn(
            'p-2.5 rounded-xl border transition-all cursor-pointer flex-shrink-0',
            ttsEnabled
              ? 'border-primary/60 text-primary bg-primary/10'
              : 'border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary'
          )}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        <button
          onClick={() => void sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className={cn(
            'p-2.5 rounded-xl border border-primary/60 text-primary',
            'bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer flex-shrink-0',
            'shadow-[0_0_10px_rgba(0,245,255,0.15)] hover:shadow-[0_0_16px_rgba(0,245,255,0.3)]',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-0.5'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
