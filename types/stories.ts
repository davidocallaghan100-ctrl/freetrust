export type StoryMediaType = 'image' | 'video'

export interface StoryRecord {
  id: string
  user_id: string
  media_url: string
  media_type: StoryMediaType
  caption: string | null
  duration_seconds: number
  created_at: string
  expires_at: string
  saved_as_memory: boolean
  view_count: number
  // Set when this story was posted under an organisation's identity rather
  // than the poster's personal profile (mirrors feed_posts/articles'
  // posted_as_organisation_id display-override pattern). `user_id` above
  // still records the real posting member for audit + permission checks.
  posted_as_organisation_id?: string | null
  // Populated by the API only when posted_as_organisation_id is set — the
  // posting member's display name, for the "Posted by [name]" line.
  posted_by_name?: string | null
}

export interface StoryOrgIdentity {
  id: string
  name: string
  logo_url: string | null
}

export interface StoryAuthorGroup {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  // Set (alongside `user` mirroring the org's name/logo) when this group
  // represents an organisation's stories rather than a person's. Frontend
  // code should treat `!!org` as the "is this an org bubble" check.
  org?: StoryOrgIdentity | null
  // True if the current viewer may manage (delete) this group's stories —
  // for personal groups this is just "is it your own group"; for org groups
  // it means the viewer currently has an owner/admin role in that org.
  canManage?: boolean
  stories: StoryRecord[]
  hasUnviewed: boolean
  latestCreatedAt: string
}

export interface ManageableOrgForStories {
  id: string
  name: string
  logo_url: string | null
}

export interface MemoryRecord {
  id: string
  user_id: string
  story_id: string | null
  media_url: string
  media_type: StoryMediaType
  caption: string | null
  original_created_at: string
  saved_at: string
}

export const MAX_STORY_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB
export const MAX_STORY_IMAGE_WIDTH = 1080
export const MAX_STORY_VIDEO_SECONDS = 30
export const DEFAULT_IMAGE_STORY_DURATION_SECONDS = 5
