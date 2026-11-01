CREATE TABLE public.profile_managers (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, user_id)
);
GRANT SELECT ON public.profile_managers TO authenticated;
GRANT ALL ON public.profile_managers TO service_role;
ALTER TABLE public.profile_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read own" ON public.profile_managers FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_manage_profile(_profile uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _profile = _user OR EXISTS (SELECT 1 FROM public.profile_managers WHERE profile_id = _profile AND user_id = _user)
$$;

CREATE POLICY "profiles update managed" ON public.profiles FOR UPDATE TO authenticated
  USING (public.can_manage_profile(id, auth.uid())) WITH CHECK (public.can_manage_profile(id, auth.uid()));
CREATE POLICY "posts insert managed" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_profile(author_id, auth.uid()));
CREATE POLICY "posts update managed" ON public.posts FOR UPDATE TO authenticated
  USING (public.can_manage_profile(author_id, auth.uid())) WITH CHECK (public.can_manage_profile(author_id, auth.uid()));
CREATE POLICY "posts delete managed" ON public.posts FOR DELETE TO authenticated
  USING (public.can_manage_profile(author_id, auth.uid()));

INSERT INTO public.profile_managers (profile_id, user_id)
SELECT o.id, u.id
FROM public.profiles o
JOIN auth.users u ON lower(u.email) = 'nmgesportss@gmail.com' AND u.email_confirmed_at IS NOT NULL
JOIN public.profiles fp ON fp.id = u.id
WHERE o.username = 'dostlar'
ON CONFLICT DO NOTHING;