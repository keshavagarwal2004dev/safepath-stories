import { Link } from "react-router-dom";
import { BookOpen, Shield, Users, Sparkles, ArrowRight, Star, Heart, CheckCircle, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroImage from "@/assets/hero-illustration.jpg";
import storyCover1 from "@/assets/story-cover-1.jpg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero shadow-glow">
              <img src="/safe%20story%20logo.png" alt="Safe Story logo" className="h-6 w-6 object-contain" />
            </div>
            <span className="font-display text-xl font-extrabold text-foreground">Safe Story</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="font-semibold" asChild>
              <Link to="/ngo-login">NGO Login</Link>
            </Button>
            <Button variant="outline" className="font-semibold" asChild>
              <Link to="/ngo-signup">NGO Sign Up</Link>
            </Button>
            <Button className="font-bold shadow-glow" asChild>
              <Link to="/student-signup">
                <Sun className="h-4 w-4 mr-1" /> Student Sign Up
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28">
        <div className="absolute inset-0 gradient-soft" />
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-3xl" />
        <div className="container relative mx-auto grid items-center gap-12 md:grid-cols-2">
          <div className="animate-fade-in space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-5 py-2 text-sm font-bold text-foreground ring-1 ring-primary/20">
              <Sparkles className="h-4 w-4 text-primary" /> AI-Powered Child Safety Education
            </div>
            <h1 className="font-display text-4xl font-black leading-[1.1] text-foreground md:text-5xl lg:text-6xl">
              Stories That Teach Children to Stay{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Safe</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              An interactive storybook platform where NGOs create AI-generated safety stories and children learn through branching narratives and choices.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="gap-2 text-base font-bold shadow-glow" asChild>
                <Link to="/ngo-signup">
                  <Shield className="h-5 w-5" /> Create NGO Account
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-base font-bold border-2" asChild>
                <Link to="/ngo-login">
                  <Shield className="h-5 w-5" /> NGO Login
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-base font-bold border-2" asChild>
                <Link to="/student-signup">
                  <Star className="h-5 w-5" /> Student Sign Up
                </Link>
              </Button>
            </div>
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" />
              <img
                src={heroImage}
                alt="Children reading a magical storybook"
                className="relative w-full rounded-3xl shadow-elevated ring-1 ring-border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-20 md:py-28">
        <div className="container mx-auto">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary">How It Works</span>
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Three Simple Steps</h2>
            <p className="mt-3 text-lg text-muted-foreground">Empower children with safety knowledge through stories</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: Shield, title: "NGO Creates Scenario", desc: "Choose a safety topic, age group, and cultural context. Our AI generates a personalized story.", step: "01" },
              { icon: BookOpen, title: "Child Reads & Chooses", desc: "Children experience an interactive story with branching choices that teach right from wrong.", step: "02" },
              { icon: Star, title: "Learn & Grow", desc: "Positive reinforcement, badges, and lesson summaries help children remember safety skills.", step: "03" },
            ].map((step, i) => (
              <Card key={i} className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-2">
                <div className="absolute top-0 left-0 h-1 w-full gradient-hero" />
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="mb-2 font-display text-4xl font-black text-primary/20">{step.step}</div>
                  <h3 className="mb-3 font-display text-xl font-bold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Story Preview */}
      <section className="bg-muted/60 px-4 py-20 md:py-28">
        <div className="container mx-auto">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary">Preview</span>
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Sample Story</h2>
            <p className="mt-3 text-lg text-muted-foreground">See how interactive stories make learning engaging</p>
          </div>
          <Card className="mx-auto max-w-2xl overflow-hidden border-0 shadow-elevated">
            <div className="relative">
              <img src={storyCover1} alt="Story preview" className="h-72 w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="inline-block rounded-full gradient-hero px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">Good Touch Bad Touch</span>
                <h3 className="mt-2 font-display text-2xl font-black text-card drop-shadow-lg">Rani Says No</h3>
              </div>
            </div>
            <CardContent className="p-6">
              <p className="mb-5 leading-relaxed text-muted-foreground">
                Join Rani as she learns about personal boundaries and discovers the power of saying "No" to uncomfortable situations. An interactive journey about body autonomy and safety.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-semibold">Ages 6-8</span>
                  <span>4 slides</span>
                  <span>Interactive</span>
                </div>
                <Button size="sm" className="gap-1 font-bold" asChild>
                  <Link to="/student-signup">
                    Try It <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="px-4 py-20 md:py-28">
        <div className="container mx-auto text-center">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary">Trust</span>
          <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Trusted & Safe</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Built with child safety at the core, following POCSO guidelines and reviewed by child psychologists.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { icon: Shield, label: "POCSO Compliant" },
              { icon: Heart, label: "Trauma-Informed" },
              { icon: CheckCircle, label: "Expert Reviewed" },
              { icon: Users, label: "NGO Trusted" },
            ].map((item, i) => (
              <div key={i} className="group flex flex-col items-center gap-4 rounded-2xl bg-card p-8 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <span className="font-display text-lg font-bold text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
              <img src="/safe%20story%20logo.png" alt="Safe Story logo" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-display text-lg font-extrabold text-foreground">Safe Story</span>
          </div>
          <p>© 2026 Safe Story. Empowering children through interactive safety education.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
