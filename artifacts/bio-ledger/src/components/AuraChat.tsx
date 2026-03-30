import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Camera, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auraChat, auraVision, type AuraChatRequest } from '@workspace/api-client-react';
import type { WellnessChallenge } from '@/hooks/use-wellness-coach';

export interface AuraBioContext {
  hrv: number;
  strain: number;
  apm: number;
  focusScore: number;
  postureWarning: boolean;
  isSessionActive: boolean;
  sessionDurationSeconds: number;
  hourOfDay: number;
  sessionMinutes?: number;
  completedChallenges?: string[];
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
  xpAwarded?: number;
}

interface AuraChatProps {
  bioContext: AuraBioContext;
  nullifierHash: string;
  onInsightSigned?: (text: string) => void;
  proactiveNudge?: string | null;
  onNudgeClear?: () => void;
  /** Direct AURA message injection — appears as AURA speaking (no API round-trip) */
  auraInjectMessage?: string | null;
  onAuraInjectClear?: () => void;
  recentReceipts?: ReceiptSummaryItem[];
  activeChallenge?: WellnessChallenge | null;
  captureFrame?: () => string | null;
  onChallengeComplete?: (challengeId: string, xpAwarded: number) => void;
  onChallengeDismiss?: () => void;
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
interface SpeechRecognitionEvent { results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; length: number; }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative; isFinal: boolean; }
interface SpeechRecognitionAlternative { transcript: string; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }

