'use client';

import { useState, useEffect, useCallback } from 'react';

type Gap = {
  gapId: string;
  policyRef: string;
  state: 'missing' | 'misaligned' | 'stale' | 'under-resourced';
  severity: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  evidence: string;
};

type AuditEntry = {
  timestamp: string;
  sessionId: string;
  agentId: string;
  declaredIntent?: string;
  detectedIntent?: string;
  ruleIdMatched: string;
  actionTaken: string;
  promptHash: string;
  promptPreview: string;
  detectors: string[];
  logLevel: string;
};

type RedTeamResult = {
  test: { id: string; name: string; description: string; expectedAction: string };
  decision: { action: string; ruleIdMatched: string; reason?: string; detectors: string[] };
  pass: boolean;
};

export default function Home() {
  const [tab, setTab] = useState<'analyze' | 'redteam'>('analyze');
  const [running, setRunning] = useState(false);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [decisionTrail, setDecisionTrail] = useState<string[]>([]);
  const [fallback, setFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string>('');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [redTeam, setRedTeam] = useState<RedTeamResult[]>([]);

  const refreshAudit = useCallback(async () => {
    const r = await fetch('/api/audit').then((x) => x.json());
    setAudit(r.entries);
  }, []);

  useEffect(() => {
    refreshAudit();
    const t = setInterval(refreshAudit, 2000);
    return () => clearInterval(t);
  }, [refreshAudit]);

  async function runAnalyze() {
    setRunning(true);
    setGaps([]);
    setCoverage(null);
    setDecisionTrail([]);
    setFallback(false);
    const r = await fetch('/api/analyze', { method: 'POST' }).then((x) => x.json());
    setGaps(r.gaps ?? []);
    setCoverage(r.coverageScore ?? 0);
    setDecisionTrail(r.decisionTrail ?? []);
    setFallback(!!r.fallback);
    setFallbackReason(r.fallbackReason ?? '');
    setRunning(false);
    refreshAudit();
  }

  async function runRedTeam() {
    setRunning(true);
    setRedTeam([]);
    const r = await fetch('/api/redteam', { method: 'POST' }).then((x) => x.json());
    setRedTeam(r.results ?? []);
    setRunning(false);
    refreshAudit();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            🦞 Aegis-<span className="text-aegis-teal">RiskGuard</span>
          </h1>
          <p className="mt-1 text-sm text-aegis-sand/70">
            2nd Line of Defence operational risk agent · Lobster Trap mediation · synthetic data only
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('analyze')}
            className={tab === 'analyze' ? 'btn' : 'btn-ghost'}
          >
            Gap Analysis
          </button>
          <button
            onClick={() => setTab('redteam')}
            className={tab === 'redteam' ? 'btn' : 'btn-ghost'}
          >
            Red Team
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-5">
          {tab === 'analyze' && (
            <>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Policy vs. RCSA — Gap Detection</h2>
                    <p className="text-sm text-aegis-sand/60">
                      5 synthetic policy requirements · 4 synthetic RCSA controls · Gemini Pro via Lobster Trap
                    </p>
                  </div>
                  <button className="btn" onClick={runAnalyze} disabled={running}>
                    {running ? 'Running…' : 'Run Analysis'}
                  </button>
                </div>
                {fallback && (
                  <div className="mt-3 rounded border border-aegis-warn/40 bg-aegis-warn/10 p-3 text-sm">
                    ⚠️ Running in offline fallback mode — {fallbackReason}. Showing pre-computed
                    gaps so the demo never breaks.
                  </div>
                )}
                {coverage !== null && (
                  <div className="mt-4 rounded bg-aegis-midnight/60 p-3">
                    <div className="text-xs uppercase tracking-wider text-aegis-sand/60">
                      Policy coverage score
                    </div>
                    <div className="text-3xl font-semibold">
                      {(coverage * 100).toFixed(0)}%
                      <span className="ml-3 text-sm text-aegis-sand/60">
                        ({gaps.length} gaps detected)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {gaps.length > 0 && (
                <div className="space-y-3">
                  {gaps.map((g) => (
                    <div key={g.gapId} className="card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="pill bg-aegis-teal/20 text-aegis-teal">
                            {g.policyRef}
                          </span>
                          <span className={`pill tag-${g.severity}`}>{g.severity}</span>
                          <span className="pill bg-aegis-navy text-aegis-sand/70">{g.state}</span>
                        </div>
                        <span className="text-xs text-aegis-sand/40 font-mono">{g.gapId}</span>
                      </div>
                      <p className="mt-3 text-sm">{g.rationale}</p>
                      <p className="mt-2 text-xs text-aegis-sand/60">
                        <span className="text-aegis-sand/40">Evidence:</span> {g.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {decisionTrail.length > 0 && (
                <div className="card">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-aegis-sand/60">
                    Decision trail
                  </h3>
                  <ol className="space-y-1 text-xs font-mono">
                    {decisionTrail.map((d, i) => (
                      <li key={i} className="text-aegis-sand/70">
                        {i + 1}. {d}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}

          {tab === 'redteam' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Adversarial Test Suite</h2>
                    <p className="text-sm text-aegis-sand/60">
                      4 synthetic attacks · expected Lobster Trap responses
                    </p>
                  </div>
                  <button className="btn" onClick={runRedTeam} disabled={running}>
                    {running ? 'Running…' : 'Run Red Team'}
                  </button>
                </div>
              </div>
              {redTeam.map((r) => (
                <div key={r.test.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="pill bg-aegis-teal/20 text-aegis-teal mr-2">{r.test.id}</span>
                      <span className="text-sm font-semibold">{r.test.name}</span>
                    </div>
                    <span
                      className={`pill ${r.pass ? 'tag-low' : 'tag-critical'}`}
                    >
                      {r.pass ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-aegis-sand/60">{r.test.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-aegis-sand/40 uppercase">Expected</div>
                      <div className="font-mono">{r.test.expectedAction}</div>
                    </div>
                    <div>
                      <div className="text-aegis-sand/40 uppercase">Actual</div>
                      <div className="font-mono">
                        {r.decision.action} · {r.decision.ruleIdMatched}
                      </div>
                    </div>
                  </div>
                  {r.decision.reason && (
                    <p className="mt-2 text-xs text-aegis-sand/60">
                      <span className="text-aegis-sand/40">Reason:</span> {r.decision.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card lg:row-start-1 lg:col-start-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-aegis-sand/60">
              🦞 Lobster Trap audit log
            </h2>
            <span className="pill bg-aegis-navy text-aegis-sand/60">live</span>
          </div>
          <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
            {audit.length === 0 && (
              <div className="text-xs text-aegis-sand/40">No entries yet. Run an analysis or red team.</div>
            )}
            {audit.map((e, i) => (
              <div
                key={i}
                className={`rounded border p-2 text-xs ${
                  e.actionTaken === 'DENY'
                    ? 'border-aegis-alert/40 bg-aegis-alert/10'
                    : e.actionTaken === 'HUMAN_REVIEW'
                    ? 'border-aegis-warn/40 bg-aegis-warn/10'
                    : 'border-aegis-navy bg-aegis-midnight/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-aegis-sand/50">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`pill ${
                      e.actionTaken === 'DENY'
                        ? 'tag-critical'
                        : e.actionTaken === 'HUMAN_REVIEW'
                        ? 'tag-high'
                        : 'tag-low'
                    }`}
                  >
                    {e.actionTaken}
                  </span>
                </div>
                <div className="mt-1 font-mono text-aegis-sand/70">
                  {e.agentId} · {e.ruleIdMatched}
                </div>
                {e.detectors.length > 0 && (
                  <div className="mt-1 text-aegis-sand/50">detectors: {e.detectors.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="mt-10 text-xs text-aegis-sand/40 border-t border-aegis-navy pt-4">
        MIT licensed · Synthetic data only · Built for Milan AI Week 2026 · Inspired by{' '}
        <a href="https://github.com/veea/lobstertrap" className="underline">
          Veea Lobster Trap
        </a>
      </footer>
    </main>
  );
}
