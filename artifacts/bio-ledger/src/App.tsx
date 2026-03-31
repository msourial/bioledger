import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import LockScreen from "@/pages/LockScreen";
import type { WearableSource, VerifyPayload } from "@/pages/LockScreen";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import PrivyProviderWrapper from "@/providers/PrivyProviderWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import { usePrivySafe } from "@/hooks/use-privy-safe";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  const [location, setLocation] = useLocation();
  const privy = usePrivySafe();

  // 'bio_ledger_nullifier' is a persistent identity (World ID public key — never deleted).
  // 'bio_ledger_session' is cleared on logout so a page refresh after locking requires re-verification.
  const [nullifierHash, setNullifierHash] = useState<string | null>(() => {
    const hasSession = sessionStorage.getItem('bio_ledger_session') === '1';
    return hasSession ? localStorage.getItem('bio_ledger_nullifier') : null;
  });
  const [bioSourceConnected, setBioSourceConnected] = useState<boolean>(() => {
    return localStorage.getItem('bio_ledger_bio_source') === 'connected';
  });
  const [wearableSource, setWearableSource] = useState<WearableSource>(() => {
    return (localStorage.getItem('bio_ledger_wearable') as WearableSource) || 'demo';
  });
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    const hasSession = sessionStorage.getItem('bio_ledger_session') === '1';
    return hasSession ? localStorage.getItem('bio_ledger_wallet_address') : null;
  });

  const handleVerify = (payload: VerifyPayload) => {
    setNullifierHash(payload.nullifierHash);
    setBioSourceConnected(payload.bioSourceConnected);
    setWearableSource(payload.wearableSource);
    setWalletAddress(payload.walletAddress);
    localStorage.setItem('bio_ledger_nullifier', payload.nullifierHash);
    localStorage.setItem('bio_ledger_bio_source', payload.bioSourceConnected ? 'connected' : 'demo');
    localStorage.setItem('bio_ledger_wearable', payload.wearableSource);
    if (payload.walletAddress) {
      localStorage.setItem('bio_ledger_wallet_address', payload.walletAddress);
    }
    sessionStorage.setItem('bio_ledger_session', '1');
    setLocation("/dashboard");
  };

  const handleLogout = async () => {
    // Logout from Privy wallet if connected
    if (privy.privyAvailable && privy.authenticated) {
      try { await privy.logout(); } catch { /* ignore */ }
    }
    setNullifierHash(null);
    setBioSourceConnected(false);
    setWearableSource('demo');
    setWalletAddress(null);
    sessionStorage.removeItem('bio_ledger_session');
    localStorage.removeItem('bio_ledger_bio_source');
    localStorage.removeItem('bio_ledger_wearable');
    localStorage.removeItem('bio_ledger_wallet_address');
    setLocation("/");
  };

  useEffect(() => {
    if (nullifierHash && location === "/") {
      setLocation("/dashboard");
    } else if (!nullifierHash && location !== "/") {
      setLocation("/");
    }
  }, [nullifierHash, location, setLocation]);

  return (
    <Switch>
      <Route path="/">
        <LockScreen onVerify={handleVerify} />
      </Route>
      <Route path="/dashboard">
        {nullifierHash ? (
          <Dashboard
            nullifierHash={nullifierHash}
            bioSourceConnected={bioSourceConnected}
            wearableSource={wearableSource}
            walletAddress={walletAddress}
            onLogout={handleLogout}
          />
        ) : (
          <LockScreen onVerify={handleVerify} />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <PrivyProviderWrapper>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </PrivyProviderWrapper>
    </ErrorBoundary>
  );
}

export default App;
