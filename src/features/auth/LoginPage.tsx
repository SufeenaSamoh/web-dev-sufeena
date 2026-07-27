import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { settings } = useStore();
  const { user, loading: authLoading, signIn } = useAuth();
  const companyName = settings.companyName || "Hana Inventory Stock";
  const initial = companyName.charAt(0).toUpperCase();

  // Already-authenticated users shouldn't see the login form — send them to the dashboard.
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/" });
    }
  }, [authLoading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, pw);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Welcome back to Hana");
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.18),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={companyName}
                className="h-11 w-11 rounded-2xl bg-white/15 object-cover backdrop-blur"
              />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 font-black backdrop-blur">
                {initial}
              </div>
            )}
            <div className="text-sm font-semibold uppercase tracking-widest">{companyName}</div>
          </div>
          <div>
            <h2 className="text-5xl font-bold leading-tight">
              Precision inventory
              <br />
              for modern kitchens.
            </h2>
            <p className="mt-4 max-w-md text-sm text-primary-foreground/80">
              Purchase to plate — every gram tracked. Built for Japanese restaurant chains that care
              about craft.
            </p>
          </div>
          <div className="text-xs text-primary-foreground/70">
            © Hana · Premium Restaurant Suite
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md rounded-2xl border-border/70 p-8 shadow-xl">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={companyName}
                className="h-10 w-10 rounded-2xl object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary font-black text-primary-foreground">
                {initial}
              </div>
            )}
            <span className="font-semibold">{companyName}</span>
          </div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Please enter your details.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember
                me
              </label>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => toast.info("Password reset link sent")}
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
