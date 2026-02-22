import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { topicOptions, ageGroupOptions, languageOptions } from "@/data/mockData";
import { createStory } from "@/lib/api";
import { toast } from "sonner";

const CreateStory = () => {
  const navigate = useNavigate();
  // ✅ REFACTORED: No longer need ngoId - extracted from JWT token by backend

  const [topic, setTopic] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [characterCount, setCharacterCount] = useState("1");
  const [regionContext, setRegionContext] = useState("");
  const [description, setDescription] = useState("");
  const [moralLesson, setMoralLesson] = useState("");

  const createMutation = useMutation({
    mutationFn: createStory,
    onSuccess: ({ story }) => {
      toast.success("Story generated successfully");
      navigate(`/ngo/story-preview?storyId=${story.id}`);
    },
    onError: (error) => {
      console.error("Story creation error:", error);
      const message = error instanceof Error ? error.message : "Could not generate story";
      // ✅ Show more detailed error info
      if (message.includes("Validation error")) {
        toast.error("Validation error: " + message);
      } else {
        toast.error(message);
      }
    },
  });

  const isGenerating = createMutation.isPending;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic || !ageGroup || !language || !description.trim()) {
      toast.error("Please fill topic, age group, language and story description");
      return;
    }

    // ✅ Validate token exists before sending
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Not authenticated. Please sign in again.");
      return;
    }

    const generatedTitle = `${topic} Adventure`;
    const payload = {
      title: generatedTitle,
      topic,
      ageGroup,
      language,
      characterCount: Number(characterCount),
      regionContext: regionContext || undefined,
      description: description.trim(),
      moralLesson: moralLesson || undefined,
    };
    
    // ✅ Debug logging
    console.log("Creating story with payload:", payload);
    console.log("Token present:", !!token);
    
    // ✅ REFACTORED: ngoId removed - extracted from JWT token by backend
    createMutation.mutate(payload);
  };

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-black text-foreground">Create New Story</h1>
        <p className="mt-1 text-muted-foreground">Configure your story scenario and let AI generate it for you.</p>
      </div>

      <Card className="mx-auto max-w-2xl border-0 shadow-elevated">
        <div className="h-1 w-full gradient-hero rounded-t-lg" />
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-xl">Story Configuration</CardTitle>
          <CardDescription>Fill in the details below to generate a personalized safety story.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-semibold">Safety Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>
                    {topicOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Age Group</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger><SelectValue placeholder="Select age group" /></SelectTrigger>
                  <SelectContent>
                    {ageGroupOptions.map((a) => <SelectItem key={a} value={a}>{a} years</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Number of Characters</Label>
                <Select value={characterCount} onValueChange={setCharacterCount}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} character{n > 1 ? "s" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Region / Cultural Context</Label>
              <Input placeholder="e.g., Urban India, Rural Maharashtra, Delhi NCR" value={regionContext} onChange={(e) => setRegionContext(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Story Description</Label>
              <Textarea placeholder="Describe the scenario you want the AI to build a story around..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Moral Lesson (Optional)</Label>
              <Input placeholder="e.g., Always tell a trusted adult if someone makes you feel unsafe" value={moralLesson} onChange={(e) => setMoralLesson(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="w-full gap-2 font-bold text-base shadow-glow" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating Story...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" /> Generate Story with AI
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateStory;
