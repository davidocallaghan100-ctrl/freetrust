import { Resend } from 'resend'

// Lazy singleton — only instantiated when RESEND_API_KEY is available at runtime
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM = 'FreeTrust <hello@freetrust.co>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://freetrust.co'

// ─── Shared template wrapper ──────────────────────────────────────────────────
function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <a href="${BASE_URL}" style="text-decoration:none;">
            <span style="font-size:22px;font-weight:800;color:#38bdf8;">Free</span><span style="font-size:22px;font-weight:800;color:#f1f5f9;">Trust</span>
            <span style="display:block;font-size:11px;color:#64748b;margin-top:2px;letter-spacing:0.08em;text-transform:uppercase;">Trust-Based Social Commerce</span>
          </a>
        </td></tr>
        <!-- Card -->
        <tr><td style="background:#1e293b;border:1px solid rgba(56,189,248,0.15);border-radius:16px;padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#475569;line-height:1.6;">
          © 2024 FreeTrust · <a href="${BASE_URL}/settings/notifications" style="color:#64748b;">Manage notifications</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function h1(text: string) { return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#f1f5f9;">${text}</h1>` }
function p(text: string) { return `<p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6;">${text}</p>` }
function btn(text: string, url: string) { return `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#38bdf8,#0284c7);color:#0f172a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${text}</a>` }
function trust(amount: number) { return `<div style="display:inline-block;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:12px 20px;margin:12px 0;font-size:20px;font-weight:800;color:#38bdf8;">₮${amount} Trust Bonus</div>` }
function divider() { return `<hr style="border:none;border-top:1px solid rgba(56,189,248,0.1);margin:20px 0;" />` }

// ─── Email senders ─────────────────────────────────────────────────────────────

// Welcome email. `amount` defaults to the canonical signup bonus
// (TRUST_REWARDS.SIGNUP_BONUS = 200) but the caller SHOULD pass the
// real amount actually issued to the user — the number here must
// match what they see in /wallet or it looks like a bug.
// Previously hardcoded to 25, which was wrong after the bonus was
// raised to 200.
export async function sendWelcomeEmail(to: string, name: string, amount: number = 200) {
  const amt = Math.max(0, Math.floor(amount))
  const html = wrap('Welcome to FreeTrust', `
    ${h1(`Welcome to FreeTrust, ${name}! 🎉`)}
    ${p('You\'ve joined a community built on trust. Your profile is live and you\'ve earned your founding member badge.')}
    ${trust(amt)}
    ${p(`₮${amt} Trust has been added to your wallet. Use it to unlock features, boost your listings, and build your reputation.`)}
    ${divider()}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
      <div style="font-size:13px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Your profile is your reputation</div>
      <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;line-height:1.6;">Members with a real photo and complete profile get <strong style="color:#f1f5f9;">3x more engagement</strong>. Take 60 seconds to add your face and a short bio — it's the single biggest thing you can do to get your first sale.</p>
      <div style="text-align:center;">${btn('Complete My Profile →', `${BASE_URL}/profile`)}</div>
    </div>
    ${divider()}
    ${p('Start exploring:')}
    <ul style="color:#94a3b8;font-size:14px;padding-left:20px;line-height:2;">
      <li>Add your first listing to earn ₮25 Trust</li>
      <li>Browse the marketplace to discover products and services</li>
      <li>Follow members in your field</li>
    </ul>
    ${divider()}
    <div style="text-align:center;padding-top:8px;">${btn('Go to My Wallet', `${BASE_URL}/wallet`)}</div>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Welcome to FreeTrust — you've received ₮${amt}!`,
    html,
  })
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  const html = wrap('Verify your email', `
    ${h1('Verify your email address')}
    ${p(`Hi ${name}, please verify your email to activate all FreeTrust features.`)}
    <div style="text-align:center;padding:8px 0 20px;">${btn('Verify Email', verifyUrl)}</div>
    ${p('This link expires in 24 hours. If you didn\'t create an account, you can safely ignore this email.')}
  `)
  return getResend().emails.send({ from: FROM, to, subject: 'Verify your FreeTrust email address', html })
}

