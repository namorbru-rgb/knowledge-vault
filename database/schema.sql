-- KnowledgeVault Database Schema
-- Run this in the Supabase SQL Editor: https://app.supabase.com/project/nixakeaiibzhesdwtelw/sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kv_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  description text,
  duration_seconds int,
  thumbnail_url text,
  storage_path text,
  audio_path text,
  transcript_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_video_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid REFERENCES kv_videos(id) ON DELETE CASCADE,
  user_id uuid,
  start_time float,
  end_time float,
  text text,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  description text,
  main_text text,
  summary text,
  tags text[],
  embedding vector(1536),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text,
  filename text,
  description text,
  objects_detected text[],
  ocr_text text,
  embedding vector(1536),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  video_id uuid REFERENCES kv_videos(id),
  link_id uuid REFERENCES kv_links(id),
  photo_id uuid REFERENCES kv_photos(id),
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kv_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_profiles" ON kv_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "user_own_videos" ON kv_videos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_video_segments" ON kv_video_segments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_links" ON kv_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_photos" ON kv_photos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_notes" ON kv_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_api_keys" ON kv_api_keys FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION kv_search_similar(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  content text,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT vs.id, 'video_segment'::text, v.title, vs.text,
    1 - (vs.embedding <=> query_embedding), vs.created_at
  FROM kv_video_segments vs JOIN kv_videos v ON v.id = vs.video_id
  WHERE vs.user_id = p_user_id AND vs.embedding IS NOT NULL
    AND 1 - (vs.embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT l.id, 'link'::text, l.title, COALESCE(l.summary, l.description),
    1 - (l.embedding <=> query_embedding), l.created_at
  FROM kv_links l
  WHERE l.user_id = p_user_id AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT p.id, 'photo'::text, p.filename, p.description,
    1 - (p.embedding <=> query_embedding), p.created_at
  FROM kv_photos p
  WHERE p.user_id = p_user_id AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT n.id, 'note'::text, 'Note'::text, n.content,
    1 - (n.embedding <=> query_embedding), n.created_at
  FROM kv_notes n
  WHERE n.user_id = p_user_id AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC LIMIT match_count;
END;
$$;
