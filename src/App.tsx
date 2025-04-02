
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import StudyPlanner from "./pages/StudyPlanner";
import DoubtSolver from "./pages/DoubtSolver";
import FlashcardGenerator from "./pages/FlashcardGenerator";
import NotesSummarizer from "./pages/NotesSummarizer";
import SavedPDFs from "./pages/SavedPDFs";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
            <Route path="/doubt-solver" element={<ProtectedRoute><DoubtSolver /></ProtectedRoute>} />
            <Route path="/flashcard-generator" element={<ProtectedRoute><FlashcardGenerator /></ProtectedRoute>} />
            <Route path="/notes-summarizer" element={<ProtectedRoute><NotesSummarizer /></ProtectedRoute>} />
            <Route path="/saved-pdfs" element={<ProtectedRoute><SavedPDFs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
