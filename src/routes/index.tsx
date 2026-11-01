import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart, MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Do‘stlar — do‘stlaringiz bilan yaqinroq bo‘ling" },
      { name: "description", content: "O‘zbek tilidagi ijtimoiy tarmoq: postlar, rasmlar, izohlar va shaxsiy xabarlar." },
      { property: "og:title", content: "Do‘stlar — o‘zbek tilidagi ijtimoiy tarmoq" },
      { property: "og:description", content: "Postlar, rasmlar, izohlar va shaxsiy xabarlar — barchasi bir joyda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const AVATARS = [47, 12, 45, 13, 44, 59, 32];

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-brand opacity-[0.08]" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-primary-foreground">D</span>
          <span className="font-display text-xl font-bold">Do‘stlar</span>
        </span>
        <Button asChild variant="outline">
          <Link to="/auth">Kirish</Link>
        </Button>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-2 md:pt-20">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            Yangi o‘zbek ijtimoiy tarmog‘i
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">
            Do‘stlaringiz bilan <span className="text-primary">yaqinroq</span> bo‘ling
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Fikrlaringizni ulashing, suratlar joylang va do‘stlaringiz bilan shaxsiy suhbatlashing.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="brand" size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>Ro‘yxatdan o‘tish</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/auth">Hisobim bor</Link>
            </Button>
          </div>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-3">
              {AVATARS.map((n) => (
                <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" className="h-10 w-10 rounded-full ring-2 ring-background" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Minglab do‘stlar allaqachon shu yerda</p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <div className="rotate-2 rounded-3xl bg-card p-5 shadow-float">
            <div className="flex items-center gap-3">
              <img src="https://i.pravatar.cc/80?img=45" alt="" className="h-11 w-11 rounded-full" />
              <div>
                <p className="font-semibold">Dilnoza Yusupova</p>
                <p className="text-xs text-muted-foreground">@dilnoza · 2 soat oldin</p>
              </div>
            </div>
            <p className="mt-3">Registon kechqurun — har safar boshqacha go‘zal. ✨</p>
            <img src="https://picsum.photos/seed/registon/600/400" alt="" className="mt-3 rounded-2xl" />
            <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 text-like"><Heart className="size-4 fill-current" /> 128</span>
              <span className="flex items-center gap-1"><MessageCircle className="size-4" /> 24</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 -rotate-3 rounded-2xl bg-card px-4 py-3 shadow-float">
            <p className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-primary" /> Malika sizni kuzatmoqda</p>
          </div>
        </div>
      </section>
    </div>
  );
}
