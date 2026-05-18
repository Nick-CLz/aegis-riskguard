# Aegis-RiskGuard — Architecture

This document covers the system design, agent topology, threat model, and trust boundaries.

> **Audience:** technical judges, future contributors, security reviewers.

---

## 1. Design principles

Five non-negotiables:

1. **Human-in-the-loop is mandatory.** Every state-changing recommendation goes through a review queue. This is EU AI Act Article 14 by design, not by retrofit.
2. **Every LLM call is mediated.** No direct connection between an agent and Gemini exists. Lobster Trap sits in the path of every request and response.
3. **Specialized agents over monolithic prompts.** Even at v1's single-agent scope, the agent has one narrow job and a strict JSON output contract.
4. **Auditability is a feature.** Every prompt, every decision, every approval is logged with an HMAC signature. A regulator should be able to reconstruct any decision.
5. **Synthetic data only.** This repo never touches real customer, employee, or proprietary policy data.

---

## 2. System topology (v1)

```
Browser  →  Next.js Frontend  →  Next.js API routes  →  Gap Detector agent
                                                              │
                                                              ▼
                                                       Lobster Trap engine
                                                       (policies/2lod-financial.yaml)
                                                              │
                                                              ▼
                                                       Gemini 2.5 Pro
```

Everything runs in one Next.js process on one Vultr VM. This is deliberate: hackathon-grade simplicity. The Lobster Trap engine is an in-process TypeScript module that calls Gemini through a thin wrapper (`lib/lobstertrap/mediated-client.ts`).

### Trust boundaries

| Boundary | Untrusted side | Trusted side | Mediator |
|---|---|---|---|
| Browser → API | Browser | Next.js API | Input validation (Zod) |
| API → Agent | API | Agent runtime | Function-call contract |
| Agent → LLM | Agent | Gemini | **Lobster Trap (inspect)** |
| Agent → User | Agent | UI | Decision trail visible in UI |

The third row is the load-bearing one.

---

## 3. The Gap Detector agent

**Job:** Given a list of policy control requirements and a list of RCSA controls, identify gaps.

**Model:** Gemini 2.5 Pro (reasoning)

**Output contract (strict JSON):**

```typescript
{
  gaps: [{
    gapId: string,
    policyRef: string,
    state: 'missing' | 'misaligned' | 'stale' | 'under-resourced',
    severity: 'low' | 'medium' | 'high' | 'critical',
    rationale: string,
    evidence: string
  }],
  coverageScore: number  // 0.0–1.0
}
```

**Why JSON-strict?** A 2LoD agent that returns "I think there might be some issues" is useless. Every gap must be specific, auditable, and machine-readable so it can flow into downstream tooling.

**System instruction** explicitly forbids:
- Inventing policy requirements not in the input
- Naming individuals (only roles)
- Producing fields outside the schema

---

## 4. The Lobster Trap engine

Lives in `lib/lobstertrap/engine.ts`. Two entry points:

- `inspect(input)` — synchronous decision on whether a prompt is allowed
- `recordAudit(input, decision)` — appends a signed entry to the audit log

### Rule evaluation order (first-match-wins)

| Tier | Rules | Purpose |
|---|---|---|
| 1 — Hard denies | `deny_private_keys`, `deny_api_keys_in_outbound`, `deny_classic_injection`, `deny_exfiltration_pattern` | Block obvious attacks |
| 2 — Human review | `review_intent_mismatch`, `review_state_changing_action` | Escalate suspicious-but-not-obvious requests |
| 3 — PII handling | `deny_unredacted_pii_outbound`, `redact_pii_for_rcsa_analyzer` | Block or redact PII per agent context |
| 4 — Rate limiting | `rate_limit_per_session` | Catch runaway loops |
| 5 — Observation | `log_long_context_calls`, `log_response_refusal` | Cost + quality telemetry |
| 6 — Catchall | `default_allow_with_audit` | Allow everything else, but always audit |

### Detectors

Implemented in TypeScript with regex/keyword/Luhn checks:

- `api_key_generic` — OpenAI/Google/AWS/GitHub/Slack token patterns
- `private_key_block` — PEM-style key headers
- `thai_id`, `us_ssn`, `iban`, `credit_card` — PII numbers (credit card uses Luhn)
- `injection_classic` — "ignore previous instructions", "[[SYSTEM]]", developer-mode prompts
- `injection_exfiltration` — "concatenate all previous", "forward to mailto:..."
- `state_changing_action` — "auto-approve", "skip review", "wire transfer", "execute trade"

### Declared-vs-detected intent (the keystone)

Each agent **declares** what it intends to do (`declaredIntent: 'gap_analysis'`). Lobster Trap **independently detects** intent from the prompt content using a heuristic classifier. When they disagree — and the disagreement isn't benign — Lobster Trap routes the call to `HUMAN_REVIEW`.

This catches subverted agents. If your Memo Drafter has been hijacked by injection content, its prompt content will smell like a different intent than what the agent thinks it's doing. The mismatch is the alarm.

### Audit log

Each entry contains:

- `timestamp`, `sessionId`, `agentId`
- `declaredIntent`, `detectedIntent`
- `ruleIdMatched`, `actionTaken`
- `promptHash` (sha256, first 16 hex chars), `promptPreview` (first 200 chars)
- `detectors` (which fired), `logLevel`
- `hmac` (sha256 HMAC of the entry body, signed with `LOBSTERTRAP_AUDIT_HMAC_KEY`)

