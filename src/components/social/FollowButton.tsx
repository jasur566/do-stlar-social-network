import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/social";
import { Button } from "@/components/ui/button";

export function useFollowing() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["following", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", me!.id);
      if (error) throw error;
      return new Set(data.map((r) => r.following_id));
    },
  });
}

export function FollowButton({ userId, size = "sm" }: { userId: string; size?: "sm" | "default" }) {
  const { data: me } = useMe();
  const { data: following } = useFollowing();
  const qc = useQueryClient();
  const isFollowing = following?.has(userId) ?? false;
  const m = useMutation({
    mutationFn: async () => {
      const { error } = isFollowing
        ? await supabase.from("follows").delete().eq("follower_id", me!.id).eq("following_id", userId)
        : await supabase.from("follows").insert({ follower_id: me!.id, following_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Amalni bajarib bo‘lmadi"),
  });
  if (!me || me.id === userId) return null;
  return (
    <Button
      size={size}
      variant={isFollowing ? "outline" : "default"}
      aria-pressed={isFollowing}
      disabled={m.isPending}
      onClick={() => m.mutate()}
    >
      {isFollowing ? "Kuzatilmoqda" : "Kuzatish"}
    </Button>
  );
}
