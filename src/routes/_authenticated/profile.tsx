import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/social";
import { ListSkeleton } from "@/components/social/States";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profil — Do‘stlar" }, { name: "description", content: "Sizning profilingiz." }] }),
  component: MyProfile,
});

function MyProfile() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <ListSkeleton rows={2} />;
  return <Navigate to="/u/$username" params={{ username: me.username }} replace />;
}
