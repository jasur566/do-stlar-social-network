import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, type Post } from "@/lib/social";
import { Composer } from "@/components/social/Composer";
import { PostCard } from "@/components/social/PostCard";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/social/States";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Lenta — Do‘stlar" }, { name: "description", content: "Do‘stlaringizning so‘nggi postlari." }] }),
  component: Feed,
});

function Feed() {
  const q = useQuery({
    queryKey: ["posts", "feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as Post[];
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Lenta" subtitle="Do‘stlaringiz nima bilan band" />
      <div className="space-y-4">
        <Composer />
        {q.isLoading && <ListSkeleton rows={3} />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {q.data?.length === 0 && (
          <EmptyState icon={<Newspaper />} title="Lenta hozircha bo‘sh" text="Birinchi postingizni joylang!" />
        )}
        {q.data?.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </div>
  );
}
