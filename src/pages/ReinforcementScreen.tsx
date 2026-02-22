import { Link } from "react-router-dom";
import { Star, ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ReinforcementScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 gradient-soft" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-primary/15 blur-3xl" />
      <Card className="relative z-10 w-full max-w-md border-0 text-center shadow-elevated">
        <div className="h-1.5 w-full gradient-hero rounded-t-lg" />
        <CardContent className="p-10">
          {/* Badge / Reward */}
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15 animate-bounce-gentle shadow-glow">
            <Trophy className="h-14 w-14 text-primary" />
          </div>

          <h1 className="font-display text-4xl font-black text-foreground">Amazing Job! 🎉</h1>
          <p className="mt-3 text-lg text-muted-foreground">You completed the story and learned how to stay safe!</p>

          {/* Stars */}
          <div className="my-8 flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <Star key={i} className="h-12 w-12 fill-primary text-primary animate-scale-in drop-shadow-md" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>

          {/* Lesson Summary */}
          <div className="mb-8 rounded-2xl bg-muted p-6 text-left">
            <h3 className="mb-3 font-display text-lg font-bold text-foreground">What You Learned:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Never accept gifts from strangers</li>
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Always tell a trusted adult if you feel unsafe</li>
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> It's okay to say "No!" loudly</li>
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> You are brave and smart!</li>
            </ul>
          </div>

          {/* Badge Earned */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full gradient-hero px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow">
            🛡️ Safety Champion Badge Earned!
          </div>

          <div>
            <Button size="lg" className="w-full gap-2 font-bold shadow-glow" asChild>
              <Link to="/student/home"><ArrowLeft className="h-4 w-4" /> Back to Story Library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReinforcementScreen;
