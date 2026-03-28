import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import LockScreen from "@/pages/LockScreen";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";

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

  // 'bio_ledger_nullifier' is a persistent identity (World ID public key — never deleted).
  // 'bio_ledger_session' is cleared on logout so a page refresh after locking requires re-verification.
  const [nullifierHash, setNullifierHash] = useState<string | null>(() => {
    const hasSession = sessionStorage.getItem('bio_ledger_session') === '1';
    return hasSession ? localStorage.getItem('bio_ledger_nullifier') : null;
  });
  const [bioSourceConnected, setBioSourceConnected] = useState<boolean>(() => {
    return localStorage.getItem('bio_ledger_bio_source') === 'connected';
  });

  const handleVerify = (hash: string, bioConnected: boolean) => {
    setNullifierHash(hash);
    setBioSourceConnected(bioConnected);
    localStorage.setItem('bio_ledger_nullifier', hash);
    localStorage.setItem('bio_ledger_bio_source', bioConnected ? 'connected' : 'demo');
    sessionStorage.setItem('bio_ledger_session', '1');
    setLocation("/dashboard");
  };

  const handleLogout = () => {
    setNullifierHash(null);
    setBioSourceConnected(false);
    // bio_ledger_nullifier stays in localStorage (persistent identity — never deleted).
    // Clearing the session flag means a page refresh after lock requires re-verification.
    sessionStorage.removeItem('bio_ledger_session');
    localStorage.removeItem('bio_ledger_bio_source');
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
