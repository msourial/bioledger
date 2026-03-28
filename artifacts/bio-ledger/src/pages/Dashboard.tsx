import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Activity, Brain, Clock, MousePointer2, ShieldCheck, HardDrive, LogOut } from 'lucide-react';
import { useMockBioData } from '@/lib/whoop-mock';
import { useAPM } from '@/hooks/use-apm';
import { PixelPanel, PixelButton, NeonText } from '@/components/PixelUI';
import { cn, truncateHash } from '@/lib/utils';
import { signWorkReceipt, storeToFilecoin } from '@/lib/companion-agent';
import { useListReceipts, useCreateReceipt } from '@workspace/api-client-react';

interface DashboardProps {
  nullifierHash: string;
  onLogout: () => void;
}

interface SessionHistoryEntry {
  id: string;
  completedAt: Date;
  apm: number;
  hrv: number;
  strain: number;
  focusScore: number;
}

const POMODORO_TIME = 25 * 60; // 25 minutes

export default function Dashboard({ nullifierHash, onLogout }: DashboardProps) {
  // Bio Data & APM
  const { hrv, strain } = useMockBioData();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const apm = useAPM(isSessionActive);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME);
  const [isFiling, setIsFiling] = useState(false);

  // Local session history (in-memory, distinct from persisted receipts ledger)
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  // API Hooks
  const { data: receipts, isLoading: isReceiptsLoading, refetch: refetchReceipts } = useListReceipts({ nullifier: nullifierHash });
  const createReceiptMutation = useCreateReceipt();

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isSessionActive && timeLeft === 0) {
      handleSessionComplete();
    }
    return () => clearInterval(interval);
  }, [isSessionActive, timeLeft]);

  const handleSessionComplete = async () => {
    setIsSessionActive(false);
    setIsFiling(true);

    const focusScore = Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60));
    const stats = {
      durationSeconds: POMODORO_TIME,
      apm,
      hrv,
      strain,
      focusScore,
    };

    const signedReceipt = await signWorkReceipt(nullifierHash, stats);
    const cid = await storeToFilecoin(signedReceipt);
    signedReceipt.receiptCid = cid;

    // Record in local session history immediately (before network round-trip)
    const historyEntry: SessionHistoryEntry = {
      id: crypto.randomUUID(),
      completedAt: new Date(),
      ...stats,
    };
    setSessionHistory((prev) => [historyEntry, ...prev]);

    const payload = {
      nullifierHash,
      sessionStats: stats,
      companionSignature: signedReceipt.companionSignature,
      receiptCid: cid,
    };

    createReceiptMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          setIsFiling(false);
          setTimeLeft(POMODORO_TIME);
          refetchReceipts();
        },
        onError: (err: unknown) => {
          console.error("Failed to save receipt", err);
          setIsFiling(false);
        },
      }
    );
  };

  const toggleTimer = () => {
    setIsSessionActive(!isSessionActive);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen w-full bg-background scanlines flex flex-col md:flex-row overflow-hidden text-foreground">
      
      {/* LEFT PANE: LIVING ROOM */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative border-b-4 md:border-b-0 md:border-r-4 border-secondary overflow-hidden flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Room Background"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 p-4 sm:p-6 flex justify-between items-start">
          <div>
            <h2 className="font-pixel text-sm sm:text-base mb-1">SOVEREIGN VAULT</h2>
            <div className="flex items-center gap-2 text-[10px] font-pixel text-muted-foreground">
              <ShieldCheck className="w-3 h-3 text-primary" />
              ID: {truncateHash(nullifierHash)}
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 bg-card border-2 border-muted hover:border-accent text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            title="Lock Vault"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Avatars */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/avatar.png`} 
              alt="User Avatar"
              className="w-48 h-48 sm:w-64 sm:h-64 object-contain filter drop-shadow-[0_0_15px_rgba(112,41,99,0.5)]"
            />
            
            {/* Companion AI */}
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                x: [0, 5, 0]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-10 w-24 h-24"
            >
              <img 
                src={`${import.meta.env.BASE_URL}images/companion.png`} 
                alt="Companion AI"
                className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(0,245,255,0.8)]"
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom: Bio-Markers */}
        <div className="relative z-10 p-4 sm:p-8 flex gap-4">
          <PixelPanel className="flex-1 bg-card/80 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground font-pixel text-[10px]">
              <Activity className="w-3 h-3 text-accent" />
              HRV (ms)
            </div>
            <div className="text-3xl font-terminal font-bold">
              <NeonText color="magenta">{hrv}</NeonText>
            </div>
          </PixelPanel>
          <PixelPanel className="flex-1 bg-card/80 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground font-pixel text-[10px]">
              <Brain className="w-3 h-3 text-accent" />
              STRAIN
            </div>
            <div className="text-3xl font-terminal font-bold text-foreground">
              {strain}
              <span className="text-xs text-muted-foreground ml-1">/21</span>
            </div>
          </PixelPanel>
        </div>
      </div>

      {/* RIGHT PANE: LEDGER */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col bg-background/95">
        
        {/* Top: Timer & Stats */}
        <div className="p-4 sm:p-8 border-b-4 border-secondary/30">
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-pixel text-[10px]">
                <Clock className="w-4 h-4 text-primary" />
                FOCUS TIMER
              </div>
              <div className={cn(
                "text-6xl sm:text-8xl font-terminal font-bold transition-colors duration-500",
                isSessionActive ? "text-primary text-shadow-neon" : "text-foreground"
              )}>
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="text-right pb-2">
              <div className="flex items-center justify-end gap-2 mb-1 text-muted-foreground font-pixel text-[10px]">
                <MousePointer2 className="w-3 h-3 text-primary" />
                APM
              </div>
              <div className="text-2xl sm:text-4xl font-terminal text-primary">
                {apm}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isFiling ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full bg-primary/20 border-2 border-primary p-4 flex items-center justify-center gap-3 text-primary font-pixel text-xs"
              >
                <HardDrive className="w-4 h-4 animate-bounce" />
                FILING TO FILECOIN...
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <PixelButton 
                  onClick={toggleTimer} 
                  variant={isSessionActive ? "danger" : "primary"}
                  className="w-full text-lg"
                >
                  {isSessionActive ? "ABORT FLOW" : "ENGAGE FLOW"}
                </PixelButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom: Receipt Log */}
        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
          {/* Session History (in-memory, current app session) */}
          {sessionHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="font-pixel text-[10px] mb-2 text-accent border-b-2 border-accent/20 pb-1">
                SESSION HISTORY (THIS VAULT)
              </h3>
              <div className="flex flex-col gap-1">
                {sessionHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between bg-accent/5 border-l-2 border-accent px-3 py-1">
                    <span className="font-terminal text-xs text-muted-foreground">
                      {format(entry.completedAt, "HH:mm")}
                    </span>
                    <span className="font-terminal text-xs">
                      Score <NeonText>{entry.focusScore}</NeonText>
                    </span>
                    <span className="font-terminal text-xs text-muted-foreground">
                      APM {entry.apm} · HRV {entry.hrv}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-pixel text-xs sm:text-sm mb-4 text-muted-foreground border-b-2 border-secondary/30 pb-2">
            AGENTIC WORK RECEIPTS (ERC-8004)
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
            {isReceiptsLoading ? (
              <div className="text-center font-terminal text-muted-foreground py-8 animate-pulse">
                SYNCING LEDGER...
              </div>
            ) : receipts && receipts.length > 0 ? (
              receipts.map((receipt) => (
                <div key={receipt.id} className="bg-card border-l-4 border-primary p-4 hover:bg-card/80 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-terminal text-xs text-muted-foreground">
                      {format(new Date(receipt.createdAt), "MMM dd, yyyy HH:mm")}
                    </span>
                    <span className="font-pixel text-[8px] px-2 py-1 bg-primary/10 text-primary border border-primary/30">
                      VERIFIED
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="font-terminal text-lg">
                      Dur: <span className="text-foreground">{Math.round(receipt.sessionStats.durationSeconds / 60)}m</span>
                    </div>
                    <div className="font-terminal text-lg">
                      APM: <span className="text-foreground">{receipt.sessionStats.apm}</span>
                    </div>
                    <div className="font-terminal text-lg">
                      HRV: <span className="text-accent">{receipt.sessionStats.hrv}</span>
                    </div>
                    <div className="font-terminal text-lg">
                      Score: <NeonText>{receipt.sessionStats.focusScore}</NeonText>
                    </div>
                  </div>
                  <div className="bg-background/50 p-2 font-terminal text-[10px] sm:text-xs text-muted-foreground break-all rounded-sm border border-secondary/20">
                    <div className="flex gap-2"><span className="text-accent">SIG:</span> {truncateHash(receipt.companionSignature)}</div>
                    {receipt.receiptCid && (
                      <div className="flex gap-2"><span className="text-primary">CID:</span> {truncateHash(receipt.receiptCid)}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center font-terminal text-muted-foreground py-8">
                NO RECEIPTS FOUND. ENGAGE FLOW TO BEGIN.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
