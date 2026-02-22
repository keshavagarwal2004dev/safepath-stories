import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockAvatars, ageGroupOptions } from "@/data/mockData";
import { toast } from "sonner";
import { createStudentProfile } from "@/lib/api";

const StudentSignup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ageGroup) {
      toast.error("Please fill your name and age group");
      return;
    }

    try {
      setIsLoading(true);
      const profile = await createStudentProfile({ name: name.trim(), ageGroup, avatar: selectedAvatar || undefined });
      localStorage.setItem("student_profile", JSON.stringify(profile));
      navigate("/student/home");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not continue";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 gradient-soft" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-primary/15 blur-3xl" />
      <Card className="relative z-10 w-full max-w-md border-0 shadow-elevated">
        <div className="h-1.5 w-full gradient-hero rounded-t-lg" />
        <CardHeader className="space-y-4 pb-2 text-center">
          <Link to="/" className="mx-auto flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-hero shadow-glow">
              <img src="/safe%20story%20logo.png" alt="Safe Story logo" className="h-6 w-6 object-contain" />
            </div>
            <span className="font-display text-xl font-extrabold text-foreground">Safe Story</span>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-black text-foreground">Welcome, Young Learner! 🌟</h1>
            <p className="text-sm text-muted-foreground">Tell us about yourself to begin</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleContinue} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">Your Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="name" placeholder="What's your name?" className="pl-10" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Age Group</Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger><SelectValue placeholder="How old are you?" /></SelectTrigger>
                <SelectContent>
                  {ageGroupOptions.map((ag) => (
                    <SelectItem key={ag} value={ag}>{ag} years</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Choose Your Avatar</Label>
              <div className="grid grid-cols-4 gap-3">
                {mockAvatars.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`flex h-16 w-full items-center justify-center rounded-2xl text-2xl transition-all duration-200 ${
                      selectedAvatar === avatar
                        ? "bg-primary/20 ring-2 ring-primary scale-110 shadow-glow"
                        : "bg-muted hover:bg-muted/70 hover:scale-105"
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full font-bold text-base shadow-glow" size="lg" disabled={isLoading}>
              {isLoading ? "Starting..." : "Let's Go! 🚀"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentSignup;
