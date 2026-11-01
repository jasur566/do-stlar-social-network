import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials, type Profile } from "@/lib/social";

export function UserAvatar({
  profile,
  className,
}: {
  profile: Pick<Profile, "full_name" | "avatar_url" | "username"> | null | undefined;
  className?: string;
}) {
  const name = profile?.full_name || profile?.username || "?";
  return (
    <Avatar className={cn("h-10 w-10 ring-2 ring-card", className)}>
      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
      <AvatarFallback className="bg-primary-soft font-semibold text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
