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
  
  // Basic mock auth state based on World ID nullifier hash
  const [nullifierHash, setNullifierHash] = useState<string | null>(() => {
    return localStorage.getItem('bio_ledger_nullifier');
  });

  const handleVerify = (hash: string) => {
    setNullifierHash(hash);
    localStorage.setItem('bio_ledger_nullifier', hash);
    setLocation("/dashboard");
  };

  const handleLogout = () => {
    setNullifierHash(null);
    localStorage.removeItem('bio_ledger_nullifier');
    setLocation("/");
  };

  // Redirect logic
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
          <Dashboard nullifierHash={nullifierHash} onLogout={handleLogout} />
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
