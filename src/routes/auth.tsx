import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s.mode === "signup" ? "signup" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Kirish — Do‘stlar" },
      { name: "description", content: "Do‘stlar hisobingizga kiring yoki yangi hisob oching." },
      { property: "og:title", content: "Kirish — Do‘stlar" },
      { property: "og:description", content: "Do‘stlar hisobingizga kiring yoki ro‘yxatdan o‘ting." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/feed", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username))
          throw new Error("Foydalanuvchi nomi 3–20 ta lotin harfi, raqam, _ yoki . bo‘lsin");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), username: username.toLowerCase() },
          },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Email yoki parol noto‘g‘ri");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error("Google orqali kirib bo‘lmadi");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 flex w-fit items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-primary-foreground">D</span>
          <span className="font-display text-2xl font-bold">Do‘stlar</span>
        </Link>
        <div className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          {sent ? (
            <div className="text-center" role="status">
              <h1 className="text-xl font-bold">Emailingizni tekshiring</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <b>{email}</b> manziliga tasdiqlash havolasi yubordik. Havolani bosib, hisobingizni faollashtiring.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMode("login"); }}>
                Kirish sahifasiga
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "login" ? "Xush kelibsiz!" : "Hisob yaratish"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login" ? "Hisobingizga kiring" : "Bir necha soniyada qo‘shiling"}
              </p>
              <Button type="button" variant="outline" className="mt-6 w-full" onClick={google}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.72 14.53 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z"/></svg>
                Google orqali davom etish
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> yoki <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Ism va familiya</Label>
                      <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aziz Rahimov" maxLength={60} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="username">Foydalanuvchi nomi</Label>
                      <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aziz_r" maxLength={20} />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@misol.uz" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Parol</Label>
                  <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 6 ta belgi" />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {mode === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? "Hisobingiz yo‘qmi? " : "Hisobingiz bormi? "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
                  {mode === "login" ? "Ro‘yxatdan o‘ting" : "Kiring"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
