'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AGENT_LIST, type AgentConfig } from '@/lib/agents';

const COLORS = {
  bgBase: '#0f172a',
  card: '#1e293b',
  border: 'rgba(56,189,248,0.12)',
  borderStrong: 'rgba(56,189,248,0.4)',
  borderMuted: 'rgba(148,163,184,0.15)',
  sky: '#38bdf8',
  skyHover: '#7dd3fc',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  success: '#34d399',
  danger: '#f87171',
  radius: 14,
};

const AGENT_INPUT_GUIDANCE: Record<string, { placeholder: string; example: string }> = {
  listingCreator: {
    placeholder: 'Describe what you want to sell in one line...',
    example: 'I teach beginner Spanish over Zoom, one-hour lessons, based in Cork',
  },
  matchFinder: {
    placeholder: 'Paste your listing or describe what/who you are looking for...',
    example: 'I need a graphic designer for a startup pitch deck — €500 budget, ready this week',
  },
  messageDrafter: {
    placeholder: 'Context: who you are messaging + what you want to achieve...',
    example: 'Buyer asked for a discount on my €80 logo design. Goal: counter with €70 and a 24h delivery.',
  },
  reputationCoach: {
    placeholder: 'Your current activity and goals...',
    example: 'Balance: ₮450. 3 listings, 0 sales so far. Goal: first sale this month. I freelance in web design.',
  },
  articleDrafter: {
    placeholder: 'Topic + rough outline + who it is for...',
    example: 'Topic: how solo founders use AI agents. Outline: pain → tools → workflow → ROI. For other solo founders.',
  },
  eventPromoter: {
    placeholder: 'Event title, date, location, audience, and any notes...',
    example: 'Cork Community Swap Meet · Sat 15 June 10am-2pm · Triskel Arts Centre · Locals who like sustainable living',
  },
  applicationWriter: {
    placeholder: 'Paste the job listing + a line about your experience...',
    example: 'Job: React developer, €3k budget, 2 weeks. Me: 4 years Next.js, built 3 marketplaces, available immediately.',
  },
  salesDevelopment: {
    placeholder: 'Task + context (e.g. cold_email for X role at Y company)...',
    example: 'Task: cold_email. My offer: Spanish lessons for execs. Prospect: Maria, COO at a Cork SaaS startup.',
  },
  translator: {
    placeholder: 'Source text + source language + target language + type...',
    example: 'Translate "Original handmade ceramic mug, fired in our Kilkenny studio" from English to Spanish (listing)',
  },
};

const SALES_DEV_TASKS: { key: string; label: string; template: string }[] = [
  {
    key: 'icp',
    label: 'ICP',
    template: 'task: icp\n\nmy offer: [describe what you sell in one sentence]\n\ncontext: [who is this for? what market? any existing customer patterns?]',
  },
  {
    key: 'cold_email',
    label: 'Cold email',
    template: 'task: cold_email\n\nmy offer: [one-line description of what you sell]\n\nprospect: [name, role, company]\n\nwhy them: [one specific reason this person is a good fit]',
  },
  {
    key: 'linkedin_message',
    label: 'LinkedIn',
    template: 'task: linkedin_message\n\nmy offer: [one-line description]\n\nprospect: [name, role, company, relevant detail from their profile]\n\ngoal: [connection request / follow-up / warm intro ask]',
  },
  {
    key: 'discovery_questions',
    label: 'Discovery',
    template: 'task: discovery_questions\n\nmy offer: [what you sell]\n\nprospect: [name, role, company]\n\ncall context: [first call / follow-up / demo — what do you need to learn?]',
  },
  {
    key: 'objection_response',
    label: 'Objection',
    template: 'task: objection_response\n\nmy offer: [what you sell]\n\nobjection received: [paste the exact objection they raised]\n\nprospect context: [any relevant detail about them]',
  },
];

const AGENT_GROUPS = {
  'Create & earn': ['listingCreator', 'articleDrafter', 'eventPromoter'],
  'Win work': ['salesDevelopment', 'applicationWriter', 'messageDrafter'],
  'Grow & connect': ['matchFinder', 'reputationCoach', 'translator'],
} as const;

