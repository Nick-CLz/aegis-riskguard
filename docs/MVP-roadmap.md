# Aegis-RiskGuard — Funded MVP Roadmap

> **Premise:** Aegis-RiskGuard won a hackathon proof-of-concept. This document describes what a funded 6–12 month MVP build looks like — the architecture decisions, market sizing, and engineering milestones for a production-grade 2LoD AI platform.

---

## Market context

| Segment | 2026 Market Size | CAGR | Aegis wedge |
|---|---|---|---|
| GRC software (total) | $23B–$56B | 14–16% | BFSI operational risk sub-function |
| BFSI IT spend (Asia-Pacific) | $180B+ | 11% | 2LoD tech modernisation |
| RegTech (global) | $22B | 22% | AI-native compliance tooling |

**The wedge:** No AI-native player owns 2LoD operational risk. Legacy GRC platforms (ServiceNow GRC, MetricStream, OpenPages) are workflow tools — none do cross-document gap reasoning. The EU AI Act and DORA (in force Jan 2025) create a mandatory upgrade cycle for any bank using AI that touches risk functions.

---

## AI Stack (production)

| Role | Model | Why |
|---|---|---|
| Gap Detector (primary) | **Claude Opus 4.7** | Best-in-class cross-document reasoning; 200K context for full policy + RCSA sets |
| Fast drafts / summaries | **Claude Sonnet 4.6** | 10× cheaper than Opus, same JSON schema compliance |
| PDF/image ingestion | **Google Gemini 2.5 Pro** | Multimodal; handles scanned RCSA tables, policy PDFs with charts |
| Embedding / retrieval | **Voyage Finance** | Domain-tuned finance embeddings for policy vector search |

The v1 hackathon demo uses Gemini 2.5 Flash (free tier compatible).
The MVP switches Claude Opus 4.7 as the primary reasoning engine via `AEGIS_PROVIDER=claude`.

---

## Phase 1 — Document Ingestion (Month 1–2)
**Budget:** ~$50K engineering

- **PDF Policy ingestion** — Gemini multimodal to parse policy PDFs (including scanned pages)
- **XLSX RCSA ingestion** — Parse uploaded spreadsheets, extract control tables, normalize schema
- **Chunking + retrieval** — Vector search over policy corpus so agents can cite specific clauses
- **File upload API** — `/api/upload` endpoint with virus scan, MIME validation, size limit
- **UI: drag-and-drop uploader** — replace synthetic fixtures with real bank documents

Deliverable: analyst uploads real policy PDFs + RCSA Excel → Aegis runs live gap analysis.

---

## Phase 2 — Multi-Agent Pipeline (Month 2–4)
**Budget:** ~$80K engineering

Three new agents, all mediated by Lobster Trap:

| Agent | Input | Output | Model |
|---|---|---|---|
| **Policy Reader** | Policy PDF/YAML | Structured requirement list | Claude Opus 4.7 |
| **RCSA Analyzer** | RCSA Excel + risk register | Normalized control objects | Claude Sonnet 4.6 |
| **Gap Detector** *(exists)* | Requirements + Controls | Gap report | Claude Opus 4.7 |
| **Memo Drafter** | Gaps + regulatory context | Remediation memo draft | Claude Sonnet 4.6 |
| **Compliance Checker** | Memo draft | Policy alignment score | Claude Sonnet 4.6 |

Each agent has:
- Declared intent checked against detected intent (EU AI Act Art. 14)
- Human review queue for uncertain decisions
- HMAC-signed audit trail entry

---

## Phase 3 — GRC Integration (Month 4–6)
**Budget:** ~$60K engineering + $30K integrations

- **ServiceNow GRC connector** — push gaps as incidents; pull control status
- **MetricStream / OpenPages** — bi-directional sync for large banks
- **Jira / Linear** — lightweight issue tracking for smaller teams
- **SFTP/email ingestion** — for banks that can't use API connectors
- **Webhook framework** — notify downstream systems on gap state changes

