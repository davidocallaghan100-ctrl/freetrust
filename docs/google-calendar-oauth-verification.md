# Google Calendar OAuth verification

FreeTrust's Google Calendar connection uses a custom Google OAuth client (the
credentials in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`GOOGLE_REDIRECT_URI`). Because Calendar event sync requires a sensitive Google
scope, Google can show users the warning:

> Google hasn't verified this app

## Code-side mitigation already applied

The OAuth request now asks only for:

- `https://www.googleapis.com/auth/calendar.events`

This is the least-privilege scope that still supports FreeTrust's current
two-way event sync:

- importing users' Google Calendar events into FreeTrust
- creating FreeTrust-native calendar items in the user's Google Calendar

FreeTrust no longer requests the broader
`https://www.googleapis.com/auth/calendar` scope.

## Google Console action still required

Google can still show the unverified-app warning until the OAuth consent app is
verified in Google Cloud Console. To remove it for public users:

1. Open Google Cloud Console for the project that owns the OAuth client ID used
   in production.
2. Go to **APIs & Services → OAuth consent screen**.
3. Confirm the app is configured for **External** users and published to
   production.
4. Ensure app name, user support email, developer contact email, homepage,
   privacy policy, and terms links are filled in.
5. Add/confirm the authorized domain: `freetrust.co`.
6. Under **Data Access / Scopes**, include only:
   - `https://www.googleapis.com/auth/calendar.events`
7. Submit the app for Google verification.
8. In **APIs & Services → Credentials**, confirm the production OAuth client has
   this authorized redirect URI:
   - `https://freetrust.co/api/calendar/google/callback`

Do not proactively ask existing users to disconnect/reconnect Google Calendar as
part of this remediation unless David separately approves that user-facing step.
