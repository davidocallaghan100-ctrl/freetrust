// Server-side helper to send a push notification to a user
// Call this from API routes or server actions

export async function sendPushNotification({
  userId,
  title,
  message,
  url,
}: {
  userId: string
  title: string
  message: string
  url: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
  try {
    const res = await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ user_id: userId, title, message, url }),
    })
    return res.ok
  } catch {
    return false
  }
}
