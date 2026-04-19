'use client'
/**
 * AppleGooglePayButton
 *
 * Renders an Apple Pay / Google Pay express-checkout button using the
 * Stripe Payment Request API. The button is ONLY shown when the current
 * device/browser actually supports one of these wallets:
 *   • Apple Pay  — iOS Safari, macOS Safari (with Apple Pay card on file)
 *   • Google Pay — Chrome Android, Chrome desktop (with Google Pay set up)
 *
 * If neither is available the component returns null — no extra UI is added
 * for users on unsupported browsers.
 *
 * Usage:
 *   <AppleGooglePayButton
 *     amountCents={2500}
 *     label="FreeTrust Wallet Top-up"
 *     onSuccess={(piId) => console.log('paid', piId)}
 *     onError={(msg) => console.error(msg)}
 *   />
 */
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { loadStripe, type Stripe, type PaymentRequest } from '@stripe/stripe-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppleGooglePayButtonProps {
  /** Payment amount in **cents** (e.g. 2500 = €25.00) */
  amountCents: number
  /** ISO 4217 currency code, defaults to 'EUR' */
  currency?: string
  /** Line-item label shown in the Apple/Google Pay sheet */
  label?: string
  /** Description stored on the Stripe PaymentIntent */
  description?: string
  /** Extra metadata forwarded to the PaymentIntent */
  metadata?: Record<string, string>
  /** Called with the PaymentIntent ID on successful payment */
  onSuccess: (paymentIntentId: string) => void
  /** Called with a human-readable message on any failure */
  onError: (message: string) => void
  /** Optional wrapper style overrides */
  style?: React.CSSProperties
}

// ─── Stripe singleton ─────────────────────────────────────────────────────────

let stripePromise: ReturnType<typeof loadStripe> | null = null

function getStripe(): ReturnType<typeof loadStripe> | null {
  if (typeof window === 'undefined') return null
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) return null
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppleGooglePayButton({
  amountCents,
  currency = 'EUR',
  label = 'FreeTrust',
  description,
  metadata,
  onSuccess,
  onError,
  style,
}: AppleGooglePayButtonProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)
  const [available, setAvailable] = useState(false)
  const [walletType, setWalletType] = useState<'applePay' | 'googlePay' | 'link' | null>(null)
  const [processing, setProcessing] = useState(false)
  // Keep a stable ref to the current client_secret so the paymentmethod
  // handler (which captures it via closure) always sees the latest value.
  const clientSecretRef = useRef<string | null>(null)

  // ── Load Stripe.js once ───────────────────────────────────────────────────
  useEffect(() => {
    const p = getStripe()
    if (!p) return
    p.then(s => { if (s) setStripe(s) }).catch(() => { /* ignore */ })
  }, [])

  // ── Build / rebuild PaymentRequest when stripe or amount changes ──────────
  useEffect(() => {
    if (!stripe) return

    const pr = stripe.paymentRequest({
      country: 'IE',
      currency: currency.toLowerCase(),
      total: { label, amount: amountCents },
      requestPayerName: false,
      requestPayerEmail: false,
    })

    pr.canMakePayment().then(result => {
      if (!result) { setAvailable(false); return }

      setPaymentRequest(pr)
      setAvailable(true)

      // Detect which wallet is available for the button label
      if (result.applePay)  setWalletType('applePay')
      else if (result.googlePay) setWalletType('googlePay')
      else setWalletType('link')
    }).catch(() => setAvailable(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, amountCents, currency, label])

  // ── Handle button click ───────────────────────────────────────────────────
  const handleClick = useCallback(async () => {
    if (!paymentRequest || !stripe || processing) return
    setProcessing(true)

    try {
      // 1. Create a PaymentIntent server-side
      const res = await fetch('/api/stripe/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: amountCents,
          currency: currency.toLowerCase(),
          description,
          metadata,
        }),
      })
      const data = await res.json() as { client_secret?: string; error?: string }

      if (!res.ok || !data.client_secret) {
        onError(data.error ?? 'Failed to create payment. Please try again.')
        setProcessing(false)
        return
      }

      clientSecretRef.current = data.client_secret

      // 2. Register the paymentmethod handler BEFORE calling .show()
      //    (Stripe emits the event immediately after the user authorises)
      paymentRequest.once('paymentmethod', async (ev) => {
        const secret = clientSecretRef.current!

        // Confirm without 3DS first — if the card needs 3DS we handle it below
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          secret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        )

        if (confirmError) {
          ev.complete('fail')
          onError(confirmError.message ?? 'Payment failed. Please try again.')
          setProcessing(false)
          return
        }

        if (paymentIntent?.status === 'requires_action') {
          // Card requires 3DS — close the sheet first, then redirect for auth
          ev.complete('success')
          const { error: actionError, paymentIntent: pi2 } = await stripe.confirmCardPayment(secret)
          if (actionError) {
            onError(actionError.message ?? 'Payment authentication failed.')
            setProcessing(false)
            return
          }
          onSuccess(pi2?.id ?? '')
          setProcessing(false)
          return
        }

        ev.complete('success')
        onSuccess(paymentIntent?.id ?? '')
        setProcessing(false)
      })

      // 3. Open the native Apple Pay / Google Pay sheet
      paymentRequest.show()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment error. Please try again.'
      onError(msg)
      setProcessing(false)
    }
  }, [paymentRequest, stripe, processing, amountCents, currency, description, metadata, onSuccess, onError])

  // ── Don't render if wallet pay is not available ───────────────────────────
  if (!available) return null

  const formattedAmount = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)

  const buttonLabel = walletType === 'applePay'
    ? `🍎 Pay ${formattedAmount}`
    : walletType === 'googlePay'
      ? `Pay ${formattedAmount}`
      : `⚡ Pay ${formattedAmount}`

  return (
    <div style={style}>
      {/* "or pay instantly with" divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        color: '#475569',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.15)' }} />
        <span>or pay instantly</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.15)' }} />
      </div>

      {/* Native wallet button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={processing}
        aria-label={buttonLabel}
        style={{
          width: '100%',
          height: 50,
          borderRadius: 12,
          border: walletType === 'applePay' ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
          // Apple Pay brand guidelines: black background
          // Google Pay: dark with subtle border
          background: processing
            ? 'rgba(30,41,59,0.8)'
            : walletType === 'applePay'
              ? '#000'
              : 'linear-gradient(135deg, #1a1a2e, #16213e)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: walletType === 'applePay'
            ? '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif'
            : '"Google Sans", "Roboto", system-ui, sans-serif',
          cursor: processing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'opacity 0.15s, transform 0.1s',
          opacity: processing ? 0.6 : 1,
          letterSpacing: walletType === 'applePay' ? '-0.3px' : '0',
        }}
        onMouseEnter={e => { if (!processing) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
        onMouseLeave={e => { if (!processing) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        {processing ? (
          <>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span>Processing…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>
    </div>
  )
}
