-- User Follows
CREATE TABLE IF NOT EXISTS user_follows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view follows"
  ON user_follows FOR SELECT
  USING (true);

CREATE POLICY "users can follow"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "users can unfollow"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);
