-- Supabase Schema for Pinksin (Team Matching Platform)

-- 1. Create Users Table (Extending Auth Users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  major TEXT,
  skills TEXT[] DEFAULT '{}',
  github_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Posts Table
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.users(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('기획', '디자인', '개발', '기타')),
  content TEXT NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  contact_link TEXT NOT NULL,
  status TEXT DEFAULT '모집 중' CHECK (status IN ('모집 중', '모집 완료')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Set up Row Level Security (RLS)

-- Enable RLS on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Users Table Policies
-- Anyone can read user profiles
CREATE POLICY "Profiles are viewable by everyone."
  ON public.users FOR SELECT
  USING ( true );

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile."
  ON public.users FOR INSERT
  WITH CHECK ( auth.uid() = id );

-- Users can update their own profile
CREATE POLICY "Users can update own profile."
  ON public.users FOR UPDATE
  USING ( auth.uid() = id );

-- Posts Table Policies
-- Anyone can read posts
CREATE POLICY "Posts are viewable by everyone."
  ON public.posts FOR SELECT
  USING ( true );

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts."
  ON public.posts FOR INSERT
  WITH CHECK ( auth.uid() = author_id );

-- Users can update their own posts
CREATE POLICY "Users can update their own posts."
  ON public.posts FOR UPDATE
  USING ( auth.uid() = author_id );

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts."
  ON public.posts FOR DELETE
  USING ( auth.uid() = author_id );

-- 4. Create a trigger to automatically create a user profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
