"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [inputEmail, setInputEmail] = useState(email);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (email) {
      setInputEmail(email);
      handleUnsubscribe(email);
    }
  }, [email]);

  async function handleUnsubscribe(emailToUnsub: string) {
    if (!emailToUnsub) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUnsub }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (data.success) {
        setStatus("success");
        setMessage(data.message ?? "You have been unsubscribed.");
      } else {
        setStatus("error");
        setMessage(data.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid rgba(56,189,248,0.15)",
      borderRadius: "16px",
      padding: "40px 32px",
      maxWidth: "480px",
      width: "100%",
      textAlign: "center",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: "24px" }}>
        <span style={{ fontSize: "22px", fontWeight: 800, color: "#38bdf8" }}>Free</span>
        <span style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9" }}>Trust</span>
        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Trust-Based Social Commerce
        </div>
      </div>

      {status === "loading" && (
        <>
          <div style={{ fontSize: "36px", marginBottom: "16px" }}>⏳</div>
          <h1 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Processing...
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>Removing you from our list.</p>
        </>
      )}

      {status === "success" && (
        <>
          <div style={{ fontSize: "36px", marginBottom: "16px" }}>✅</div>
          <h1 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            You&apos;ve been unsubscribed
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
            {inputEmail && <><strong style={{ color: "#cbd5e1" }}>{inputEmail}</strong><br /></>}
            You won&apos;t receive any more emails from FreeTrust. Sorry to see you go.
          </p>
          <a
            href="https://freetrust.co"
            style={{
              display: "inline-block",
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.2)",
              color: "#38bdf8",
              padding: "10px 24px",
              borderRadius: "50px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Visit FreeTrust
          </a>
        </>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: "36px", marginBottom: "16px" }}>❌</div>
          <h1 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "16px" }}>{message}</p>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            Email us at{" "}
            <a href="mailto:hello@freetrust.co" style={{ color: "#38bdf8" }}>
              hello@freetrust.co
            </a>{" "}
            and we&apos;ll remove you manually.
          </p>
        </>
      )}

      {status === "idle" && !email && (
        <>
          <h1 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Unsubscribe from FreeTrust emails
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
            We&apos;re sorry to see you go. Enter your email below and you&apos;ll be removed from all future outreach.
          </p>
          <input
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: "10px",
              color: "#f1f5f9",
              fontSize: "15px",
              marginBottom: "16px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            onClick={() => handleUnsubscribe(inputEmail)}
            disabled={!inputEmail}
            style={{
              display: "inline-block",
              background: inputEmail ? "linear-gradient(135deg,#0ea5e9,#38bdf8)" : "rgba(56,189,248,0.2)",
              color: "#fff",
              padding: "12px 32px",
              borderRadius: "50px",
              border: "none",
              fontSize: "15px",
              fontWeight: 700,
              cursor: inputEmail ? "pointer" : "not-allowed",
              width: "100%",
              opacity: inputEmail ? 1 : 0.5,
            }}
          >
            Unsubscribe me
          </button>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "20px",
    }}>
      <Suspense fallback={
        <div style={{
          background: "#1e293b",
          border: "1px solid rgba(56,189,248,0.15)",
          borderRadius: "16px",
          padding: "40px 32px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          color: "#94a3b8",
        }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "#38bdf8" }}>Free</span>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9" }}>Trust</span>
          <p style={{ marginTop: "24px" }}>Loading...</p>
        </div>
      }>
        <UnsubscribeForm />
      </Suspense>
    </div>
  );
}
