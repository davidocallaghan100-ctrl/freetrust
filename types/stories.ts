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
}

export interface StoryAuthorGroup {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  stories: StoryRecord[]
  hasUnviewed: boolean
  latestCreatedAt: string
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
