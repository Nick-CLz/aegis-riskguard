// lib/agents/gap-detector.ts
//
// Aegis-RiskGuard Gap Detector agent.
//
// Compares a parsed policy document against an RCSA register and identifies
// control gaps — places where the policy *requires* something the RCSA does not
// evidence.
//
// This is the "wow" moment of the demo: cross-document reasoning that would
// take a senior analyst hours, completed in seconds, with every Gemini call
// audited.

import { mediatedGenerate } from '../lobstertrap/mediated-client';

export interface PolicyRequirement {
  id: string;
  section: string;
  text: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface RcsaControl {
  id: string;
  linkedRisk: string;
  description: string;
  owner: string;
  effectiveness: 'effective' | 'partial' | 'ineffective' | 'not_tested';
  lastTested?: string;
}

export interface Gap {
  gapId: string;
  policyRef: string;
  state: 'missing' | 'misaligned' | 'stale' | 'under-resourced';
  severity: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  evidence: string;
}

export interface GapAnalysisResult {
  ok: boolean;
  gaps: Gap[];
  coverageScore: number;
  blockedReason?: string;
  decisionTrail: string[]; // for the UI
}

const SYSTEM_INSTRUCTION = `You are the Gap Detector agent inside Aegis-RiskGuard, a 2nd Line of Defence (2LoD) operational risk system at a regulated bank.

Your one job: compare a list of policy control requirements against a list of RCSA controls, and identify gaps. A "gap" is any case where:
  - the policy requires a control the RCSA does not implement (state=missing)
  - the RCSA implements a control but in a way that does not satisfy the policy (state=misaligned)
  - the control has not been tested within the policy's required frequency (state=stale)
  - the control exists but is rated partial/ineffective (state=under-resourced)

You MUST output strict JSON only — no markdown, no prose, no code fences.

JSON shape:
{
  "gaps": [
    {
      "gapId": "<short slug>",
      "policyRef": "<policy.id>",
      "state": "missing|misaligned|stale|under-resourced",
      "severity": "low|medium|high|critical",
      "rationale": "1-2 sentences explaining the gap",
      "evidence": "what in the RCSA (or its absence) supports this finding"
    }
  ],
  "coverageScore": 0.0
}

The coverageScore is a float 0.0–1.0 representing the fraction of policy requirements covered by at least one effective RCSA control.

DO NOT invent policy requirements not in the input.
DO NOT recommend specific people by name — refer only to roles.
DO NOT include any other field in the JSON.`;

export async function runGapDetector(
  sessionId: string,
  policyReqs: PolicyRequirement[],
  rcsaControls: RcsaControl[]
): Promise<GapAnalysisResult> {
  const decisionTrail: string[] = [];

  const prompt = `POLICY REQUIREMENTS:
${JSON.stringify(policyReqs, null, 2)}

RCSA CONTROLS:
${JSON.stringify(rcsaControls, null, 2)}

Identify all gaps. Respond with strict JSON as specified in your instructions.`;

  decisionTrail.push(`Sending ${policyReqs.length} requirements + ${rcsaControls.length} controls to Gemini Pro via Lobster Trap`);

  const result = await mediatedGenerate({
    sessionId,
    agentId: 'gap_detector',
    declaredIntent: 'gap_analysis',
    prompt,
    sourceIsUploadedDocument: false,
    model: 'reasoning',
    systemInstruction: SYSTEM_INSTRUCTION
  });

  decisionTrail.push(
    `Outbound decision: ${result.outboundDecision.action} (rule: ${result.outboundDecision.ruleIdMatched})`
  );
  if (result.inboundDecision) {
    decisionTrail.push(
      `Inbound decision: ${result.inboundDecision.action} (rule: ${result.inboundDecision.ruleIdMatched})`
    );
  }

  if (!result.ok || !result.output) {
    return {
      ok: false,
      gaps: [],
      coverageScore: 0,
      blockedReason: result.blockedReason,
      decisionTrail
    };
  }

  // Parse model output. Be defensive — strip code fences if the model added them despite instructions.
  let parsed: { gaps: Gap[]; coverageScore: number };
  try {
    const cleaned = result.output
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    decisionTrail.push(`JSON parse failed: ${err.message}`);
    return {
      ok: false,
      gaps: [],
      coverageScore: 0,
      blockedReason: `model_output_not_json`,
      decisionTrail
    };
  }

  // Add stable gapIds if model omitted them
  const gaps = (parsed.gaps ?? []).map((g, i) => ({
    ...g,
    gapId: g.gapId ?? `gap-${i + 1}`
  }));

  decisionTrail.push(`Found ${gaps.length} gaps; coverage = ${parsed.coverageScore?.toFixed(2)}`);

  return {
    ok: true,
    gaps,
    coverageScore: parsed.coverageScore ?? 0,
    decisionTrail
  };
}
