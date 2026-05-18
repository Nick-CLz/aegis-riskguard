# lablab.ai Submission Checklist — AI Agent Olympics (Milan)

## Critical deadlines

- **On-site deadline:** May 19 (Tuesday) 5:00 PM Milan (CEST/UTC+2) = **10:00 PM Bangkok**
- **Online deadline:** Likely end of May 19 in some timezone. **Verify in the lablab Discord tonight.** Don't assume.

> **DO THIS FIRST:** Join the lablab Discord (`https://discord.gg/lablab-ai`) and ask in the #milan-ai-week channel: *"For online-only submissions, what is the exact submission cutoff in UTC?"* Get a moderator reply in writing before you commit to a schedule.

## Submission form fields (per lablab.ai standard form)

### 📋 Basic Information

- [ ] **Project Title:** `Aegis-RiskGuard`
- [ ] **Short Description (≤200 chars):**
      > "An autonomous 2LoD operational risk agent for regulated banks. Compares policies against RCSA registers, detects control gaps, with every Gemini call inspected by a deep-prompt-inspection firewall."
- [ ] **Long Description:** Copy from `README.md` "The problem" + "What's in v1" sections.
- [ ] **Tags:**
      `gemini-2.5-pro`, `gemini`, `vultr`, `nextjs`, `typescript`, `enterprise-utility`, `agentic-workflows`, `intelligent-reasoning`, `2lod`, `governance-risk-compliance`, `dora`, `eu-ai-act`, `prompt-injection`, `ai-safety`

### 📸 Cover Image and Presentation

- [x] **Cover Image:** [`docs/cover-1200x630.png`](./cover-1200x630.png) — 1200x630, lobster mark + tagline, ready to upload to lablab.
- [ ] **Video Presentation:** YouTube unlisted URL of the 3-min demo video (record per [`docs/demo-video-script.md`](./demo-video-script.md); needs a real recording, not generated here).
- [x] **Slide Presentation:** [`docs/Aegis-RiskGuard-deck.pdf`](./Aegis-RiskGuard-deck.pdf) + editable [`docs/Aegis-RiskGuard-deck.pptx`](./Aegis-RiskGuard-deck.pptx) (8 slides, built from `pitch-deck-outline.md`).

### 💻 App Hosting & Code Repository

- [x] **Public GitHub Repository:** `https://github.com/Nick-CLz/aegis-riskguard`
- [ ] **Demo Application Platform:** Vultr
- [ ] **Application URL:** `http://[your-vultr-ip]/` (or `https://your-domain.com` if you set one up)

## Judging criteria — how to position each one

The four lablab criteria are equally weighted. For each, here's the one line to land in your description/video:

| Criterion | Your strongest claim |
|---|---|
| **Application of Technology** | "Gemini 2.5 Pro mediated by a custom Lobster Trap firewall — not a wrapper, a structurally compatible re-implementation with a domain-tuned YAML policy pack." |
| **Presentation** | The 3-minute demo video + 8-slide deck. Red-team tab on screen at the 1:35 mark. |
| **Business Value** | "GRC software is a $23B–$56B market in 2026 (Mordor Intelligence); BFSI is the biggest vertical; 2LoD is its most labour-intensive sub-function. No AI-native player owns this wedge yet." |
| **Originality** | "The first AI agent for 2LoD risk to implement EU AI Act Article 14 human-oversight as a declared-vs-detected intent firewall, not as a UX afterthought." |

## Pre-submission verification

Run through this before clicking Submit:

- [ ] GitHub repo is **public** (not private — judges can't see private repos)
- [ ] `LICENSE` file is at the repo root with MIT text
- [ ] `README.md` is at the repo root and renders correctly (preview on GitHub)
- [ ] `npm install && npm run dev` works on a fresh clone (test on a clean folder)
- [ ] `http://[your-vultr-ip]/api/health` returns `{"ok": true}`
- [ ] `http://[your-vultr-ip]/` loads the UI
- [ ] Clicking **Run Analysis** produces gaps (live or fallback — either is fine)
- [ ] Clicking **Run Red Team** produces 4 results, ideally all `✓ PASS` (verified offline via `npm run redteam:offline` — 4/4 pass)
- [ ] YouTube video URL works in an incognito window
- [ ] PDF of the deck opens and renders
- [ ] Synthetic-data disclaimer is visible in README

## After submission

- [ ] Post on LinkedIn with `#MilanAIWeek #lablab` tags (optional but helps if there's a community-vote sub-prize)
- [ ] Drop the demo URL in the lablab Discord #showcase channel
- [ ] Screenshot your submission confirmation
- [ ] Sleep

## Things that will get you disqualified — DO NOT do these

- ❌ Don't submit a private repo
- ❌ Don't ship without an MIT (or other permissive open-source) LICENSE file
- ❌ Don't include any real bank data, customer data, or proprietary policy text
- ❌ Don't reuse code from a prior commercial project without clearly attributing
- ❌ Don't claim Veea is a sponsor of *this* hackathon. (Lobster Trap is an inspiration; you're using their MIT-licensed pattern, not their sponsorship.)
- ❌ Don't submit and then push a major rewrite — judges may evaluate the commit you submitted, not HEAD

## After Wednesday's awards

Regardless of outcome:

- [ ] Snapshot the Vultr VM in case you want to continue the project
- [ ] If you don't continue, **destroy the VM** to stop the $6/mo charge
- [ ] Post-mortem in your notes: what worked, what didn't, what you'd change
- [ ] Add to your portfolio for the Q3 DORA-aligned hackathon — this is the foundation for that next build
