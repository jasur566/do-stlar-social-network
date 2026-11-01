
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 2000),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.posts (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts insert own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts update own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts delete own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes read" ON public.likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert own" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments insert own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments delete own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows read" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows insert own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows delete own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv read participant" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "conv insert participant" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user_a, user_b));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations WHERE id = _conv AND _user IN (user_a, user_b))
$$;
CREATE POLICY "msg read participant" ON public.messages FOR SELECT TO authenticated USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "msg insert participant" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT author_id INTO owner FROM posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO notifications(user_id, actor_id, type, post_id) VALUES (owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_like();

CREATE OR REPLACE FUNCTION public.notify_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT author_id INTO owner FROM posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.author_id THEN
    INSERT INTO notifications(user_id, actor_id, type, post_id) VALUES (owner, NEW.author_id, 'comment', NEW.post_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

CREATE OR REPLACE FUNCTION public.notify_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications(user_id, actor_id, type) VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_follow();

CREATE OR REPLACE FUNCTION public.on_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.on_message();

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a uuid; b uuid; cid uuid;
BEGIN
  IF me IS NULL OR other IS NULL OR other = me THEN RAISE EXCEPTION 'invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other) THEN RAISE EXCEPTION 'not found'; END IF;
  a := LEAST(me, other); b := GREATEST(me, other);
  SELECT id INTO cid FROM conversations WHERE user_a = a AND user_b = b;
  IF cid IS NULL THEN
    INSERT INTO conversations(user_a, user_b) VALUES (a, b) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Demo seed
INSERT INTO public.profiles (id, username, full_name, bio, avatar_url, location) VALUES
('00000000-0000-4000-a000-000000000001','dostlar','Do‘stlar jamoasi','Do‘stlar ijtimoiy tarmog‘ining rasmiy sahifasi 💙','https://i.pravatar.cc/200?img=68','Toshkent'),
('00000000-0000-4000-a000-000000000002','malika_r','Malika Rahimova','Dizayner. Choy, kitoblar va tog‘lar ☕📚','https://i.pravatar.cc/200?img=47','Toshkent'),
('00000000-0000-4000-a000-000000000003','jasur.dev','Jasur Karimov','Frontend dasturchi. Kod yozaman, futbol o‘ynayman.','https://i.pravatar.cc/200?img=12','Samarqand'),
('00000000-0000-4000-a000-000000000004','dilnoza','Dilnoza Yusupova','Fotograf 📷 Buxoro ko‘chalarini sevaman','https://i.pravatar.cc/200?img=45','Buxoro'),
('00000000-0000-4000-a000-000000000005','sardor_t','Sardor Toshmatov','Sayohatchi. 23 ta mamlakat va hali davom etadi ✈️','https://i.pravatar.cc/200?img=13','Farg‘ona'),
('00000000-0000-4000-a000-000000000006','nigora.cooks','Nigora Aliyeva','Oshpaz. Har kuni yangi retsept 🍲','https://i.pravatar.cc/200?img=44','Namangan'),
('00000000-0000-4000-a000-000000000007','bekzod','Bekzod Ergashev','Talaba, TATU. Robototexnika ishqibozi 🤖','https://i.pravatar.cc/200?img=59','Toshkent'),
('00000000-0000-4000-a000-000000000008','zarina_m','Zarina Mirzayeva','Musiqachi 🎻 Konservatoriya bitiruvchisi','https://i.pravatar.cc/200?img=32','Xiva');

INSERT INTO public.posts (id, author_id, content, image_url, created_at) VALUES
('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001','Do‘stlarga xush kelibsiz! 🎉 Bu yerda do‘stlaringiz bilan fikr, rasm va yangiliklar ulashing.',NULL, now() - interval '3 days'),
('10000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000004','Registon kechqurun — har safar boshqacha go‘zal. ✨','https://picsum.photos/seed/registon/900/600', now() - interval '2 days 4 hours'),
('10000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000006','Bugun palov qildim! Sirim — sabzini ingichka to‘g‘rash va sabr 😄 Kim retsept so‘raydi?','https://picsum.photos/seed/palov/900/600', now() - interval '1 day 20 hours'),
('10000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000003','Yangi loyihamni ishga tushirdim — o‘zbek tilidagi ochiq kodli lug‘at. Fikrlaringizni kutaman!',NULL, now() - interval '1 day 8 hours'),
('10000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000005','Chimyon tog‘larida dam olish kunlari. Shahar shovqinidan keyin ajoyib tinchlik 🏔️','https://picsum.photos/seed/chimyon/900/600', now() - interval '20 hours'),
('10000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000002','Kuz keldi 🍂 Eng sevimli faslim. Siz qaysi faslni yaxshi ko‘rasiz?',NULL, now() - interval '9 hours'),
('10000000-0000-4000-a000-000000000007','00000000-0000-4000-a000-000000000007','Jamoamiz robototexnika musobaqasida 2-o‘rinni oldi! 🤖🏆','https://picsum.photos/seed/robot/900/600', now() - interval '5 hours'),
('10000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000008','Ertaga Xivada kichik konsert beraman. Hammani taklif qilaman 🎻',NULL, now() - interval '2 hours');

INSERT INTO public.likes (post_id, user_id)
SELECT p.id, u.id FROM public.posts p CROSS JOIN public.profiles u
WHERE u.id <> p.author_id AND (('x'||substr(md5(p.id::text||u.id::text),1,2))::bit(8)::int % 3) <> 0;

INSERT INTO public.comments (post_id, author_id, content, created_at) VALUES
('10000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000002','Juda chiroyli surat! 😍', now() - interval '2 days'),
('10000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000005','Samarqand doim ajoyib.', now() - interval '1 day 22 hours'),
('10000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000003','Retseptni yuboring, iltimos! 🙏', now() - interval '1 day 18 hours'),
('10000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000008','Ishtaham ochildi 😄', now() - interval '1 day 15 hours'),
('10000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000007','Zo‘r loyiha! GitHub havolasi bormi?', now() - interval '1 day 2 hours'),
('10000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000004','Albatta kuz! Suratga olish uchun eng yaxshi payt.', now() - interval '7 hours'),
('10000000-0000-4000-a000-000000000007','00000000-0000-4000-a000-000000000001','Tabriklaymiz! 🎉', now() - interval '4 hours');

INSERT INTO public.follows (follower_id, following_id)
SELECT a.id, b.id FROM public.profiles a, public.profiles b
WHERE a.id <> b.id AND (('x'||substr(md5(a.id::text||b.id::text),1,2))::bit(8)::int % 2) = 0;

-- Demo conversations between seed users
INSERT INTO public.conversations (id, user_a, user_b) VALUES
('20000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000004');
INSERT INTO public.messages (conversation_id, sender_id, content, created_at) VALUES
('20000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','Salom Dilnoza! Suratlaring ajoyib.', now() - interval '1 day'),
('20000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000004','Rahmat, Malika! 😊', now() - interval '23 hours');
DELETE FROM public.notifications;

-- New user onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; uname text; cid uuid; team uuid := '00000000-0000-4000-a000-000000000001'; malika uuid := '00000000-0000-4000-a000-000000000002';
BEGIN
  base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1), 'user'), '[^a-zA-Z0-9_.]', '', 'g'));
  IF base = '' THEN base := 'user'; END IF;
  uname := base;
  IF EXISTS (SELECT 1 FROM profiles WHERE username = uname) THEN
    uname := base || '_' || substr(md5(NEW.id::text), 1, 4);
  END IF;
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (NEW.id, uname,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', uname),
    NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO follows (follower_id, following_id) VALUES (team, NEW.id), (malika, NEW.id);
  INSERT INTO conversations (user_a, user_b) VALUES (LEAST(team, NEW.id), GREATEST(team, NEW.id)) RETURNING id INTO cid;
  INSERT INTO messages (conversation_id, sender_id, content) VALUES
    (cid, team, 'Assalomu alaykum! Do‘stlarga xush kelibsiz 💙 Savollaringiz bo‘lsa, shu yerga yozing.');
  INSERT INTO conversations (user_a, user_b) VALUES (LEAST(malika, NEW.id), GREATEST(malika, NEW.id)) RETURNING id INTO cid;
  INSERT INTO messages (conversation_id, sender_id, content) VALUES
    (cid, malika, 'Salom! Sizni bu yerda ko‘rganimdan xursandman 😊');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
