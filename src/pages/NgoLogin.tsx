import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { loginNgo } from "@/lib/api";

const NgoLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const response = await loginNgo({ email, password });
      // ✅ Store both JWT token AND NGO profile
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("ngo_profile", JSON.stringify({ ngoId: response.ngoId, email: response.email }));
      toast.success("Login successful!");
      navigate("/ngo/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
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
            <h1 className="font-display text-2xl font-black text-foreground">NGO Login</h1>
            <p className="text-sm text-muted-foreground">Access your story creation dashboard</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@ngo.org" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full font-bold shadow-glow" size="lg" disabled={isLoading}>
              {isLoading ? "Signing In..." : "Sign In"}
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

export default NgoLogin;
