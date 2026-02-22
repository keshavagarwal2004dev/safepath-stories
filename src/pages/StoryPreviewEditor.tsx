import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Edit3, RefreshCw, Check, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockStorySlides } from "@/data/mockData";
import { toast } from "sonner";
import { getStory, getStorySlides } from "@/lib/api";

const StoryPreviewEditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storyId = searchParams.get("storyId") || "";
  const [currentSlide, setCurrentSlide] = useState(0);

  const storyQuery = useQuery({
    queryKey: ["story", storyId],
    queryFn: () => getStory(storyId),
    enabled: Boolean(storyId),
  });

  const slidesQuery = useQuery({
    queryKey: ["story-slides", "preview", storyId],
    queryFn: () => getStorySlides(storyId),
    enabled: Boolean(storyId),
  });

  const slides = slidesQuery.data?.length ? slidesQuery.data : mockStorySlides;
  const slide = slides[currentSlide];

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-foreground">{storyQuery.data?.title || "Story Preview"}</h1>
          <p className="mt-1 text-muted-foreground">Review and edit your AI-generated story</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 font-semibold" onClick={() => { toast.success("Draft saved!"); }}>
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button className="gap-2 font-bold shadow-glow" onClick={() => { toast.success("Story approved!"); navigate("/ngo/my-stories"); }}>
            <Check className="h-4 w-4" /> Approve Story
          </Button>
        </div>
      </div>

      <Card className="mx-auto max-w-3xl overflow-hidden border-0 shadow-elevated">
        <div className="h-1.5 w-full gradient-hero" />
        <div className="relative bg-gradient-to-br from-blue-200 to-purple-200">
          {slide.image ? (
            <img src={slide.image} alt={`Slide ${currentSlide + 1}`} className="h-80 w-full object-cover md:h-[420px]" onError={(e) => {e.currentTarget.style.display = 'none'}} />
          ) : null}
          {!slide.image && (
            <div className="h-80 md:h-[420px] w-full flex items-center justify-center bg-gradient-to-br from-blue-300 to-purple-300">
              <p className="text-white font-bold text-2xl">Slide {currentSlide + 1}</p>
            </div>
          )}
          <div className="absolute right-3 top-3 flex gap-2">
            <Button size="sm" variant="secondary" className="gap-1 text-xs font-bold shadow-sm" onClick={() => toast.info('Edit Text feature coming soon!')}>
              <Edit3 className="h-3 w-3" /> Edit Text
            </Button>
            <Button size="sm" variant="secondary" className="gap-1 text-xs font-bold shadow-sm" onClick={() => toast.info('Regenerate feature coming soon!')}>
              <RefreshCw className="h-3 w-3" /> Regenerate
            </Button>
          </div>
          <div className="absolute bottom-3 left-3 rounded-full bg-foreground/70 px-4 py-1.5 text-xs font-bold text-card backdrop-blur-sm">
            Slide {currentSlide + 1} of {slides.length}
          </div>
        </div>
        <CardContent className="p-8">
          <p className="mb-6 text-lg leading-relaxed text-foreground">{slide.text}</p>
          {slide.choices && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Branching Choices:</p>
              {slide.choices.map((choice) => (
                <div key={choice.id} className={`rounded-2xl border-2 p-5 ${choice.correct ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${choice.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {choice.correct ? "✓ Safe" : "✗ Unsafe"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{choice.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" className="font-semibold" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`rounded-full transition-all duration-300 ${i === currentSlide ? "h-3 w-10 gradient-hero" : "h-3 w-3 bg-muted hover:bg-muted-foreground/30"}`}
                />
              ))}
            </div>
            <Button variant="outline" className="font-semibold" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoryPreviewEditor;