function formatReceiptSummary(r: ReceiptSummaryItem): string {
  const mins = Math.round(r.durationSeconds / 60);
  const date = new Date(r.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (r.receiptType === 'wellness' && r.insightText) {
    return `[${date}] Wellness Challenge: ${r.insightText.replace(/^\[WELLNESS \+\d+XP\] /, '')}`;
  }
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
  auraInjectMessage,
  onAuraInjectClear,
  recentReceipts = [],
  activeChallenge,
  captureFrame,
  onChallengeComplete,
  onChallengeDismiss,
}: AuraChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! 🌸 I'm AURA, your personal wellness companion. I can see you're doing great — HRV ${bioContext.hrv}ms looks healthy! I'm here whenever you need a check-in, a motivational nudge, or just someone to talk to. Start a focus session and let's make today amazing together! ✨`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [latestXP, setLatestXP] = useState<number | null>(null);
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

      const summaries = recentReceipts.slice(-3).map(formatReceiptSummary);

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
            content: `Connection hiccup! 💜 Your data is safe though — HRV ${bioContext.hrv}ms, Strain ${bioContext.strain}/21. Give it a moment and try again.`,
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

  const handleShowAura = useCallback(async () => {
    if (!activeChallenge || !captureFrame || isVisionLoading) return;
    const frame = captureFrame();
    setIsVisionLoading(true);

    const userMsg: Message = {
      role: 'user',
      content: `📸 [Showing AURA my camera for: ${activeChallenge.title}]`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await auraVision({
        imageBase64: frame ?? '',
        challengeType: activeChallenge.type,
        bioContext: { hrv: bioContext.hrv, strain: bioContext.strain, apm: bioContext.apm },
      });

      const auraMsg: Message = {
        role: 'assistant',
        content: result.response,
        fallback: result.fallback,
        timestamp: new Date(),
        xpAwarded: result.xpAwarded,
      };
      setMessages((prev) => [...prev, auraMsg]);
      speakText(result.response);

      if (result.challengeVerified) {
        setLatestXP(result.xpAwarded);
        setTimeout(() => setLatestXP(null), 3000);
        onChallengeComplete?.(activeChallenge.id, result.xpAwarded);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I couldn't quite see that, but I trust you! 💜 Challenge marked complete — +${activeChallenge.xpReward} XP for taking care of yourself!`,
          fallback: true,
          timestamp: new Date(),
          xpAwarded: activeChallenge.xpReward,
        },
      ]);
      onChallengeComplete?.(activeChallenge.id, activeChallenge.xpReward);
      setLatestXP(activeChallenge.xpReward);
      setTimeout(() => setLatestXP(null), 3000);
    } finally {
      setIsVisionLoading(false);
    }
  }, [activeChallenge, captureFrame, isVisionLoading, bioContext, speakText, onChallengeComplete]);

  useEffect(() => {
    if (!proactiveNudge) {
      nudgeSentRef.current = null;
      return;
    }
    if (proactiveNudge === nudgeSentRef.current) return;
    nudgeSentRef.current = proactiveNudge;
    const timer = setTimeout(() => {
      void sendMessage(proactiveNudge);
      onNudgeClear?.();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proactiveNudge]);

  // Inject an AURA message directly (no API round-trip) — used for wellness challenge dispatch
  const injectSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auraInjectMessage) {
      injectSentRef.current = null;
      return;
    }
    if (auraInjectMessage === injectSentRef.current) return;
    injectSentRef.current = auraInjectMessage;
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: auraInjectMessage, timestamp: new Date() },
    ]);
    onAuraInjectClear?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auraInjectMessage]);

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

      {/* ── Active Challenge Banner ────────────────────────────────── */}
      <AnimatePresence>
        {activeChallenge && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-3 flex items-start gap-3 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(251,113,133,0.06) 100%)',
                borderBottom: '1px solid rgba(139,92,246,0.22)',
              }}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{activeChallenge.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-pixel text-[7px] text-violet-400/90 uppercase tracking-wider">
                    AURA CHALLENGE
                  </span>
                  <span className="font-pixel text-[6px] text-amber-400/80 border border-amber-400/30 px-1 rounded">
                    +{activeChallenge.xpReward} XP
                  </span>
                </div>
                <p className="font-terminal text-sm text-violet-100/80 leading-relaxed">
                  {activeChallenge.nudgeMessage}
                </p>
                {/* "Done" button for manual verification challenges (e.g. Mindful Breath) */}
                {activeChallenge.verificationMethod === 'manual' && (
                  <button
                    onClick={() => {
                      onChallengeComplete?.(activeChallenge.id, activeChallenge.xpReward);
                      setLatestXP(activeChallenge.xpReward);
                      setTimeout(() => setLatestXP(null), 3000);
                    }}
                    className="mt-2 font-terminal text-xs font-semibold px-3 py-1 rounded-lg border border-emerald-400/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    ✓ Done — +{activeChallenge.xpReward} XP
                  </button>
                )}
              </div>
              <button
                onClick={onChallengeDismiss}
                className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── XP Earned Toast ───────────────────────────────────────── */}
      <AnimatePresence>
        {latestXP !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            className="absolute top-16 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(251,113,133,0.15) 100%)',
              border: '1px solid rgba(245,158,11,0.4)',
              boxShadow: '0 0 20px rgba(245,158,11,0.3)',
            }}
          >
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="font-pixel text-[8px] text-amber-300 font-bold">+{latestXP} XP!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ──────────────────────────────────────────────── */}
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
                <div className="max-w-[82%] flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="font-pixel text-[7px] text-violet-400/90">AURA</span>
                    {msg.fallback && (
                      <span className="font-pixel text-[6px] text-muted-foreground/40 border border-muted-foreground/20 px-1 rounded">
                        offline
                      </span>
                    )}
                    {msg.xpAwarded && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="font-pixel text-[6px] text-amber-400 border border-amber-400/30 px-1 rounded flex items-center gap-0.5"
                      >
                        <Star className="w-1.5 h-1.5 fill-amber-400" />
                        +{msg.xpAwarded} XP
                      </motion.span>
                    )}
                  </div>
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed break-words"
                    style={{
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.22)',
                      boxShadow: '0 0 18px rgba(139, 92, 246, 0.14)',
                      color: 'rgba(230, 220, 255, 0.93)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span className="font-terminal text-sm text-muted-foreground/30 ml-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <div className="max-w-[82%] flex flex-col gap-1 items-end">
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed break-words"
                    style={{
                      background: 'rgba(251, 113, 133, 0.08)',
                      border: '1px solid rgba(251, 113, 133, 0.22)',
                      boxShadow: '0 0 14px rgba(251, 113, 133, 0.10)',
                      color: 'rgba(255, 225, 230, 0.93)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span className="font-terminal text-sm text-muted-foreground/30 mr-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {(isLoading || isVisionLoading) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-start"
          >
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2"
              style={{
                background: 'rgba(139, 92, 246, 0.07)',
                border: '1px solid rgba(139, 92, 246, 0.18)',
              }}
            >
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              <span className="font-terminal text-sm text-violet-300/70">
                {isVisionLoading ? 'AURA is looking…' : 'AURA is thinking…'}
              </span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Live bio-context bar ──────────────────────────────────── */}
      <div
        className="px-4 py-2 flex items-center gap-3 flex-wrap backdrop-blur-xl"
        style={{
          background: 'rgba(139,92,246,0.05)',
          borderTop: '1px solid rgba(139,92,246,0.15)',
        }}
      >
        <span className="font-pixel text-[7px] text-violet-400/50">LIVE</span>
        <span className="font-terminal text-sm text-violet-300/70">HRV {bioContext.hrv}ms</span>
        <span className="font-terminal text-sm text-rose-300/60">Strain {bioContext.strain}</span>
        <span className="font-terminal text-sm text-foreground/40">Vision {bioContext.focusScore}/100</span>
        {bioContext.postureWarning && (
          <span className="font-terminal text-sm text-amber-400 animate-pulse">💛 Posture</span>
        )}
        {bioContext.isSessionActive && (
          <span className="font-pixel text-[7px] text-emerald-400 animate-pulse">● Focus on</span>
        )}
        {recentReceipts.length > 0 && (
          <span className="font-pixel text-[7px] text-violet-400/50">{recentReceipts.length} milestones</span>
        )}
      </div>

      {/* ── Input row ─────────────────────────────────────────────── */}
      <div
        className="p-3 flex gap-2 items-center"
        style={{ borderTop: '1px solid rgba(139,92,246,0.12)' }}
      >
        {/* Camera / Show AURA button — visible when vision challenge is active */}
        <AnimatePresence>
          {activeChallenge && activeChallenge.verificationMethod === 'vision' && captureFrame && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 'auto' }}
              exit={{ opacity: 0, scale: 0.8, width: 0 }}
              onClick={() => void handleShowAura()}
              disabled={isVisionLoading}
              className={cn(
                'p-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0',
                'border-violet-400/60 text-violet-300 bg-violet-500/12',
                'hover:bg-violet-500/22 hover:shadow-[0_0_14px_rgba(139,92,246,0.35)]',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              title="Show AURA your camera to verify challenge"
            >
              {isVisionLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Camera className="w-4 h-4" />
              }
              <span className="font-terminal text-sm font-medium whitespace-nowrap pr-1">
                Show AURA
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening…' : 'Ask AURA anything…'}
          disabled={isLoading || isListening}
          className={cn(
            'flex-1 bg-violet-500/5 px-4 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40',
            'outline-none transition-all duration-200',
            'border',
            isListening
              ? 'border-rose-500/60 shadow-[0_0_12px_rgba(251,113,133,0.2)] animate-pulse'
              : 'border-violet-500/15 focus:border-violet-400/50 focus:shadow-[0_0_14px_rgba(139,92,246,0.18)]'
          )}
        />

        {speechSupported && (
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={cn(
              'p-2.5 rounded-xl border transition-all cursor-pointer flex-shrink-0',
              isListening
                ? 'border-rose-500/60 text-rose-400 bg-rose-900/20'
                : 'border-violet-500/20 text-muted-foreground hover:border-violet-400/50 hover:text-violet-300'
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
              ? 'border-violet-400/60 text-violet-300 bg-violet-500/12'
              : 'border-violet-500/20 text-muted-foreground hover:border-violet-400/50 hover:text-violet-300'
          )}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        <button
          onClick={() => void sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className={cn(
            'p-2.5 rounded-xl border border-violet-400/60 text-violet-300',
            'bg-violet-500/12 hover:bg-violet-500/22 transition-all cursor-pointer flex-shrink-0',
            'shadow-[0_0_10px_rgba(139,92,246,0.18)] hover:shadow-[0_0_18px_rgba(139,92,246,0.32)]',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-0.5'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
