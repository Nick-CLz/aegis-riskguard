// lib/agents/demo-fixtures.ts
//
// Synthetic data for demo. NOT real bank policies. All names, IDs, amounts
// fictional. Used for the live demo video so we don't have to load real PDFs
// during the recording.

import type { PolicyRequirement, RcsaControl } from './gap-detector';

export const DEMO_POLICY: PolicyRequirement[] = [
  {
    id: 'OR-3.1',
    section: 'Operational Risk Policy §3.1',
    text: 'Each business unit shall perform an RCSA at least annually.',
    criticality: 'high'
  },
  {
    id: 'OR-4.2',
    section: 'Operational Risk Policy §4.2',
    text: 'Key controls over payment systems shall be tested quarterly by an independent function.',
    criticality: 'critical'
  },
  {
    id: 'OR-5.1',
    section: 'Operational Risk Policy §5.1',
    text: 'All loss events above THB 500,000 shall be reported to the 2LoD function within 5 business days.',
    criticality: 'critical'
  },
  {
    id: 'OR-6.3',
    section: 'Operational Risk Policy §6.3',
    text: 'A KRI dashboard shall be maintained for top operational risks and reviewed monthly by management.',
    criticality: 'medium'
  },
  {
    id: 'OR-7.2',
    section: 'Operational Risk Policy §7.2',
    text: 'Third-party risk assessments shall be refreshed at least every 12 months.',
    criticality: 'high'
  }
];

export const DEMO_RCSA: RcsaControl[] = [
  {
    id: 'PMT-01',
    linkedRisk: 'Payment processing failure',
    description: 'Daily reconciliation of payment batches by Operations team',
    owner: 'Head of Payment Ops',
    effectiveness: 'effective',
    lastTested: '2026-04-10'
  },
  {
    id: 'PMT-02',
    linkedRisk: 'Payment processing failure',
    description: 'Independent quarterly testing of payment controls',
    owner: 'Internal Audit',
    effectiveness: 'partial',
    lastTested: '2025-09-30' // overdue
  },
  {
    id: 'LOSS-01',
    linkedRisk: 'Loss event under-reporting',
    description: 'Manual email-based loss event reporting',
    owner: 'Department heads',
    effectiveness: 'partial'
  },
  {
    id: 'TPR-01',
    linkedRisk: 'Third-party risk',
    description: 'Vendor risk reviews on initial onboarding',
    owner: 'Procurement',
    effectiveness: 'effective',
    lastTested: '2024-11-15' // way overdue if policy says 12 months
  }
  // Note: there is NO KRI dashboard control — that's a "missing" gap
  // Note: there is NO annual RCSA process control — that's a "missing" gap
];

export const DEMO_GAPS_FALLBACK = {
  gaps: [
    {
      gapId: 'gap-1',
      policyRef: 'OR-3.1',
      state: 'missing' as const,
      severity: 'high' as const,
      rationale: 'No control in the RCSA evidences the annual RCSA process itself. The policy requires it; no control owner is identified.',
      evidence: 'No matching control in submitted RCSA register.'
    },
    {
      gapId: 'gap-2',
      policyRef: 'OR-4.2',
      state: 'stale' as const,
      severity: 'critical' as const,
      rationale: 'PMT-02 was last tested 2025-09-30 — outside the quarterly cadence required by §4.2 (most recent test should be within the last 3 months).',
      evidence: 'PMT-02.lastTested = 2025-09-30; current date 2026-05.'
    },
    {
      gapId: 'gap-3',
      policyRef: 'OR-5.1',
      state: 'under-resourced' as const,
      severity: 'high' as const,
      rationale: 'Loss event reporting is manual email-based with partial effectiveness; this is unlikely to meet the 5-business-day SLA reliably.',
      evidence: 'LOSS-01.effectiveness = partial; mechanism = manual email.'
    },
    {
      gapId: 'gap-4',
      policyRef: 'OR-6.3',
      state: 'missing' as const,
      severity: 'medium' as const,
      rationale: 'No KRI dashboard control is present in the RCSA register.',
      evidence: 'No matching control.'
    },
    {
      gapId: 'gap-5',
      policyRef: 'OR-7.2',
      state: 'stale' as const,
      severity: 'high' as const,
      rationale: 'TPR-01 was last tested 2024-11-15 — more than 12 months ago, violating §7.2.',
      evidence: 'TPR-01.lastTested = 2024-11-15; required cadence = 12 months.'
    }
  ],
  coverageScore: 0.2
};

export const DEMO_MEMO_FALLBACK = `# 2LoD Remediation Memo

**To:** Head of Payment Ops, Internal Audit, Department Heads, Procurement
**From:** 2LoD Operational Risk
**Date:** ${new Date().toISOString().split('T')[0]}
**Subject:** Required Remediation for Identified Control Gaps

This memo outlines the critical and high-severity control gaps identified during the recent Gap Analysis between the Operational Risk Policy and the submitted RCSA register.

## Executive Summary
The analysis identified **5 gaps**, resulting in a policy coverage score of **20%**. Immediate remediation is required for the critical and high severity findings to ensure alignment with DORA and internal governance standards.

## Critical Findings
- **PMT-02 (Payment controls testing):** The control is stale. It was last tested on 2025-09-30, violating the quarterly testing cadence required by policy OR-4.2. **Action Required:** Internal audit must perform an immediate test of payment controls.

## High Findings
- **Missing RCSA Process Control:** There is no control evidencing the annual RCSA process itself (OR-3.1). **Action Required:** Establish and document a control for the annual RCSA execution.
- **LOSS-01 (Loss event reporting):** Manual email-based reporting is deemed under-resourced and unlikely to meet the 5-business-day SLA (OR-5.1). **Action Required:** Implement an automated workflow for loss event reporting.
- **TPR-01 (Third-party risk):** The vendor risk review control is stale, last tested on 2024-11-15 (violating the 12-month refresh cycle per OR-7.2). **Action Required:** Refresh all third-party risk assessments immediately.

## Medium Findings
- **Missing KRI Dashboard:** No KRI dashboard control is present in the RCSA register (OR-6.3). **Action Required:** Develop and implement a KRI dashboard for top operational risks.

Please submit a remediation plan for the critical and high findings within 5 business days.`;

