import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, useMe } from "@/lib/social";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("no user");
      const image_url = file ? await uploadImage(me.id, file) : null;
      const { error } = await supabase
        .from("posts")
        .insert({ author_id: me.id, content: text.trim(), image_url });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      clearFile();
      toast.success("Post joylandi");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Postni joylab bo‘lmadi. Qayta urinib ko‘ring."),
  });

  function clearFile() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function pick(f: File | undefined): void {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Faqat rasm fayllari");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5 MB dan oshmasin");
      return;
    }
    clearFile();
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const canPost = (text.trim().length > 0 || file) && !create.isPending;

  return (
    <form
      className="rounded-3xl bg-card p-4 shadow-card sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canPost) create.mutate();
      }}
    >
      <div className="flex gap-3">
        <UserAvatar profile={me} className="h-11 w-11" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Nima yangiliklar, ${me?.full_name?.split(" ")[0] ?? "do‘stim"}?`}
          aria-label="Post matni"
          maxLength={2000}
          className="min-h-[72px] resize-none rounded-2xl border-0 bg-muted text-base shadow-none focus-visible:ring-2"
        />
      </div>
      {preview && (
        <div className="relative mt-3 ml-14">
          <img src={preview} alt="Tanlangan rasm" className="max-h-72 rounded-2xl object-cover" />
          <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8" onClick={clearFile} aria-label="Rasmni olib tashlash">
            <X />
          </Button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between pl-14">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button type="button" variant="ghost" size="sm" className="h-9 text-primary" onClick={() => inputRef.current?.click()}>
          <ImagePlus /> Rasm
        </Button>
        <Button type="submit" variant="brand" disabled={!canPost}>
          {create.isPending && <Loader2 className="animate-spin" />} Joylash
        </Button>
      </div>
    </form>
  );
}
