import Link from "next/link";

export const metadata = {
  title: "Payment Cancelled — FreeTrust",
  description: "Your payment was cancelled. No charges were made.",
};

export default function CheckoutCancelPage() {
  return (
    <main className="checkout-page">
      <div className="checkout-card">
        <div className="checkout-icon checkout-icon--cancel">✕</div>
        <h1 className="checkout-title">Payment Cancelled</h1>
        <p className="checkout-description">
          No worries — your payment was cancelled and you were not charged.
          You can return to browse services or try again at any time.
        </p>
        <div className="checkout-actions">
          <Link href="/" className="checkout-btn checkout-btn--primary">
            Back to Home
          </Link>
          <Link href="/services" className="checkout-btn checkout-btn--secondary">
            Browse Services
          </Link>
        </div>
      </div>
    </main>
  );
}

