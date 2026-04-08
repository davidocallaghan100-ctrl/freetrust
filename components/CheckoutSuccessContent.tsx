"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SessionSummary {
  itemName: string;
  amountTotal: number;
  platformFeeAmount: number;
  platformFeeRate: number;
  type: string;
  currency: string;
}

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found.");
      setLoading(false);
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch(`/api/checkout/session?session_id=${sessionId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load order details.");
          return;
        }
        const data = await res.json();
        setSummary(data);
      } catch {
        setError("Something went wrong loading your order details.");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  if (loading) {
    return <div className="checkout-loading">Loading your order details...</div>;
  }

  if (error) {
    return (
      <main className="checkout-page">
        <div className="checkout-card">
          <div className="checkout-icon checkout-icon--success">✓</div>
          <h1 className="checkout-title">Payment Received!</h1>
          <p className="checkout-description">
            Your payment was successful and is now held securely in escrow.
            Funds will be released to the seller once delivery is confirmed.
          </p>
          <div className="checkout-actions">
            <Link href="/" className="checkout-btn checkout-btn--primary">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const feeLabel = summary?.type === "service" ? "8% service fee" : "5% product fee";
  const amountDisplay = summary
    ? `$${(summary.amountTotal / 100).toFixed(2)} ${summary.currency.toUpperCase()}`
    : "";
  const feeDisplay = summary
    ? `$${(summary.platformFeeAmount / 100).toFixed(2)}`
    : "";
  const sellerReceives = summary
    ? `$${((summary.amountTotal - summary.platformFeeAmount) / 100).toFixed(2)}`
    : "";

  return (
    <main className="checkout-page">
      <div className="checkout-card">
        <div className="checkout-icon checkout-icon--success">✓</div>
        <h1 className="checkout-title">Payment Successful!</h1>
        <p className="checkout-description">
          Your payment is held securely in escrow. Funds will be released to the seller
          once you confirm delivery.
        </p>

        {summary && (
          <div className="checkout-summary">
            <h2 className="checkout-summary-title">Order Summary</h2>
            <div className="checkout-summary-row">
              <span>Item</span>
              <span>{summary.itemName}</span>
            </div>
            <div className="checkout-summary-row">
              <span>Total Paid</span>
              <span>{amountDisplay}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--fee">
              <span>Platform Fee ({feeLabel})</span>
              <span>{feeDisplay}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--seller">
              <span>Seller Receives</span>
              <span>{sellerReceives}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--escrow">
              <span>Status</span>
              <span>🔒 Held in Escrow</span>
            </div>
          </div>
        )}

        <div className="checkout-actions">
          <Link href="/orders" className="checkout-btn checkout-btn--primary">
            View My Orders
          </Link>
          <Link href="/services" className="checkout-btn checkout-btn--secondary">
            Browse More Services
          </Link>
        </div>
      </div>
    </main>
  );
}

