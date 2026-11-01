import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, useMe } from "@/lib/social";
import { UserAvatar } from "@/components/social/UserAvatar";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/social/States";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Bildirishnomalar — Do‘stlar" }, { name: "description", content: "Sizga oid so‘nggi faollik." }] }),
  component: Notifications,
});

const TYPES = {
  like: { text: "postingizni yoqtirdi", icon: Heart, cls: "bg-like text-primary-foreground" },
  comment: { text: "postingizga izoh qoldirdi", icon: MessageCircle, cls: "bg-primary text-primary-foreground" },
  follow: { text: "sizni kuzata boshladi", icon: UserPlus, cls: "bg-accent-foreground text-primary-foreground" },
} as const;

function Notifications() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, actor:profiles!notifications_actor_id_fkey(*)")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
  const markRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", me!.id).eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unread"] }),
  });
  const hasUnread = q.data?.some((n) => !n.is_read);
  useEffect(() => {
    if (hasUnread) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bildirishnomalar" subtitle="Sizga oid so‘nggi faollik" />
      {(q.isLoading || !me) && <ListSkeleton rows={5} />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && (
        <EmptyState icon={<Bell />} title="Hozircha bildirishnoma yo‘q" text="Kimdir postingizni yoqtirsa yoki sizni kuzatsa, shu yerda ko‘rasiz." />
      )}
      <ul className="space-y-2">
        {q.data?.map((n) => {
          const t = TYPES[n.type as keyof typeof TYPES] ?? TYPES.like;
          const Icon = t.icon;
          return (
            <li key={n.id} className={cn("flex items-center gap-3 rounded-3xl bg-card p-4 shadow-card", !n.is_read && "ring-2 ring-primary/30")}>
              <div className="relative">
                <UserAvatar profile={n.actor} className="h-11 w-11" />
                <span className={cn("absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-card", t.cls)}>
                  <Icon className="size-3" />
                </span>
              </div>
              <p className="min-w-0 flex-1 text-sm">
                <Link to="/u/$username" params={{ username: n.actor.username }} className="font-semibold hover:underline">
                  {n.actor.full_name}
                </Link>{" "}
                {t.text}
                <span className="block text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