export async function sendNewMessageEmail(to: string, name: string, senderName: string, preview: string) {
  const html = wrap('New message', `
    ${h1(`New message from ${senderName}`)}
    ${p(`Hi ${name}, you have a new message:`)}
    <div style="background:rgba(148,163,184,0.07);border-left:3px solid #38bdf8;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#cbd5e1;font-style:italic;">"${preview}"</div>
    <div style="text-align:center;">${btn('Reply Now', `${BASE_URL}/messages`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `New message from ${senderName} on FreeTrust`, html })
}

export async function sendOrderPlacedEmail(to: string, name: string, orderTitle: string, amount: number, orderId: string) {
  const html = wrap('Order confirmed', `
    ${h1('Order confirmed ✅')}
    ${p(`Hi ${name}, your order has been placed successfully.`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:16px;margin:0 0 20px;">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;">ORDER DETAILS</div>
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;">${orderTitle}</div>
      <div style="font-size:18px;font-weight:800;color:#38bdf8;margin-top:4px;">£${amount.toFixed(2)}</div>
    </div>
    <div style="text-align:center;">${btn('View Order', `${BASE_URL}/orders/${orderId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Order confirmed: ${orderTitle}`, html })
}

export async function sendOrderDeliveredEmail(to: string, name: string, orderTitle: string, orderId: string) {
  const html = wrap('Order delivered', `
    ${h1('Your order has been delivered 📦')}
    ${p(`Hi ${name}, your order <strong style="color:#f1f5f9;">${orderTitle}</strong> has been marked as delivered.`)}
    ${p('If you\'re happy with your purchase, please leave a review to help the seller and earn ₮10 Trust.')}
    ${divider()}
    <div style="text-align:center;">${btn('Leave a Review', `${BASE_URL}/orders/${orderId}/review`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Your order has arrived: ${orderTitle}`, html })
}

export async function sendReviewReceivedEmail(to: string, name: string, reviewerName: string, rating: number, preview: string) {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const html = wrap('New review received', `
    ${h1(`New review from ${reviewerName}`)}
    ${p(`Hi ${name}, you\'ve received a new review!`)}
    <div style="text-align:center;font-size:24px;color:#fbbf24;margin:12px 0;">${stars}</div>
    <div style="background:rgba(148,163,184,0.07);border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#cbd5e1;font-style:italic;">"${preview}"</div>
    <div style="text-align:center;">${btn('View & Reply', `${BASE_URL}/profile`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `${reviewerName} left you a ${rating}-star review`, html })
}

export async function sendTrustMilestoneEmail(to: string, name: string, balance: number, tierName: string) {
  const html = wrap('Trust milestone reached', `
    ${h1(`You reached ${tierName}! 🏆`)}
    ${p(`Congratulations ${name}! Your Trust score has hit a new milestone.`)}
    ${trust(balance)}
    ${p('Your reputation is growing. Keep transacting, reviewing, and contributing to the community to reach the next tier.')}
    <div style="text-align:center;">${btn('View My Trust Score', `${BASE_URL}/wallet`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `You've reached ${tierName} on FreeTrust! 🏆`, html })
}

export async function sendNewFollowerEmail(to: string, name: string, followerName: string, followerId: string) {
  const html = wrap('New follower', `
    ${h1(`${followerName} is now following you`)}
    ${p(`Hi ${name}, your network is growing!`)}
    <div style="text-align:center;">${btn('View Profile', `${BASE_URL}/profile/${followerId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `${followerName} started following you on FreeTrust`, html })
}

export async function sendEventReminderEmail(to: string, name: string, eventTitle: string, eventDate: string, eventId: string) {
  const html = wrap('Event reminder', `
    ${h1('Your event starts tomorrow ⏰')}
    ${p(`Hi ${name}, just a reminder that <strong style="color:#f1f5f9;">${eventTitle}</strong> is happening tomorrow.`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:14px 18px;margin:0 0 20px;">
      <div style="font-size:13px;color:#64748b;">DATE & TIME</div>
      <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-top:2px;">${eventDate}</div>
    </div>
    <div style="text-align:center;">${btn('View Event', `${BASE_URL}/events/${eventId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Reminder: ${eventTitle} is tomorrow`, html })
}

export async function sendWeeklyDigestEmail(to: string, name: string, stats: { newMessages: number; newFollowers: number; profileViews: number; trustBalance: number }) {
  const html = wrap('Your weekly FreeTrust digest', `
    ${h1(`Your week on FreeTrust, ${name}`)}
    ${p('Here\'s a summary of your activity this week:')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        ${[
          { label: 'Trust Balance', value: `₮${stats.trustBalance}`, color: '#38bdf8' },
          { label: 'New Messages', value: stats.newMessages, color: '#a78bfa' },
          { label: 'New Followers', value: stats.newFollowers, color: '#34d399' },
          { label: 'Profile Views', value: stats.profileViews, color: '#fbbf24' },
        ].map(s => `
          <td width="25%" style="padding:4px;">
            <div style="background:rgba(148,163,184,0.07);border-radius:10px;padding:14px 10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:${s.color};">${s.value}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${s.label}</div>
            </div>
          </td>
        `).join('')}
      </tr>
    </table>
    <div style="text-align:center;">${btn('View Full Dashboard', `${BASE_URL}/analytics`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Your FreeTrust weekly digest — week of ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, html })
}

// ─── Wallet ────────────────────────────────────────────────────────────────────

export async function sendWalletTopupEmail(to: string, name: string, amount: number) {
  const html = wrap('Wallet topped up', `
    ${h1('Funds added to your wallet 💳')}
    ${p(`Hi ${name}, your FreeTrust wallet has been topped up successfully.`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:20px;margin:0 0 20px;text-align:center;">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Amount added</div>
      <div style="font-size:32px;font-weight:900;color:#38bdf8;">€${amount.toFixed(2)}</div>
    </div>
    ${p('You can now use your wallet balance to buy products, book services, transfer to other members, or tip creators.')}
    <div style="text-align:center;">${btn('Open Wallet', `${BASE_URL}/wallet`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `€${amount.toFixed(2)} added to your FreeTrust wallet`, html })
}

export async function sendTransferReceivedEmail(to: string, name: string, senderName: string, amount: number, currency: 'EUR' | 'TRUST', note: string | null) {
  const symbol = currency === 'EUR' ? '€' : '₮'
  const fmtAmt = currency === 'EUR' ? amount.toFixed(2) : String(amount)
  const html = wrap('Transfer received', `
    ${h1(`${senderName} sent you ${symbol}${fmtAmt}`)}
    ${p(`Hi ${name}, you just received a transfer on FreeTrust.`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:20px;margin:0 0 16px;text-align:center;">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Received</div>
      <div style="font-size:32px;font-weight:900;color:#38bdf8;">${symbol}${fmtAmt}</div>
      <div style="font-size:13px;color:#64748b;margin-top:6px;">from ${senderName}</div>
    </div>
    ${note ? `<div style="background:rgba(148,163,184,0.07);border-left:3px solid #38bdf8;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#cbd5e1;font-style:italic;">"${note}"</div>` : ''}
    <div style="text-align:center;">${btn('Open Wallet', `${BASE_URL}/wallet`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `${senderName} sent you ${symbol}${fmtAmt} on FreeTrust`, html })
}

// ─── Referrals ─────────────────────────────────────────────────────────────────

export async function sendReferralJoinedEmail(to: string, name: string) {
  const html = wrap('New referral', `
    ${h1('Someone joined using your link 🎉')}
    ${p(`Hi ${name}, great news — a new member just signed up to FreeTrust using your referral link.`)}
    ${p('Once they complete their first transaction, you\'ll automatically earn <strong style="color:#38bdf8;">₮50 Trust</strong> as a thank-you from FreeTrust.')}
    <div style="text-align:center;padding-top:8px;">${btn('View My Referrals', `${BASE_URL}/settings?tab=referral`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: 'Someone joined FreeTrust using your referral link', html })
}

export async function sendReferralRewardEmail(to: string, name: string, amount: number) {
  const html = wrap('Referral reward earned', `
    ${h1(`You earned ₮${amount} Trust! 🎉`)}
    ${p(`Hi ${name}, your referred member just completed their first transaction.`)}
    ${trust(amount)}
    ${p('Thanks for growing the FreeTrust community. Keep sharing your referral link to earn more rewards.')}
    <div style="text-align:center;">${btn('View My Referrals', `${BASE_URL}/settings?tab=referral`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `You earned ₮${amount} Trust from a successful referral`, html })
}

// ─── Post engagement ───────────────────────────────────────────────────────────

export async function sendNewCommentEmail(to: string, name: string, commenterName: string, preview: string, postId: string) {
  const html = wrap('New comment', `
    ${h1(`${commenterName} commented on your post`)}
    ${p(`Hi ${name}, someone just commented on your post:`)}
    <div style="background:rgba(148,163,184,0.07);border-left:3px solid #38bdf8;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#cbd5e1;font-style:italic;">"${preview}"</div>
    <div style="text-align:center;">${btn('View Post', `${BASE_URL}/feed/${postId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `${commenterName} commented on your post`, html })
}

const REACTION_EMOJI: Record<string, string> = {
  trust: '👍', love: '❤️', insightful: '💡', collab: '🤝',
}

export async function sendNewReactionEmail(to: string, name: string, reactorName: string, reactionType: string, postId: string) {
  const emoji = REACTION_EMOJI[reactionType] ?? '❤️'
  const label = reactionType.charAt(0).toUpperCase() + reactionType.slice(1)
  const html = wrap('New reaction', `
    ${h1(`${reactorName} reacted ${emoji} to your post`)}
    ${p(`Hi ${name}, your post just got a new <strong style="color:#f1f5f9;">${label}</strong> reaction.`)}
    <div style="text-align:center;">${btn('View Post', `${BASE_URL}/feed/${postId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `${reactorName} reacted to your post`, html })
}

// ─── Orders (status changes beyond placed/delivered) ──────────────────────────

export async function sendOrderDispatchedEmail(to: string, name: string, orderTitle: string, orderId: string) {
  const html = wrap('Order dispatched', `
    ${h1('Your order is on the way 🚚')}
    ${p(`Hi ${name}, the seller has dispatched your order:`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:16px;margin:0 0 20px;">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;">${orderTitle}</div>
    </div>
    <div style="text-align:center;">${btn('Track Order', `${BASE_URL}/orders/${orderId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Order dispatched: ${orderTitle}`, html })
}

export async function sendOrderCompletedEmail(to: string, name: string, orderTitle: string, orderId: string) {
  const html = wrap('Order completed', `
    ${h1('Order completed ✅')}
    ${p(`Hi ${name}, your order <strong style="color:#f1f5f9;">${orderTitle}</strong> has been marked complete and payment has been released to the seller.`)}
    ${p('Would you like to leave a review? Great reviews earn you ₮10 Trust and help other buyers.')}
    <div style="text-align:center;">${btn('Leave a Review', `${BASE_URL}/orders/${orderId}/review`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Order completed: ${orderTitle}`, html })
}

export async function sendOrderDisputedEmail(to: string, name: string, orderTitle: string, orderId: string, reason: string) {
  const html = wrap('Order disputed', `
    ${h1('An order has been disputed ⚠️')}
    ${p(`Hi ${name}, a dispute has been raised on the following order:`)}
    <div style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:16px;margin:0 0 16px;">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">${orderTitle}</div>
      <div style="font-size:13px;color:#94a3b8;"><strong style="color:#f87171;">Reason:</strong> ${reason}</div>
    </div>
    ${p('Our team will review the dispute and contact you if we need more information. You can respond directly on the order page.')}
    <div style="text-align:center;">${btn('View Order', `${BASE_URL}/orders/${orderId}`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `Dispute raised: ${orderTitle}`, html })
}

// ─── Jobs ──────────────────────────────────────────────────────────────────────

export async function sendJobApplicationEmail(to: string, name: string, applicantName: string, jobTitle: string, jobId: string) {
  const html = wrap('New job application', `
    ${h1(`${applicantName} applied to your job`)}
    ${p(`Hi ${name}, you have a new applicant for:`)}
    <div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:16px;margin:0 0 20px;">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;">${jobTitle}</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Applicant: ${applicantName}</div>
    </div>
    <div style="text-align:center;">${btn('Review Application', `${BASE_URL}/jobs/${jobId}/applications`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `New application for: ${jobTitle}`, html })
}

// ─── Badges ────────────────────────────────────────────────────────────────────

export async function sendTrustBadgeEmail(to: string, name: string, badgeName: string, badgeDescription: string) {
  const html = wrap('New badge earned', `
    ${h1('You earned a new Trust Badge 🏅')}
    ${p(`Congratulations ${name}! You just unlocked:`)}
    <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:24px;margin:0 0 20px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🏅</div>
      <div style="font-size:20px;font-weight:800;color:#fbbf24;margin-bottom:6px;">${badgeName}</div>
      <div style="font-size:13px;color:#94a3b8;">${badgeDescription}</div>
    </div>
    ${p('Badges appear on your profile and help build trust with other community members.')}
    <div style="text-align:center;">${btn('View My Profile', `${BASE_URL}/profile`)}</div>
  `)
  return getResend().emails.send({ from: FROM, to, subject: `You earned the ${badgeName} badge on FreeTrust! 🏅`, html })
}

// ─── Onboarding Sequence ───────────────────────────────────────────────────────

// Email 2 — sent 24h after signup.
// Nudges the user to add their first listing and explains the three listing types.
export async function sendFirstListingNudgeEmail(to: string, name: string) {
  const html = wrap('Your creator journey starts here', `
    ${h1('Your first listing is waiting to go live')}
    ${p('FreeTrust is a creator economy — the more you put in, the more Trust you earn. Add your first product, service, or gig today.')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${[
        { emoji: '🛍️', label: 'Products',  desc: 'Physical or digital goods you make or sell' },
        { emoji: '🎯', label: 'Services',  desc: 'Design, coaching, writing, development — what you offer' },
        { emoji: '🤝', label: 'Gigs',      desc: 'Short tasks, commissions, or one-off jobs' },
      ].map(item => `
        <tr><td style="padding:6px 0;">
          <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.12);border-radius:10px;padding:14px 16px;display:flex;align-items:flex-start;">
            <span style="font-size:20px;margin-right:12px;line-height:1;">${item.emoji}</span>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:2px;">${item.label}</div>
              <div style="font-size:13px;color:#94a3b8;">${item.desc}</div>
            </div>
          </div>
        </td></tr>
      `).join('')}
    </table>
    <div style="background:rgba(56,189,248,0.1);border-radius:8px;padding:12px 16px;margin:0 0 20px;text-align:center;">
      <span style="font-size:14px;font-weight:700;color:#38bdf8;">Each listing earns you ₮25 Trust just for going live.</span>
    </div>
    ${divider()}
    <div style="text-align:center;padding-top:4px;">${btn('Add My First Listing →', `${BASE_URL}/create`)}</div>
    <div style="text-align:center;margin-top:14px;">
      <a href="${BASE_URL}/browse" style="font-size:13px;color:#64748b;text-decoration:underline;">Browse the marketplace first →</a>
    </div>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${name}, your creator journey starts here 🚀`,
    html,
  })
}

// Email 3 — sent 48h after signup, only if no profile photo is set.
// Encourages users to upload a real face photo to increase trust and conversion.
export async function sendProfilePhotoNudgeEmail(to: string, name: string) {
  const html = wrap('Members want to see who they\'re buying from', `
    ${h1('Put a face to your name')}
    ${p('You\'re more likely to get your first sale when people can see who they\'re dealing with. FreeTrust is built on trust — and trust starts with a real photo.')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        ${[
          { value: '3x', label: 'More profile visits',      color: '#38bdf8' },
          { value: '5x', label: 'More messages received',   color: '#a78bfa' },
          { value: '2x', label: 'Higher listing conversion', color: '#34d399' },
        ].map(s => `
          <td width="33%" style="padding:4px;">
            <div style="background:rgba(148,163,184,0.07);border-radius:10px;padding:14px 10px;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:${s.color};">${s.value}</div>
              <div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.4;">${s.label}</div>
            </div>
          </td>
        `).join('')}
      </tr>
    </table>
    ${p('It takes 30 seconds. Open your profile, tap your avatar, and upload a photo that shows your face clearly.')}
    ${divider()}
    <div style="text-align:center;padding-top:4px;">${btn('Update My Photo →', `${BASE_URL}/settings/profile`)}</div>
    <p style="text-align:center;margin-top:12px;font-size:12px;color:#475569;">Your photo is only shown to other FreeTrust members.</p>
  `)
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${name}, members want to see who they're buying from`,
    html,
  })
}

// ─── Community Welcome Campaign ───────────────────────────────────────────────

// sendWelcomeCommunityEmail — a visionary community welcome email with
// 4 action cards. Used as the welcome campaign template for both:
//  1. New user auto-trigger (fired from auth/callback after the community
//     email campaign is wired in)
//  2. Monday broadcast campaign to all existing users (2026-04-21 08:00 UTC)
//
// `referralCode` is the user's personal invite code shown in card 4.
export async function sendWelcomeCommunityEmail(to: string, name: string, referralCode: string) {
  const referralUrl = `${BASE_URL}/invite/${referralCode}`
  const firstName = name.split(' ')[0] || name

  const actionCard = (
    emoji: string,
    title: string,
    description: string,
    ctaText: string,
    ctaUrl: string,
    accentColor: string,
  ) => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <div style="background:rgba(30,41,59,0.8);border:1px solid ${accentColor}33;border-radius:14px;padding:20px;height:100%;box-sizing:border-box;">
        <div style="font-size:28px;margin-bottom:10px;line-height:1;">${emoji}</div>
        <div style="font-size:14px;font-weight:800;color:#f1f5f9;margin-bottom:6px;letter-spacing:-0.2px;">${title}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55;margin-bottom:14px;">${description}</div>
        <a href="${ctaUrl}" style="display:inline-block;background:${accentColor};color:#0f172a;font-weight:700;font-size:12px;padding:8px 16px;border-radius:7px;text-decoration:none;white-space:nowrap;">${ctaText}</a>
      </div>
    </td>
  `

  const html = wrap(`Welcome to the FreeTrust Community, ${firstName}!`, `
    <!-- Hero -->
    <div style="text-align:center;padding:8px 0 24px;">
      <div style="font-size:42px;margin-bottom:12px;">🌍</div>
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:-0.5px;">
        FreeTrust is bigger than a marketplace.
      </h1>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;max-width:440px;margin:0 auto;">
        Hi <strong style="color:#38bdf8;">${firstName}</strong> — you're part of something rare: a platform built entirely on real people, real trust, and real relationships. No bots. No fake reviews. No dark patterns.
      </p>
    </div>

    ${divider()}

    <!-- Vision statement -->
    <div style="background:linear-gradient(135deg,rgba(56,189,248,0.08),rgba(52,211,153,0.06));border:1px solid rgba(56,189,248,0.2);border-radius:14px;padding:22px 24px;margin:0 0 24px;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Our Mission</div>
      <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.7;font-style:italic;">
        "To create the world's most trustworthy commerce community — where every transaction is backed by verified reputation and every connection is genuine."
      </p>
    </div>

    <!-- 4 Action Cards — 2×2 grid -->
    <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Get started in 4 steps</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        ${actionCard('👤', 'Add Your Real Photo', 'Profiles with a real face get 3× more engagement. It\'s the single biggest trust signal on the platform.', 'Upload Photo →', `${BASE_URL}/settings/profile`, '#38bdf8')}
        ${actionCard('💬', 'Ask Us Anything', 'Have a question about selling, buying, or trust? Reach the team directly — we read every message.', 'Start a Chat →', `${BASE_URL}/messages`, '#a78bfa')}
      </tr>
      <tr>
        ${actionCard('🚀', 'Launch Your First Listing', 'Add a product, service, or gig. Each listing earns you ₮25 Trust and opens the door to your first buyer.', 'Create Listing →', `${BASE_URL}/create`, '#34d399')}
        ${actionCard('🎁', 'Invite Someone You Trust', 'FreeTrust grows one genuine person at a time. Share your link and earn ₮50 Trust when they transact.', 'Copy My Link →', referralUrl, '#fbbf24')}
      </tr>
    </table>

    <!-- Referral code highlight -->
    <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:16px 20px;margin:16px 0 24px;display:flex;align-items:center;gap:12px;">
      <div style="font-size:22px;">🔗</div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Your Personal Invite Link</div>
        <a href="${referralUrl}" style="font-size:13px;color:#38bdf8;text-decoration:underline;word-break:break-all;">${referralUrl}</a>
      </div>
    </div>

    ${divider()}

    <!-- Closing -->
    <p style="margin:0 0 6px;font-size:14px;color:#94a3b8;line-height:1.65;text-align:center;">
      You joined a movement, not just a marketplace. We're grateful you're here.
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.65;text-align:center;">
      — The FreeTrust Team 🤝
    </p>
    <div style="text-align:center;">${btn('Explore FreeTrust →', BASE_URL)}</div>
  `)

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${firstName}, welcome to the FreeTrust community 🌍`,
    html,
  })
}

// ─── Monthly Seller Statement ─────────────────────────────────────────────────

export interface MonthlyStatementOrder {
  invoiceNumber: string | null
  date: string
  itemTitle: string
  grossCents: number
  netCents: number
}

export async function sendMonthlyStatementEmail(
  to: string,
  name: string,
  monthName: string,
  year: number,
  stats: {
    grossCents: number
    feeCents: number
    netCents: number
    orderCount: number
    trustCoinsEarned: number
  },
  orders: MonthlyStatementOrder[],
  totalOrders: number,
) {
  const fmt = (cents: number) =>
    '€' + (cents / 100).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const netFormatted = fmt(stats.netCents)
  const subject = `Your FreeTrust earnings for ${monthName} ${year} — ${netFormatted} net`

  const statBox = (value: string, label: string, color: string) => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <div style="background:rgba(148,163,184,0.07);border-radius:12px;padding:16px 12px;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:${color};">${value}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
      </div>
    </td>
  `

  const orderRows = orders.slice(0, 10).map(o => {
    const date = new Date(o.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
    const title = o.itemTitle.length > 40 ? o.itemTitle.slice(0, 38) + '…' : o.itemTitle
    const inv = o.invoiceNumber ?? '—'
    return `
      <tr>
        <td style="padding:8px 6px;font-size:12px;color:#64748b;border-bottom:1px solid rgba(255,255,255,0.05);">${inv}</td>
        <td style="padding:8px 6px;font-size:12px;color:#cbd5e1;border-bottom:1px solid rgba(255,255,255,0.05);">${date}</td>
        <td style="padding:8px 6px;font-size:12px;color:#cbd5e1;border-bottom:1px solid rgba(255,255,255,0.05);max-width:160px;overflow:hidden;">${title}</td>
        <td style="padding:8px 6px;font-size:12px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${fmt(o.grossCents)}</td>
        <td style="padding:8px 6px;font-size:13px;font-weight:700;color:#10b981;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${fmt(o.netCents)}</td>
      </tr>
    `
  }).join('')

  const moreLink = totalOrders > 10
    ? `<p style="margin:8px 0 0;font-size:12px;color:#64748b;text-align:center;">…and ${totalOrders - 10} more. <a href="${BASE_URL}/accounting" style="color:#38bdf8;text-decoration:underline;">View full statement →</a></p>`
    : ''

  const html = wrap(`Your ${monthName} ${year} Earnings Summary`, `
    ${h1(`Your ${monthName} ${year} earnings summary`)}
    ${p(`Hi ${name}, here's a full breakdown of your FreeTrust seller activity last month.`)}

    <!-- 4 stat boxes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        ${statBox(fmt(stats.grossCents), 'Gross Sales', '#f1f5f9')}
        ${statBox(fmt(stats.feeCents), 'Platform Fees', '#94a3b8')}
      </tr>
      <tr>
        ${statBox(fmt(stats.netCents), 'Net Earnings', '#10b981')}
        ${statBox(String(stats.orderCount), 'Orders Completed', '#38bdf8')}
      </tr>
    </table>

    <!-- TrustCoins -->
    ${stats.trustCoinsEarned > 0 ? `
    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:14px 18px;margin:0 0 20px;text-align:center;">
      <span style="font-size:13px;color:#10b981;font-weight:700;">₮${stats.trustCoinsEarned} TrustCoins earned this month</span>
    </div>` : ''}

    ${divider()}

    <!-- Orders table -->
    <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Orders</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
      <thead>
        <tr>
          <th style="padding:6px;font-size:11px;color:#475569;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Invoice</th>
          <th style="padding:6px;font-size:11px;color:#475569;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
          <th style="padding:6px;font-size:11px;color:#475569;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Item</th>
          <th style="padding:6px;font-size:11px;color:#475569;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Gross</th>
          <th style="padding:6px;font-size:11px;color:#475569;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Net</th>
        </tr>
      </thead>
      <tbody>${orderRows}</tbody>
    </table>
    ${moreLink}

    ${divider()}
    <div style="text-align:center;padding-top:4px;">${btn('📊 View Full Accounting →', `${BASE_URL}/accounting`)}</div>
    <p style="text-align:center;margin-top:14px;font-size:12px;color:#475569;">
      FreeTrust · hello@freetrust.co · <a href="${BASE_URL}/profile" style="color:#64748b;">Manage notifications</a>
    </p>
  `)

  return getResend().emails.send({ from: FROM, to, subject, html })
}

// ─── Outbound Campaigns ────────────────────────────────────────────────────────

// sendCampaignEmail — used for broadcast/drip campaigns from the admin panel.
// bodyHtml is the raw HTML content of the campaign body (can include tags, lists, links).
// The subject is rendered both in the email subject line and as an h1 heading.
export async function sendCampaignEmail(to: string, name: string, subject: string, bodyHtml: string) {
  const html = wrap(subject, `
    ${h1(subject)}
    <div style="color:#94a3b8;font-size:15px;line-height:1.7;">${bodyHtml}</div>
    ${divider()}
    <p style="font-size:11px;color:#475569;text-align:center;margin:0;">
      You're receiving this because you're a member of FreeTrust.&nbsp;
      <a href="${BASE_URL}/settings/notifications" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
    </p>
  `)
  return getResend().emails.send({ from: FROM, to, subject, html })
}
