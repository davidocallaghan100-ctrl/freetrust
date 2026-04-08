import { Suspense } from "react";
import CheckoutSuccessContent from "@/components/CheckoutSuccessContent";

export const metadata = {
  title: "Payment Successful — FreeTrust",
  description: "Your payment was received and is held in escrow.",
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="checkout-loading">Loading your order details...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

