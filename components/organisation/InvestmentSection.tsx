"use client";

import {
  BanknotesIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import type { InvestmentIntent } from "@/types/organisation";

interface Props {
  investmentIntent?: InvestmentIntent | null;
  isOwner: boolean;
}

export default function InvestmentSection({ investmentIntent, isOwner }: Props) {
  const seeking = investmentIntent?.isSeekingInvestment === true;
  const canSeeDetails = isOwner || investmentIntent?.visibility === "public";

  // Nothing to render for non-owners when not seeking
  if (!seeking && !isOwner) return null;

  // Collapsed teaser for owners who haven't enabled it yet
  if (!seeking && isOwner) {
    return (
      <div
        style={{
          background: "rgba(109,40,217,0.06)",
          border: "1px dashed rgba(109,40,217,0.25)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <BanknotesIcon style={{ width: 20, height: 20, color: "#7c3aed", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>
            Enable &quot;Seeking Investment&quot;
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
            Let investors know you&apos;re raising — edit your org profile to set this up.
          </div>
        </div>
      </div>
    );
  }

  const d = investmentIntent?.investmentDetails;
  const vis = investmentIntent?.visibility ?? "private";
  const esg = investmentIntent?.sharedWithESG ?? false;

  return (
    <div
      style={{
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: canSeeDetails && d ? 14 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BanknotesIcon style={{ width: 16, height: 16, color: "#34d399" }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#34d399",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Seeking Investment
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isOwner && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 20,
                padding: "2px 8px",
                background: esg
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(100,116,139,0.15)",
                color: esg ? "#34d399" : "#64748b",
                border: `1px solid ${
                  esg ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.2)"
                }`,
              }}
            >
              {esg ? "🌿 ESG Network" : "ESG: Off"}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 20,
              padding: "2px 8px",
              background:
                vis === "public"
                  ? "rgba(56,189,248,0.1)"
                  : "rgba(100,116,139,0.1)",
              color: vis === "public" ? "#7dd3fc" : "#64748b",
              border: `1px solid ${
                vis === "public"
                  ? "rgba(56,189,248,0.2)"
                  : "rgba(100,116,139,0.2)"
              }`,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {vis === "public" ? (
              <GlobeAltIcon style={{ width: 10, height: 10 }} />
            ) : (
              <LockClosedIcon style={{ width: 10, height: 10 }} />
            )}
            {vis === "public" ? "Public" : "Private"}
          </span>
        </div>
      </div>

      {/* Details (only if visible) */}
      {canSeeDetails && d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.fundingStage && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ChartBarIcon
                style={{ width: 14, height: 14, color: "#475569", flexShrink: 0 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Stage
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                  {d.fundingStage}
                </div>
              </div>
            </div>
          )}

          {d.amountRaising != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BanknotesIcon
                style={{ width: 14, height: 14, color: "#475569", flexShrink: 0 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Raising
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                  {d.currency ?? ""}
                  {d.amountRaising?.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {d.useOfFunds && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Use of Funds
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>
                {d.useOfFunds}
              </div>
            </div>
          )}

          {d.currentTraction && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Traction
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>
                {d.currentTraction}
              </div>
            </div>
          )}

          {d.existingInvestors && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UserGroupIcon
                style={{ width: 14, height: 14, color: "#475569", flexShrink: 0 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Existing Investors
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                  {d.existingInvestors}
                </div>
              </div>
            </div>
          )}

          {d.expectedCloseDate && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDaysIcon
                style={{ width: 14, height: 14, color: "#475569", flexShrink: 0 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Expected Close
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                  {new Date(d.expectedCloseDate).toLocaleDateString("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          )}

          {d.pitchDeckUrl && (
            <a
              href={d.pitchDeckUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#818cf8",
                border: "1px solid rgba(129,140,248,0.3)",
                borderRadius: 8,
                padding: "6px 12px",
                textDecoration: "none",
                alignSelf: "flex-start",
              }}
            >
              <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
              View Pitch Deck
            </a>
          )}
        </div>
      )}

      {/* Private message for non-owners when seeking but private */}
      {!canSeeDetails && !isOwner && seeking && (
        <div
          style={{
            fontSize: 12,
            color: "#475569",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <LockClosedIcon style={{ width: 12, height: 12 }} />
          Investment details are private
        </div>
      )}
    </div>
  );
}
