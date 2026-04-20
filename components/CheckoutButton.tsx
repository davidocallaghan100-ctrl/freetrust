'use client';

import { useState } from "react";

interface CheckoutButtonProps {
  priceId?: string;
  amount?: number;
  label?: string;
  className?: string;
}

// Stripe checkout placeholder — configure STRIPE_SECRET_KEY to enable
export default function CheckoutButton({ label = "Buy Now", className = "" }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    alert("Payment coming soon!");
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{
        padding: "0.75rem 1.5rem",
        background: "var(--color-primary, #38bdf8)",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Processing..." : label}
    </button>
  );
}
