import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Result from "./pages/Result";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Patients from "./pages/Patients";
import NotFound from "./pages/NotFound";
import VisitDetail from "./pages/VisitDetail";
import CameraOCR from "./pages/CameraOCR";
import Search from "./pages/Search";

import DDXTool from "./pages/DDXTool";
import Triage from "./pages/Triage";
import QueueList from "./pages/QueueList";
import VoiceMode from "./pages/VoiceMode";
import PatientIntake from "./pages/PatientIntake";
import PublicHealthDashboard from "./pages/PublicHealthDashboard";
import AIAnalytics from "./pages/AIAnalytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/camera" element={<CameraOCR />} />
              <Route path="/search" element={<Search />} />
              <Route path="/voice" element={<VoiceMode />} />
              <Route path="/patient-intake" element={<PatientIntake />} />
              <Route path="/surveillance" element={<PublicHealthDashboard />} />
              <Route path="/ai-analytics" element={<AIAnalytics />} />

              <Route path="/visit/:id" element={<VisitDetail />} />
              <Route path="/ddx" element={<DDXTool />} />
              <Route path="/emergency/triage" element={<Triage />} />
              <Route path="/queue/:category" element={<QueueList />} />
              <Route path="/result/:id" element={<Result />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
