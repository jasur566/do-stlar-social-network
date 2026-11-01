import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/social";
import { useMessagesRealtime } from "@/lib/chat";
import { UserAvatar } from "@/components/social/UserAvatar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/social/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: Chat,
});

function Chat() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useMessagesRealtime(id);

  const conv = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, a:profiles!conversations_user_a_fkey(*), b:profiles!conversations_user_b_fkey(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const msgs = useQuery({
    queryKey: ["messages", id],
    refetchInterval: 5_000, // polling fallback if realtime is unavailable
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.data?.length]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: me!.id, content });
      if (error) throw error;
    },
    onMutate: () => setText(""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (_e, content) => {
      setText(content);
      toast.error("Xabar yuborilmadi");
    },
  });

  if (conv.isLoading) return <div className="flex-1"><ListSkeleton rows={4} /></div>;
  if (conv.isError) return <div className="flex-1"><ErrorState onRetry={() => conv.refetch()} /></div>;
  if (!conv.data) return <div className="flex-1"><EmptyState icon={<Lock />} title="Suhbat topilmadi" text="Bu suhbat mavjud emas yoki unga kirish huquqingiz yo‘q." /></div>;
  const other = conv.data.user_a === me?.id ? conv.data.b : conv.data.a;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-card">
      <header className="flex items-center gap-3 border-b p-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link to="/messages" aria-label="Orqaga"><ArrowLeft /></Link>
        </Button>
        <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3">
          <UserAvatar profile={other} />
          <div>
            <p className="font-semibold leading-tight">{other.full_name}</p>
            <p className="text-xs text-muted-foreground">@{other.username}</p>
          </div>
        </Link>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {msgs.isLoading && <ListSkeleton rows={2} />}
        {msgs.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Salom deb yozing 👋</p>}
        {msgs.data?.map((m) => {
          const mine = m.sender_id === me?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-3xl px-4 py-2", mine ? "rounded-br-md bg-bubble-me text-bubble-me-foreground" : "rounded-bl-md bg-bubble-them")}>
                <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                <p className={cn("mt-0.5 text-right text-[10px]", mine ? "opacity-70" : "text-muted-foreground")}>{format(new Date(m.created_at), "HH:mm")}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t && me) send.mutate(t);
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing…" aria-label="Xabar matni" maxLength={4000} className="h-11 rounded-full bg-muted" />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!text.trim()} aria-label="Yuborish">
          <Send />
        </Button>
      </form>
    </div>
  );
}
