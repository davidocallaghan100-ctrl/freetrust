// FreeTrust is a trust platform: public content surfaces must never show
// generated/seeded/curated filler data. Keep these PostgREST filter strings
// close to the data reads so accidental fake rows stay hidden even before a
// cleanup job removes them.

export const REAL_EVENT_SOURCE_FILTER =
  'external_source.in.(meetup,ticketmaster,predicthq,eventbrite),and(external_source.is.null,is_platform_curated.is.false)'

export const REAL_JOB_SOURCE_FILTER =
  'job_source.in.(remotive,arbeitnow),and(job_source.is.null,poster_id.not.is.null)'
