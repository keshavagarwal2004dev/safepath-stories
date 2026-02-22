import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import NgoLogin from "./pages/NgoLogin";
import NgoSignup from "./pages/NgoSignup";
import StudentSignup from "./pages/StudentSignup";
import NgoLayout from "./pages/NgoLayout";
import NgoDashboard from "./pages/NgoDashboard";
import CreateStory from "./pages/CreateStory";
import StoryPreviewEditor from "./pages/StoryPreviewEditor";
import MyStories from "./pages/MyStories";
import StudentHome from "./pages/StudentHome";
import StoryViewer from "./pages/StoryViewer";
import ReinforcementScreen from "./pages/ReinforcementScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/ngo-login" element={<NgoLogin />} />
          <Route path="/ngo-signup" element={<NgoSignup />} />
          <Route path="/student-signup" element={<StudentSignup />} />
          <Route path="/ngo" element={<NgoLayout />}>
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <NgoDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="create-story" element={<CreateStory />} />
            <Route path="story-preview" element={<StoryPreviewEditor />} />
            <Route path="my-stories" element={<MyStories />} />
            <Route path="analytics" element={<NgoDashboard />} />
            <Route path="settings" element={<NgoDashboard />} />
          </Route>
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="/student/story/:id" element={<StoryViewer />} />
          <Route path="/student/reinforcement" element={<ReinforcementScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
