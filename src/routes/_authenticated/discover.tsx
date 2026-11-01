import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Search, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/social";
import { UserAvatar } from "@/components/social/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/social/States";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Kashf etish — Do‘stlar" }, { name: "description", content: "Yangi do‘stlar toping." }] }),
  component: Discover,
});

function Discover() {
  const { data: me } = useMe();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const q = useQuery({
    queryKey: ["people", debounced],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at").limit(50);
      if (debounced) {
        const safe = debounced.replace(/[%,()]/g, "");
        query = query.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const people = q.data?.filter((p) => p.id !== me?.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Kashf etish" subtitle="Yangi odamlar bilan tanishing" />
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ism yoki foydalanuvchi nomi bo‘yicha qidirish"
          aria-label="Odamlarni qidirish"
          className="h-12 rounded-full bg-card pl-12 shadow-card"
        />
      </div>
      {q.isLoading && <ListSkeleton rows={5} />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {people?.length === 0 && <EmptyState icon={<UserX />} title="Hech kim topilmadi" text="Boshqa so‘z bilan qidirib ko‘ring." />}
      <ul className="grid gap-3 sm:grid-cols-2">
        {people?.map((p) => (
          <li key={p.id} className="flex flex-col rounded-3xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Link to="/u/$username" params={{ username: p.username }}>
                <UserAvatar profile={p} className="h-12 w-12" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/u/$username" params={{ username: p.username }} className="block truncate font-semibold hover:underline">
                  {p.full_name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              </div>
              <FollowButton userId={p.id} />
            </div>
            {p.bio && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.bio}</p>}
            {p.location && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {p.location}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
