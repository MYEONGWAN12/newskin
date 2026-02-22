-- 기존 테이블에 참가자 수 필드 추가 (또는 별도 테이블 사용)
-- 여기서는 실제 참가 신청 기능을 위해 post_members 테이블을 생성합니다.

-- 1. 수상 내역 테이블 (Awards)
CREATE TABLE awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  award_date DATE NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 게시글 참가자 테이블 (Post Members)
CREATE TABLE post_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

-- RLS 설정
ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_members ENABLE ROW LEVEL SECURITY;

-- 수상 내역은 누구나 조회 가능
CREATE POLICY "Anyone can view awards" ON awards FOR SELECT USING (true);

-- 참가자 정보 조회 정책
CREATE POLICY "Anyone can view post members" ON post_members FOR SELECT USING (true);

-- 로그인한 사용자는 참가 신청 가능
CREATE POLICY "Authenticated users can join posts" ON post_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인의 참가 신청 취소 가능
CREATE POLICY "Users can leave posts" ON post_members 
FOR DELETE USING (auth.uid() = user_id);

-- 초기 데이터 예시 (수상 내역)
INSERT INTO awards (title, description, award_date) VALUES 
('제 1회 대학생 연합 해커톤 대상', '핀스킨 팀이 혁신적인 매칭 알고리즘으로 대상을 수상했습니다.', '2025-11-20'),
('교내 창업 경진대회 최우수상', '동아리 매칭 플랫폼의 사업성을 인정받아 최우수상을 수상했습니다.', '2025-09-15');
