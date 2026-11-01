import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, useMe } from "@/lib/social";
import { useMessagesRealtime } from "@/lib/chat";
import { UserAvatar } from "@/components/social/UserAvatar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/social/States";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Xabarlar — Do‘stlar" }, { name: "description", content: "Shaxsiy suhbatlaringiz." }] }),
  component: MessagesLayout,
});

export function useConversations() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["conversations", me?.id],
    enabled: !!me,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, a:profiles!conversations_user_a_fkey(*), b:profiles!conversations_user_b_fkey(*), messages(content, created_at, sender_id)")
        .order("updated_at", { ascending: false })
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" });
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        other: c.user_a === me!.id ? c.b : c.a,
        last: c.messages[0] ?? null,
        updated_at: c.updated_at,
      }));
    },
  });
}

function MessagesLayout() {
  const params = useParams({ strict: false }) as { id?: string };
  const { data: me } = useMe();
  const q = useConversations();
  useMessagesRealtime();

  return (
    <div className="flex h-[calc(100dvh-11rem)] gap-4 md:h-[calc(100dvh-4rem)]">
      <aside className={cn("w-full flex-col md:flex md:w-80 md:shrink-0", params.id ? "hidden" : "flex")}>
        <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Xabarlar</h1>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {q.isLoading && <ListSkeleton rows={4} />}
          {q.isError && <ErrorState onRetry={() => q.refetch()} />}
          {q.data?.length === 0 && (
            <EmptyState icon={<MessageCircle />} title="Suhbatlar yo‘q" text="Profil sahifasidan kimgadir xabar yozing." />
          )}
          {q.data?.map((c) => (
            <Link
              key={c.id}
              to="/messages/$id"
              params={{ id: c.id }}
              className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-card"
              activeProps={{ className: "bg-card shadow-card" }}
            >
              <UserAvatar profile={c.other} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{c.other.full_name}</p>
                  {c.last && <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.last.created_at)}</span>}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {c.last ? `${c.last.sender_id === me?.id ? "Siz: " : ""}${c.last.content}` : "Suhbatni boshlang"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </aside>
      <section className={cn("min-w-0 flex-1", params.id ? "flex" : "hidden md:flex")}>
        <Outlet />
      </section>
    </div>
  );
}