---

## Phase 4 — Production SaaS (Month 6–12)
**Budget:** ~$150K engineering

- **Multi-tenant architecture** — isolated storage, policy packs, audit logs per bank
- **RBAC** — 2LoD Analyst, 2LoD Manager, Internal Auditor, Read-Only Regulator roles
- **Persistent audit storage** — Postgres with append-only constraints; pg_audit extension
- **Regulator export** — PDF dossier of any decision tree with HMAC-verified audit trail
- **Policy version diffing** — detect when a policy update creates new gaps in existing RCSAs
- **Model risk management** — challenger model, drift monitoring, SR 11-7 alignment
- **i18n** — Thai, Mandarin, Japanese, Arabic (MENA/APAC bank demand)
- **Disaster recovery** — multi-region, RTO < 4h, RPO < 1h (DORA requirement)

---

## Infrastructure (production)

```
                         ┌─────────────────────────────┐
                         │  Next.js frontend (Vercel)   │
                         └──────────────┬───────────────┘
                                        │
                         ┌──────────────▼───────────────┐
                         │  API layer (Railway / Fly.io)  │
                         │  Node 20 + TypeScript          │
                         └──────────────┬───────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
   ┌──────────▼──────────┐  ┌───────────▼──────────┐  ┌──────────▼──────────┐
   │  Lobster Trap engine │  │  Agent orchestrator   │  │  Document store     │
   │  (policy enforcement)│  │  (Claude Opus 4.7)    │  │  (S3 + Postgres)    │
   └──────────────────────┘  └───────────────────────┘  └─────────────────────┘
```

**Monthly infra cost (per bank tenant at scale):**
- Compute (Railway/Fly): ~$200/mo
- Claude API (Opus 4.7 @ 10M tokens/mo): ~$150/mo
- Postgres + S3: ~$50/mo
- Total: **~$400/mo per tenant** → viable at $2,000–$5,000/mo SaaS pricing

---

## Business model

| Tier | Price | Includes |
|---|---|---|
| **Starter** | $2,000/mo | 1 bank entity, 3 users, 5 RCSA analyses/mo, Sonnet model |
| **Professional** | $5,000/mo | 3 entities, 10 users, unlimited analyses, Opus model, GRC connectors |
| **Enterprise** | $15,000+/mo | Multi-entity, unlimited users, custom policy packs, SLA, on-prem option |

**Target customers:** Mid-tier banks (assets $5B–$100B) — too big for manual Excel, too small to build in-house. APAC focus first (Thailand, Singapore, UAE) where DORA-equivalent regulation is accelerating.

**Sales motion:** Sell to CRO (Chief Risk Officer) or Head of Operational Risk. Proof-of-concept in 2 weeks on their own data.

---

## Funding requirement

| Round | Amount | Use |
|---|---|---|
| **Pre-seed** (now) | $500K | 2 engineers × 12mo + compute + legal + first 3 design partners |
| **Seed** (Month 9) | $3M | Sales, 4 more engineers, SOC 2 Type II, first paid customers |

**Design partners needed (3):** One APAC bank with active DORA/PDPA compliance pressure, one DIFC/UAE bank for DFSA alignment, one EU bank for live DORA reporting.

---

## What the hackathon proved

1. The Lobster Trap trust layer **works** — 4/4 adversarial tests blocked in < 1ms, no model call needed
2. Gap detection **produces actionable output** — Gemini 2.5 / Claude Opus both identify real gaps in synthetic data that match what a senior analyst would find
3. The regulatory story is **defensible** — DORA Art. 5–14 + EU AI Act Art. 14 map directly to features, not marketing copy
4. Fallback mode means **demos never break** — critical for sales POC environments

---

*This document is the foundation for a deck. Next step: convert to 8–10 slide pitch with the architecture diagram, market size, and a live demo recording.*
