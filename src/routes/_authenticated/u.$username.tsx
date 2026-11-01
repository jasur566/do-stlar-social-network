import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Loader2, MapPin, MessageCircle, Newspaper, Pencil, UserX } from "lucide-react";
import { format } from "date-fns";
import { uz } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, useMe, type Post, type Profile } from "@/lib/social";
import { UserAvatar } from "@/components/social/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import { PostCard } from "@/components/social/PostCard";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/social/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Do‘stlar` }, { name: "description", content: `@${params.username} profili Do‘stlarda.` }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.id),
      ]);
      return { ...data, followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
  const p = profile.data;

  const posts = useQuery({
    queryKey: ["posts", "user", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("author_id", p!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Post[];
    },
  });

  const startChat = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_conversation", { other: p!.id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => navigate({ to: "/messages/$id", params: { id } }),
    onError: () => toast.error("Suhbatni ochib bo‘lmadi"),
  });

  if (profile.isLoading) return <ListSkeleton rows={3} />;
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />;
  if (!p) return <EmptyState icon={<UserX />} title="Foydalanuvchi topilmadi" text={`@${username} mavjud emas.`} />;
  const isMe = me?.id === p.id;

  return (
    <div className="mx-auto max-w-2xl">
      <section className="overflow-hidden rounded-3xl bg-card shadow-card">
        <div className="h-28 bg-brand sm:h-36" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <UserAvatar profile={p} className="h-24 w-24 text-2xl ring-4" />
            <div className="flex gap-2">
              {isMe ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Tahrirlash
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={() => startChat.mutate()} disabled={startChat.isPending} aria-label="Xabar yozish">
                    <MessageCircle />
                  </Button>
                  <FollowButton userId={p.id} size="default" />
                </>
              )}
            </div>
          </div>
          <h1 className="mt-3 text-2xl font-bold">{p.full_name}</h1>
          <p className="text-sm text-muted-foreground">@{p.username}</p>
          {p.bio && <p className="mt-3 whitespace-pre-wrap">{p.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {p.location && <span className="flex items-center gap-1"><MapPin className="size-4" /> {p.location}</span>}
            <span className="flex items-center gap-1"><CalendarDays className="size-4" /> {format(new Date(p.created_at), "LLLL yyyy", { locale: uz })} dan beri</span>
          </div>
          <div className="mt-4 flex gap-5 text-sm">
            <span><b>{posts.data?.length ?? 0}</b> <span className="text-muted-foreground">post</span></span>
            <span><b>{p.followers}</b> <span className="text-muted-foreground">kuzatuvchi</span></span>
            <span><b>{p.following}</b> <span className="text-muted-foreground">kuzatilmoqda</span></span>
          </div>
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-lg font-bold">Postlar</h2>
      <div className="space-y-4">
        {posts.isLoading && <ListSkeleton rows={2} />}
        {posts.isError && <ErrorState onRetry={() => posts.refetch()} />}
        {posts.data?.length === 0 && <EmptyState icon={<Newspaper />} title="Hali post yo‘q" text={isMe ? "Lentada birinchi postingizni joylang." : undefined} />}
        {posts.data?.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
      {isMe && <EditProfile open={editing} onOpenChange={setEditing} profile={p} />}
    </div>
  );
}

function EditProfile({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (v: boolean) => void; profile: Profile }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: profile.full_name,
    username: profile.username,
    bio: profile.bio,
    location: profile.location,
    avatar_url: profile.avatar_url ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw new Error("Foydalanuvchi nomi 3–20 ta lotin harfi, raqam, _ yoki . bo‘lsin");
      if (form.avatar_url && !/^https:\/\//.test(form.avatar_url)) throw new Error("Rasm havolasi https:// bilan boshlansin");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim().slice(0, 60),
          username,
          bio: form.bio.slice(0, 300),
          location: form.location.trim().slice(0, 60),
          avatar_url: form.avatar_url.trim() || null,
        })
        .eq("id", profile.id);
      if (error) throw new Error(error.code === "23505" ? "Bu foydalanuvchi nomi band" : "Saqlab bo‘lmadi");
      return username;
    },
    onSuccess: (username) => {
      toast.success("Profil yangilandi");
      qc.invalidateQueries();
      onOpenChange(false);
      navigate({ to: "/u/$username", params: { username }, replace: true });
    },
    onError: (e) => toast.error(e.message),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Profilni tahrirlash</DialogTitle>
        </DialogHeader>
        <form id="edit-profile" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="fn">Ism</Label><Input id="fn" required value={form.full_name} onChange={set("full_name")} maxLength={60} /></div>
          <div className="space-y-1.5"><Label htmlFor="un">Foydalanuvchi nomi</Label><Input id="un" required value={form.username} onChange={set("username")} maxLength={20} /></div>
          <div className="space-y-1.5"><Label htmlFor="bio">Bio</Label><Textarea id="bio" value={form.bio} onChange={set("bio")} maxLength={300} /></div>
          <div className="space-y-1.5"><Label htmlFor="loc">Joylashuv</Label><Input id="loc" value={form.location} onChange={set("location")} maxLength={60} placeholder="Toshkent" /></div>
          <div className="space-y-1.5"><Label htmlFor="av">Avatar havolasi</Label><Input id="av" value={form.avatar_url} onChange={set("avatar_url")} placeholder="https://…" /></div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button type="submit" form="edit-profile" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
