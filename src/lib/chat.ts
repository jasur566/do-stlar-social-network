import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live updates for messages. Uses realtime inserts when available;
 * queries also poll (refetchInterval) as a fallback.
 */
export function useMessagesRealtime(conversationId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversationId ?? "all"}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}
