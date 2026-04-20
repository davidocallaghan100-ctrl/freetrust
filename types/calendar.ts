// ============================================================================
// FreeTrust Calendar — Shared Types
// ============================================================================

export type CalendarSourceType =
  | 'gig'
  | 'product'
  | 'service'
  | 'event'
  | 'reminder'
  | 'manual'

/** Colour assigned to each source type in the calendar */
export const SOURCE_TYPE_COLORS: Record<CalendarSourceType, string> = {
  gig:      '#10b981', // emerald
  product:  '#f59e0b', // amber
  service:  '#38bdf8', // sky-blue (FreeTrust brand)
  event:    '#8b5cf6', // violet
  reminder: '#94a3b8', // silver / slate
  manual:   '#64748b', // slate
}

/** Label shown in the filter chips */
export const SOURCE_TYPE_LABELS: Record<CalendarSourceType, string> = {
  gig:      'Gigs',
  product:  'Products',
  service:  'Services',
  event:    'Events',
  reminder: 'Reminders',
  manual:   'Personal',
}

// ── Database row type ────────────────────────────────────────────────────────

export interface CalendarEventRow {
  id:             string
  user_id:        string
  title:          string
  description:    string | null
  start_at:       string   // ISO timestamptz
  end_at:         string | null
  all_day:        boolean
  location:       string | null
  source_type:    CalendarSourceType
  source_id:      string | null
  google_event_id:string | null
  color:          string | null
  created_at:     string
  updated_at:     string
}

// ── react-big-calendar Event shape ──────────────────────────────────────────

/** The object we feed to react-big-calendar's <Calendar events={...}> prop */
export interface RBCEvent {
  id:          string
  title:       string
  start:       Date
  end:         Date
  allDay:      boolean
  resource:    CalendarEventRow   // original DB row attached for the drawer
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface CreateEventPayload {
  title:       string
  description?: string
  start_at:    string
  end_at?:     string
  all_day?:    boolean
  location?:   string
  source_type?: CalendarSourceType
  color?:      string
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  id: string
}

// ── Google Calendar token row ────────────────────────────────────────────────

export interface GoogleCalendarTokenRow {
  user_id:            string
  access_token:       string
  refresh_token:      string | null
  expires_at:         string | null   // ISO timestamptz
  scope:              string | null
  synced_at:          string | null   // ISO timestamptz
  sync_ft_to_google:  boolean
  sync_google_to_ft:  boolean
  created_at:         string
  updated_at:         string
}
