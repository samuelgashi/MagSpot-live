import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthenticatedRoute, SignInRoute } from "@/lib/auth";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AuthenticatedRoute>
                <Index />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <AuthenticatedRoute>
                <Tasks />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthenticatedRoute>
                <Settings />
              </AuthenticatedRoute>
            }
          />
          <Route path="/sign-in/*" element={<SignInRoute />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
