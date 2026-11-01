import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Compass, Home, LogOut, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/social";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/feed", label: "Lenta", icon: Home },
  { to: "/discover", label: "Kashf etish", icon: Compass },
  { to: "/messages", label: "Xabarlar", icon: MessageCircle },
  { to: "/notifications", label: "Bildirishnomalar", icon: Bell },
  { to: "/profile", label: "Profil", icon: User },
] as const;

export function Logo() {
  return (
    <Link to="/feed" className="flex items-center gap-2" aria-label="Do‘stlar — bosh sahifa">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-primary-foreground">
        D
      </span>
      <span className="font-display text-xl font-bold">Do‘stlar</span>
    </Link>
  );
}

function useUnread() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["unread", me?.id],
    enabled: !!me,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", me!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const { data: unread = 0 } = useUnread();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        Asosiy kontentga o‘tish
      </a>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Chiqish">
          <LogOut />
        </Button>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-0 md:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col py-6 md:flex">
          <Logo />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Asosiy navigatsiya">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                activeProps={{ className: "bg-card !text-primary shadow-card" }}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {to === "/notifications" && unread > 0 && (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-like px-1 text-[10px] text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
            <UserAvatar profile={me} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{me?.username}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Chiqish">
              <LogOut />
            </Button>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-0 md:py-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Asosiy navigatsiya"
        className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-3xl border bg-card/95 p-1.5 shadow-float backdrop-blur md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold text-muted-foreground"
            activeProps={{ className: "bg-primary-soft !text-primary" }}
          >
            <Icon className="size-5" />
            <span className="truncate">{label.split(" ")[0]}</span>
            {to === "/notifications" && unread > 0 && (
              <span className="absolute right-3 top-1 h-2 w-2 rounded-full bg-like" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
