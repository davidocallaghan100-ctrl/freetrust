'use client'

export default function AgentThinkingIndicator({ size = 26 }: { size?: number }) {
  const dot = Math.max(4, Math.round(size * 0.16))
  const orbit = Math.max(6, Math.round(size * 0.28))

  return (
    <span
      className="agent-thinking-indicator"
      role="status"
      aria-label="FreeTrust Agent is thinking"
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes agent-thinking-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes agent-thinking-pulse {
          0%, 100% { opacity: .32; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-thinking-orbit { animation: none !important; }
          .agent-thinking-dot { animation: none !important; opacity: .82 !important; }
        }
      `}</style>
      <span className="agent-thinking-orbit" style={{ animation: 'agent-thinking-orbit 1.25s linear infinite' }}>
        {[0, 120, 240].map((angle, index) => (
          <span
            key={angle}
            className="agent-thinking-dot"
            style={{
              width: dot,
              height: dot,
              left: `calc(50% - ${dot / 2}px)`,
              top: `calc(50% - ${dot / 2}px)`,
              transform: `rotate(${angle}deg) translateY(-${orbit}px)`,
              animation: `agent-thinking-pulse 1.05s ease-in-out ${index * 0.16}s infinite`,
            }}
          />
        ))}
      </span>
    </span>
  )
}
