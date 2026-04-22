import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dashboard } from "./pages/Dashboard";
import { LoginPage } from "./pages/LoginPage";
import { useEffect, useState, useCallback } from "react";
import { isAuthenticated } from "@/lib/auth";

const queryClient = new QueryClient();

function App() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleLogin = useCallback(() => {
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthed(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {authed ? (
          <Dashboard onLogout={handleLogout} />
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