export default function AgentsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [input, setInput] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/credits/balance', { cache: 'no-store' });
      if (res.status === 401) {
        setBalance(null);
        return;
      }
      const data = await res.json();
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  async function runAgent() {
    if (!selectedAgent || !input.trim()) return;

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent.name, input: input.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) throw new Error('You need to sign in to run agents.');
        if (res.status === 402 || data.error === 'insufficient_credits') {
          throw new Error(`Not enough AI Credits. You need ${selectedAgent.creditCost}.`);
        }
        throw new Error(data.error ?? 'Agent run failed.');
      }

      setResult(data.data);
      if (typeof data.newBalance === 'number') setBalance(data.newBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent run failed.');
    } finally {
      setRunning(false);
    }
  }

  function closeModal() {
    setSelectedAgent(null);
    setInput('');
    setResult(null);
    setError(null);
  }

  function useExample() {
    if (!selectedAgent) return;
    const guidance = AGENT_INPUT_GUIDANCE[selectedAgent.name];
    if (guidance) setInput(guidance.example);
  }

  return (
    <div style={{ color: COLORS.text, width: '100%', paddingBottom: 80 }}>
      <style>{`
        .agents-container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
        .agents-hero { text-align: center; padding: 64px 20px 32px; }
        .agents-hero .pretitle { font-size: 11px; letter-spacing: 3px; color: ${COLORS.sky}; font-weight: 500; text-transform: uppercase; margin-bottom: 12px; }
        .agents-hero h1 { font-size: 44px; line-height: 1.05; margin: 12px 0 16px; font-weight: 600; }
        .agents-hero h1 .accent { color: ${COLORS.sky}; }
        .agents-hero p { font-size: 17px; color: ${COLORS.textMuted}; line-height: 1.6; max-width: 600px; margin: 0 auto; }
        .balance-bar { display: flex; justify-content: center; align-items: center; gap: 12px; margin: 28px auto 0; flex-wrap: wrap; }
        .balance-chip { display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px; background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 999px; font-size: 14px; }
        .balance-chip .icon { font-size: 18px; line-height: 1; }
        .balance-chip strong { color: ${COLORS.sky}; font-weight: 600; }
        .topup-link { color: ${COLORS.sky}; text-decoration: none; font-size: 14px; font-weight: 500; }
        .topup-link:hover { color: ${COLORS.skyHover}; }
        .agent-group { padding: 48px 20px 0; }
        .agent-group h2 { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: ${COLORS.textMuted}; font-weight: 500; margin-bottom: 16px; }
        .agent-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .agent-card { text-align: left; background: ${COLORS.card}; border: 1px solid ${COLORS.borderMuted}; border-radius: ${COLORS.radius}px; padding: 18px 16px; cursor: pointer; color: inherit; font: inherit; transition: border-color 0.15s, transform 0.1s; display: flex; flex-direction: column; gap: 8px; min-height: 120px; -webkit-tap-highlight-color: transparent; }
        .agent-card:hover { border-color: ${COLORS.borderStrong}; }
        .agent-card:active { transform: scale(0.98); border-color: ${COLORS.borderStrong}; }
        @media (min-width: 640px) { .agent-card { padding: 20px; } }
        .agent-head { display: flex; align-items: center; justify-content: space-between; }
        .agent-head-left { display: flex; align-items: center; gap: 10px; }
        .agent-icon { font-size: 26px; line-height: 1; }
        .agent-name { font-size: 17px; font-weight: 600; color: ${COLORS.text}; }
        .agent-cost { font-size: 12px; color: ${COLORS.textMuted}; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
        .agent-desc { font-size: 14px; color: ${COLORS.textMuted}; line-height: 1.5; }
        .agent-run-hint { font-size: 12px; color: ${COLORS.sky}; margin-top: 4px; font-weight: 500; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(2,6,23,0.88); display: flex; align-items: flex-end; justify-content: center; padding: 0; z-index: 9999; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        @media (min-width: 640px) { .modal-overlay { align-items: center; padding: 20px; } }
        .modal { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 20px 20px 0 0; padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px)); max-width: 640px; width: 100%; max-height: 92vh; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: slideUp 0.25s ease-out; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0.7; } to { transform: translateY(0); opacity: 1; } }
        @media (min-width: 640px) { .modal { border-radius: 16px; padding: 28px; animation: none; } }
        .modal-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
        .modal-head-left { display: flex; align-items: center; gap: 12px; }
        .modal-icon { font-size: 32px; line-height: 1; }
        .modal-title { font-size: 22px; font-weight: 600; color: ${COLORS.text}; }
        .modal-cost { font-size: 12px; color: ${COLORS.textMuted}; margin-top: 2px; }
        .modal-close { background: rgba(148,163,184,0.1); border: none; color: ${COLORS.textMuted}; font-size: 20px; cursor: pointer; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; line-height: 1; flex-shrink: 0; }
        .modal-close:hover, .modal-close:active { background: rgba(148,163,184,0.2); color: ${COLORS.text}; }
        .modal-desc { font-size: 14px; color: ${COLORS.textMuted}; line-height: 1.5; margin-bottom: 18px; }
        .modal-label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: ${COLORS.textMuted}; margin-bottom: 8px; }
        .modal-example-btn { background: transparent; border: none; color: ${COLORS.sky}; font-size: 12px; cursor: pointer; padding: 0; font-weight: 500; }
        .modal-example-btn:hover { color: ${COLORS.skyHover}; }
        .sales-dev-tasks { margin-bottom: 14px; }
        .sales-dev-tasks-label { font-size: 12px; color: ${COLORS.textMuted}; margin-bottom: 8px; }
        .sales-dev-tasks-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .sales-dev-task-btn { background: rgba(15,23,42,0.7); border: 1px solid ${COLORS.borderMuted}; color: ${COLORS.text}; font-size: 13px; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: border-color 0.15s, background 0.15s; -webkit-tap-highlight-color: transparent; min-height: 36px; }
        .sales-dev-task-btn:hover:not(:disabled), .sales-dev-task-btn:active:not(:disabled) { border-color: ${COLORS.borderStrong}; background: rgba(56,189,248,0.1); }
        .sales-dev-task-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-textarea { width: 100%; min-height: 140px; background: rgba(15,23,42,0.7); border: 1px solid ${COLORS.borderMuted}; border-radius: 10px; padding: 14px; color: ${COLORS.text}; font-size: 16px; font-family: inherit; line-height: 1.5; outline: none; resize: vertical; box-sizing: border-box; -webkit-appearance: none; }
        .modal-textarea:focus { border-color: ${COLORS.sky}; }
        @media (min-width: 640px) { .modal-textarea { min-height: 120px; font-size: 14px; padding: 12px 14px; } }
        .modal-run-btn { display: block; width: 100%; padding: 16px 20px; background: ${COLORS.sky}; color: ${COLORS.bgBase}; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.15s; margin-top: 16px; min-height: 52px; }
        .modal-run-btn:hover:not(:disabled), .modal-run-btn:active:not(:disabled) { background: ${COLORS.skyHover}; }
        .modal-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-error { margin-top: 14px; padding: 12px 14px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 10px; color: ${COLORS.danger}; font-size: 13px; }
        .modal-result { margin-top: 18px; padding: 16px; background: rgba(15,23,42,0.7); border: 1px solid ${COLORS.borderMuted}; border-radius: 10px; }
        .modal-result-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .modal-result-title { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${COLORS.success}; font-weight: 500; }
        .modal-result-copy { background: transparent; border: 1px solid ${COLORS.borderMuted}; color: ${COLORS.textMuted}; font-size: 13px; padding: 8px 14px; border-radius: 8px; cursor: pointer; min-height: 36px; }
        .modal-result-copy:hover, .modal-result-copy:active { border-color: ${COLORS.borderStrong}; color: ${COLORS.text}; }
        .modal-result pre { margin: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 13px; line-height: 1.55; color: ${COLORS.text}; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; max-height: 50vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        @media (min-width: 640px) { .agent-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 960px) { .agent-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 560px) {
          .agents-hero { padding: 48px 20px 24px; }
          .agents-hero h1 { font-size: 32px; }
          .modal-title { font-size: 18px; }
        }
      `}</style>

      <section className="agents-hero">
        <div className="agents-container">
          <div className="pretitle">✦ Your AI team</div>
          <h1>
            Nine agents. <span className="accent">On-demand.</span>
          </h1>
          <p>
            Every agent works on your behalf — writing listings, drafting outreach, translating, matching, coaching. Each run costs a small number of AI Credits.
          </p>
          <div className="balance-bar">
            {balance !== null ? (
              <span className="balance-chip">
                <span className="icon">⚡</span>
                <span>Balance: <strong>{balance.toLocaleString()}</strong> credits</span>
              </span>
            ) : (
              <span className="balance-chip">
                <span className="icon">⚡</span>
                <Link href="/login" className="topup-link">Sign in to see your balance</Link>
              </span>
            )}
            <Link href="/invest" className="topup-link">Top up →</Link>
          </div>
        </div>
      </section>

      <div className="agents-container">
        {Object.entries(AGENT_GROUPS).map(([groupLabel, keys]) => {
          const agents = keys
            .map((k) => AGENT_LIST.find((a) => a.name === k))
            .filter((a): a is AgentConfig => Boolean(a));

          if (agents.length === 0) return null;

          return (
            <div className="agent-group" key={groupLabel}>
              <h2>{groupLabel}</h2>
              <div className="agent-grid">
                {agents.map((agent) => (
                  <button
                    key={agent.name}
                    type="button"
                    className="agent-card"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setInput('');
                      setResult(null);
                      setError(null);
                    }}
                  >
                    <div className="agent-head">
                      <div className="agent-head-left">
                        <span className="agent-icon">{agent.icon}</span>
                        <span className="agent-name">{agent.displayName}</span>
                      </div>
                      <span className="agent-cost">{agent.creditCost} credits</span>
                    </div>
                    <div className="agent-desc">{agent.oneLineDescription}</div>
                    <div className="agent-run-hint">Run agent →</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedAgent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-left">
                <span className="modal-icon">{selectedAgent.icon}</span>
                <div>
                  <div className="modal-title">{selectedAgent.displayName}</div>
                  <div className="modal-cost">Costs {selectedAgent.creditCost} AI Credits per run</div>
                </div>
              </div>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="modal-desc">{selectedAgent.oneLineDescription}</div>

            {selectedAgent?.name === 'salesDevelopment' && (
              <div className="sales-dev-tasks">
                <div className="sales-dev-tasks-label">Pick a task to get started:</div>
                <div className="sales-dev-tasks-row">
                  {SALES_DEV_TASKS.map((task) => (
                    <button
                      key={task.key}
                      type="button"
                      className="sales-dev-task-btn"
                      onClick={() => setInput(task.template)}
                      disabled={running}
                    >
                      {task.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-label">
              <span>What do you want this agent to do?</span>
              {AGENT_INPUT_GUIDANCE[selectedAgent.name] && (
                <button type="button" className="modal-example-btn" onClick={useExample}>Use example</button>
              )}
            </div>
            <textarea
              className="modal-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={AGENT_INPUT_GUIDANCE[selectedAgent.name]?.placeholder ?? 'Describe your task...'}
              disabled={running}
            />

            <button
              type="button"
              className="modal-run-btn"
              onClick={runAgent}
              disabled={running || !input.trim()}
            >
              {running ? 'Running…' : `Run for ${selectedAgent.creditCost} credits`}
            </button>

            {error && <div className="modal-error">{error}</div>}

            {result !== null && (
              <div className="modal-result">
                <div className="modal-result-head">
                  <span className="modal-result-title">Output</span>
                  <button
                    type="button"
                    className="modal-result-copy"
                    onClick={() => {
                      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                      navigator.clipboard?.writeText(text);
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
