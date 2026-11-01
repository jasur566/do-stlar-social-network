import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { uz } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Post = Tables<"posts"> & {
  author: Profile;
  likes: { user_id: string }[];
  comments: { count: number }[];
};

export const POST_SELECT =
  "*, author:profiles!posts_author_id_fkey(*), likes(user_id), comments(count)";

export function timeAgo(date: string) {
  try {
    return formatDistanceToNowStrict(new Date(date), { locale: uz, addSuffix: true });
  } catch {
    return "";
  }
}

/** Signed-in user id + profile. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

const STORAGE_PREFIX = "storage:";
const signedCache = new Map<string, string>();

/** Images uploaded by users live in a private bucket; resolve to a signed URL. */
export function useImageUrl(src: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return null;
    if (!src.startsWith(STORAGE_PREFIX)) return src;
    return signedCache.get(src) ?? null;
  });
  useEffect(() => {
    if (!src) return setUrl(null);
    if (!src.startsWith(STORAGE_PREFIX)) return setUrl(src);
    const cached = signedCache.get(src);
    if (cached) return setUrl(cached);
    let alive = true;
    supabase.storage
      .from("post-images")
      .createSignedUrl(src.slice(STORAGE_PREFIX.length), 60 * 60 * 24)
      .then(({ data }) => {
        if (data?.signedUrl && alive) {
          signedCache.set(src, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}

export async function uploadImage(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("post-images").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return STORAGE_PREFIX + path;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Profile ids the signed-in user may manage (own + official profiles they're linked to). */
export function useManagedIds() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["managed", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("profile_managers").select("profile_id").eq("user_id", me!.id);
      if (error) throw error;
      return new Set([me!.id, ...data.map((r) => r.profile_id)]);
    },
    staleTime: 60_000,
  });
}
