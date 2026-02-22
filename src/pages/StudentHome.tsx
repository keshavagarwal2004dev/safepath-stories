import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, LogOut, Sun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockStories, topicOptions, ageGroupOptions } from "@/data/mockData";
import { getStories } from "@/lib/api";

const StudentHome = () => {
  const [topicFilter, setTopicFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const studentProfile = JSON.parse(localStorage.getItem("student_profile") || "{}");

  const storiesQuery = useQuery({
    queryKey: ["stories", "student-home", topicFilter, ageFilter],
    queryFn: () => getStories({ status: "published", topic: topicFilter || undefined, ageGroup: ageFilter || undefined }),
  });

  const stories = storiesQuery.data?.length ? storiesQuery.data : mockStories;
  const continueStory = stories[0];

  const filteredStories = stories.filter((s) => {
    if (topicFilter && s.topic !== topicFilter) return false;
    if (ageFilter && s.ageGroup !== ageFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-hero shadow-glow">
              <img src="/safe%20story%20logo.png" alt="Safe Story logo" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-display text-lg font-extrabold text-foreground">Safe Story</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦁</span>
            <span className="font-display font-bold text-foreground">Hi, {studentProfile?.name || "Aarav"}!</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><LogOut className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 rounded-2xl gradient-soft p-8 shadow-soft">
          <div className="flex items-center gap-3 mb-2">
            <Sun className="h-8 w-8 text-primary animate-pulse-glow" />
            <h1 className="font-display text-3xl font-black text-foreground">Welcome back, {studentProfile?.name || "Aarav"}!</h1>
          </div>
          <p className="text-lg text-muted-foreground">Choose a story and learn something amazing today. 🌟</p>
        </div>

        {/* Continue Last Story */}
        <Card className="mb-8 overflow-hidden border-0 shadow-card transition-all hover:shadow-elevated">
          <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-primary/20 blur-sm" />
              <img src={continueStory?.coverImage || mockStories[0].coverImage} alt="Continue" className="relative h-20 w-20 rounded-xl object-cover ring-2 ring-primary/30" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Continue Reading</p>
              <h3 className="font-display text-xl font-bold text-foreground">{continueStory?.title || mockStories[0].title}</h3>
              <div className="mt-2 h-2.5 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 rounded-full gradient-hero" />
              </div>
            </div>
            <Button className="gap-2 font-bold shadow-glow" asChild>
              <Link to={`/student/story/${continueStory?.id || "1"}`}>Continue →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search stories..." className="pl-10" />
          </div>
          <Select value={topicFilter || "all"} onValueChange={(value) => setTopicFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Topics" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {topicOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ageFilter || "all"} onValueChange={(value) => setAgeFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Ages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ages</SelectItem>
              {ageGroupOptions.map((a) => <SelectItem key={a} value={a}>{a} years</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Story Library Grid */}
        <h2 className="mb-5 font-display text-2xl font-black text-foreground">Story Library 📚</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStories.map((story) => (
            <Link key={story.id} to={`/student/story/${story.id}`} className="group">
              <Card className="overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-2">
                <div className="relative overflow-hidden">
                  <img src={story.coverImage} alt={story.title} className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <Badge className="absolute right-3 top-3 font-bold shadow-sm">{story.topic}</Badge>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-display text-lg font-bold text-foreground">{story.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Ages {story.ageGroup}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentHome;
