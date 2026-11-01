import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages/")({
  component: () => (
    <div className="grid flex-1 place-items-center rounded-3xl bg-card shadow-card">
      <div className="text-center text-muted-foreground">
        <MessageCircle className="mx-auto mb-3 size-10 text-primary" />
        <p className="font-semibold text-foreground">Suhbatni tanlang</p>
        <p className="text-sm">Chap tarafdagi ro‘yxatdan suhbatni oching</p>
      </div>
    </div>
  ),
});
