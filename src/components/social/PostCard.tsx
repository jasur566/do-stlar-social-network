import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, useImageUrl, useManagedIds, useMe, type Post } from "@/lib/social";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function PostImage({ src }: { src: string }) {
  const url = useImageUrl(src);
  if (!url) return <Skeleton className="aspect-[3/2] w-full rounded-2xl" />;
  return (
    <img
      src={url}
      alt="Post rasmi"
      loading="lazy"
      className="max-h-[520px] w-full rounded-2xl bg-muted object-cover"
    />
  );
}

function Comments({ postId }: { postId: string }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(*)")
        .eq("post_id", postId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comments")
        .insert({ post_id: postId, author_id: me!.id, content: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Izoh qo‘shilmadi"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {isLoading && <Skeleton className="h-10 w-full" />}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">Hali izoh yo‘q. Birinchi bo‘ling!</p>}
      {data?.map((c) => (
        <div key={c.id} className="group flex gap-2">
          <UserAvatar profile={c.author} className="h-8 w-8" />
          <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <Link to="/u/$username" params={{ username: c.author.username }} className="font-semibold hover:underline">
                {c.author.full_name}
              </Link>
              <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
              {c.author_id === me?.id && (
                <button
                  onClick={() => del.mutate(c.id)}
                  className="ml-auto text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  aria-label="Izohni o‘chirish"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <p className="break-words text-sm">{c.content}</p>
          </div>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) add.mutate();
        }}
      >
        <UserAvatar profile={me} className="h-8 w-8" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Izoh yozing…"
          aria-label="Izoh matni"
          maxLength={1000}
          className="h-9 rounded-full"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || add.isPending} aria-label="Izohni yuborish">
          <Send />
        </Button>
      </form>
    </div>
  );
}

export function PostCard({ post }: { post: Post }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: managed } = useManagedIds();
  const liked = !!me && post.likes.some((l) => l.user_id === me.id);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const isLiked = optimistic ?? liked;
  const likeCount = post.likes.length + (optimistic === null ? 0 : optimistic === liked ? 0 : optimistic ? 1 : -1);
  const commentCount = post.comments[0]?.count ?? 0;

  const toggleLike = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = next
        ? await supabase.from("likes").insert({ post_id: post.id, user_id: me!.id })
        : await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", me!.id);
      if (error) throw error;
    },
    onMutate: (next) => setOptimistic(next),
    onError: () => {
      setOptimistic(null);
      toast.error("Amalni bajarib bo‘lmadi");
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["posts"] });
      setOptimistic(null);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post o‘chirildi");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Postni o‘chirib bo‘lmadi"),
  });

  return (
    <article className="rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <header className="flex items-center gap-3">
        <Link to="/u/$username" params={{ username: post.author.username }}>
          <UserAvatar profile={post.author} className="h-11 w-11" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/u/$username" params={{ username: post.author.username }} className="block truncate font-semibold hover:underline">
            {post.author.full_name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            @{post.author.username} · {timeAgo(post.created_at)}
          </p>
        </div>
        {(post.author_id === me?.id || managed?.has(post.author_id)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Post amallari">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm("Postni o‘chirasizmi?")) remove.mutate();
                }}
              >
                <Trash2 className="size-4" /> O‘chirish
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {post.content && <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>}
      {post.image_url && (
        <div className="mt-3">
          <PostImage src={post.image_url} />
        </div>
      )}
      <div className="mt-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isLiked}
          aria-label={isLiked ? "Yoqtirishni bekor qilish" : "Yoqtirish"}
          onClick={() => me && toggleLike.mutate(!isLiked)}
          className={cn("h-9 px-3", isLiked && "text-like hover:text-like")}
        >
          <Heart className={cn(isLiked && "fill-current")} /> {likeCount}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="h-9 px-3"
        >
          <MessageCircle /> {commentCount} <span className="sr-only">izoh</span>
        </Button>
      </div>
      {open && <Comments postId={post.id} />}
    </article>
  );
}
