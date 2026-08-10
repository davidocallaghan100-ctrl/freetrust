// Shared coordinator ensuring only one feed audio source — video sound or a
// soundtrack preview on a photo post — is ever audible across the whole
// newsfeed at once. Any player about to become audible calls
// `announceFeedAudioPlayback` right before unmuting/starting sound;
// `window.dispatchEvent` runs listeners synchronously, so every other
// currently-audible player yields (mutes or pauses) before the announcer
// itself goes live — this holds even when two players try to go audible in
// the same tick (e.g. two videos crossing their visibility threshold on a
// fast scroll).

export const FEED_AUDIO_PLAY_EVENT = 'freetrust:feed-audio-play'

export interface FeedAudioPlayDetail {
  playerId: string
}

export function announceFeedAudioPlayback(playerId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<FeedAudioPlayDetail>(FEED_AUDIO_PLAY_EVENT, { detail: { playerId } }))
}

export function generateFeedPlayerId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}
