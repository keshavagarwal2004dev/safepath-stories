import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Volume2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { mockStorySlides } from "@/data/mockData";
import { toast } from "sonner";
import { getStorySlides } from "@/lib/api";

const StoryViewer = () => {
  const navigate = useNavigate();
  const { id: storyId } = useParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const slidesQuery = useQuery({
    queryKey: ["story-slides", storyId],
    queryFn: () => getStorySlides(storyId || ""),
    enabled: Boolean(storyId),
  });

  const slides = slidesQuery.data?.length ? slidesQuery.data : mockStorySlides;
  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  const handleChoice = (choiceId: string, correct: boolean) => {
    setSelectedChoice(choiceId);
    if (correct) {
      toast.success("Great choice! You're keeping safe! 🌟");
    } else {
      toast("Let's think again — the safe choice protects you!", { icon: "💡" });
    }
    setTimeout(() => {
      setSelectedChoice(null);
      if (currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1);
      } else {
        navigate("/student/reinforcement");
      }
    }, 1800);
  };

  const handleNext = () => {
    if (isLastSlide) {
      navigate("/student/reinforcement");
    } else {
      setCurrentSlide(currentSlide + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col gradient-story">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <Button variant="ghost" size="sm" className="text-card/80 hover:text-card hover:bg-card/10" onClick={() => navigate("/student/home")}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 mx-8">
          <div className="h-3 overflow-hidden rounded-full bg-card/15">
            <div
              className="h-full rounded-full gradient-hero transition-all duration-500 shadow-glow"
              style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-card/80 hover:text-card hover:bg-card/10" onClick={() => toast("🔊 Audio narration coming soon!")}>
          <Volume2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl animate-fade-in" key={currentSlide}>
          {/* Illustration */}
          <div className="mx-auto mb-8 overflow-hidden rounded-3xl shadow-elevated ring-1 ring-card/10 bg-gradient-to-br from-blue-200 to-purple-200">
            {slide.image ? (
              <img src={slide.image} alt={`Scene ${currentSlide + 1}`} className="h-56 w-full object-cover sm:h-72 md:h-80" onError={(e) => {e.currentTarget.style.display = 'none'}} />
            ) : null}
            {!slide.image && (
              <div className="h-56 w-full sm:h-72 md:h-80 flex items-center justify-center bg-gradient-to-br from-blue-300 to-purple-300">
                <p className="text-white font-bold text-center px-4">Scene {currentSlide + 1}</p>
              </div>
            )}
          </div>

          {/* Text */}
          <p className="mb-10 text-center font-display text-xl font-bold leading-relaxed text-card sm:text-2xl md:text-3xl">
            {slide.text}
          </p>

          {/* Choices or Next */}
          {slide.choices ? (
            <div className="space-y-4">
              {slide.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleChoice(choice.id, choice.correct)}
                  disabled={selectedChoice !== null}
                  className={`w-full rounded-2xl px-6 py-5 text-left font-display text-base font-bold transition-all duration-300 sm:text-lg ${
                    selectedChoice === choice.id
                      ? choice.correct
                        ? "bg-success text-success-foreground scale-[1.02] shadow-lg"
                        : "bg-destructive text-destructive-foreground scale-[0.98]"
                      : "bg-card/10 text-card hover:bg-card/20 border-2 border-card/15 hover:border-primary/50 backdrop-blur-sm"
                  }`}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-center">
              <Button size="lg" className="min-w-[220px] text-base font-bold shadow-glow" onClick={handleNext}>
                {isLastSlide ? "Finish Story ✨" : "Next →"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Slide counter */}
      <div className="pb-5 text-center text-sm font-semibold text-card/40">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  );
};

export default StoryViewer;