The full prompt is only kept on `DENY` decisions (so attack content is preserved for investigation). For `ALLOW`, only the hash is retained — defending against the audit log itself becoming a data exfiltration channel.

---

## 5. Threat model

We assume the adversary controls part of the input — most realistically, the contents of a malicious uploaded document.

### Threats considered

| # | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T1 | Prompt injection in policy PDF / RCSA cell | High | High | `deny_classic_injection`; agent system prompts frame content as data, not instructions |
| T2 | Exfiltration of one document's text into output about another | Medium | High | `deny_exfiltration_pattern`; per-document context isolation |
| T3 | PII / synthetic-PII leakage to external API | Medium | Medium | `deny_unredacted_pii_outbound`; redact path for agents that need names |
| T4 | Credential / API-key leakage via document content | Low | Critical | `deny_api_keys_in_outbound`, `deny_private_keys` |
| T5 | Hallucinated control requirement in a recommendation | High | Medium | Strict JSON schema + system prompt forbidding invention; Compliance Checker agent on roadmap |
| T6 | Agent attempts unauthorized state-changing action | Medium | High | `review_state_changing_action`; no tools wired up for writes in v1 |
| T7 | Replay / tampering of audit log | Low | High | HMAC-signed entries; append-only in v1 (in-memory ring) |
| T8 | Compromised LLM provider | Low | Critical | OpenAI-compatible swap path documented; not v1 |

### Explicitly out of scope for v1

- Insider threats (malicious reviewer approving bad outputs)
- DoS against the Vultr VM
- Browser-side compromise (XSS, supply-chain on frontend deps)
- Side-channel attacks on Gemini itself
- Persistent audit storage (v1 uses an in-memory ring of last 500 entries)

These are all real. Listing them honestly is the point.

---

## 6. v2 / roadmap

Things we'd add for a real production deployment:

- **Persistent audit storage** — Postgres with append-only constraints
- **Multi-agent topology** — Policy Reader, RCSA Analyzer, Gap Detector, Memo Drafter, Compliance Checker (the original architecture)
- **PDF/XLSX/image ingestion** — Gemini Pro long-context multimodal
- **Model risk management** — challenger model, drift monitoring, SR 11-7-style validation
- **Real GRC integrations** — ServiceNow GRC, MetricStream, OpenPages
- **Multi-tenant** — per-bank deployment with isolated storage and policy packs
- **RBAC** — reviewers, approvers, auditors with separate permissions
- **i18n** — Thai, Chinese, Japanese policy text support
- **Regulator export** — PDF dossier of any decision, with signed audit trail attached
- **Native Veea Lobster Trap proxy** — swap the inline TS engine for the upstream Go binary as an external sidecar

The v1 codebase is structured so each of these is additive, not a rewrite.

---

## 7. Why we built it this way

The argument for the chosen shape, since judges will ask:

**Why one agent in v1?** Five agents in 12 hours = none of them work well. One agent done well, with the trust layer real, is a better proof of architecture than five demoware stubs.

**Why an inline TS Lobster Trap instead of the upstream Go binary?** Single-process deploy. One VM, one container, no sidecar wiring. The YAML policy is structurally compatible with upstream, so it's a config swap later, not a rewrite.

**Why Gemini 2.5 Pro?** Long context (we'll need it for the v2 PDF ingestion), multimodal for v2 image inputs, and it's the Milan-sponsored model. Flash is wired up for the future Compliance Checker.

**Why Vultr?** Milan AI Olympics sponsor. Single VM is the simplest possible deployment. $6/mo is a fair price for a working public demo URL.

**Why TypeScript everywhere?** One language across UI, API, agent runtime, and trust layer. Easier to audit. Easier to extend.

---

## 8. File map

```
aegis-riskguard/
├── README.md                              ← Front door, judge-facing
├── ARCHITECTURE.md                        ← This file
├── LICENSE                                ← MIT
├── package.json
├── next.config.js / tsconfig.json / tailwind.config.js
├── Dockerfile / docker-compose.yml
├── .env.example
│
├── app/
│   ├── layout.tsx · page.tsx · globals.css
│   └── api/
│       ├── analyze/route.ts               ← POST: run gap detection
│       ├── audit/route.ts                 ← GET: stream audit log
│       ├── redteam/route.ts               ← POST: run adversarial suite
│       └── health/route.ts                ← GET: liveness probe
│
├── lib/
│   ├── lobstertrap/
│   │   ├── engine.ts                      ← inspect(), recordAudit(), detectors
│   │   └── mediated-client.ts             ← Gemini wrapper that goes through inspect()
│   └── agents/
│       ├── gap-detector.ts                ← the v1 agent
│       └── demo-fixtures.ts               ← synthetic policy + RCSA + fallback gaps
│
├── policies/
│   └── 2lod-financial.yaml                ← Source-of-truth policy pack
│
├── scripts/
│   └── redteam.mjs                        ← CLI red-team runner
│
├── deploy/vultr/
│   ├── README.md                          ← Step-by-step deploy guide
│   └── bootstrap.sh                       ← One-shot install
│
├── docs/
│   ├── pitch-deck-outline.md              ← 8-slide deck content
│   ├── demo-video-script.md               ← 3-minute screencap script
│   └── submission-checklist.md            ← lablab.ai submission fields
│
└── tests/red-team/
    └── financial-2lod.json                ← Same suite as scripts/redteam.mjs
```
