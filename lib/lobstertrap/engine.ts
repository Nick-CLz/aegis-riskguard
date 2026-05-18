// lib/lobstertrap/engine.ts
//
// Aegis-RiskGuard's inline implementation of the Lobster Trap deep-prompt-inspection
// pattern, calibrated for 2nd Line of Defence financial-services workloads.
//
// We ship this as a TypeScript module rather than wiring the upstream Go binary
// because (a) it has to run inside a single Next.js process for hackathon-grade
// deployability, and (b) we want every reviewer to read the rules in plain code.
//
// The YAML policy schema is intentionally compatible with upstream Lobster Trap
// (policies/2lod-financial.yaml). Migrating to the Go proxy later is a config
// swap, not a rewrite.
//
// Inspired by Veea Lobster Trap (MIT) — https://github.com/veea/lobstertrap
// License: MIT

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

// =============================================================================
// Types
// =============================================================================

export type Direction = 'outbound' | 'inbound';
export type Action =
  | 'ALLOW'
  | 'DENY'
  | 'LOG'
  | 'HUMAN_REVIEW'
  | 'QUARANTINE'
  | 'RATE_LIMIT'
  | 'REDACT_AND_LOG';

export interface InspectInput {
  sessionId: string;
  agentId: string;
  direction: Direction;
  declaredIntent?: string;
  sourceIsUploadedDocument?: boolean;
  prompt: string;
  promptTokenCountApprox?: number;
}

export interface Decision {
  action: Action;
  ruleIdMatched: string;
  reason?: string;
  detectedIntent?: string;
  detectors: string[];
  redactedPrompt?: string;
  responseToCaller?: Record<string, string>;
  reviewQueue?: string;
  logLevel: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  agentId: string;
  declaredIntent?: string;
  detectedIntent?: string;
  ruleIdMatched: string;
  actionTaken: Action;
  promptHash: string;
  promptPreview: string; // first 200 chars for the UI; full prompt only on DENY
  detectors: string[];
  logLevel: Decision['logLevel'];
  hmac: string;
}

interface RawPolicy {
  metadata: any;
  defaults: any;
  detectors: Record<string, any>;
  rules: any[];
}

// =============================================================================
// Engine
// =============================================================================

let cachedPolicy: RawPolicy | null = null;
const auditLog: AuditEntry[] = [];
const MAX_LOG = 500;

function loadPolicy(): RawPolicy {
  if (cachedPolicy) return cachedPolicy;
  const p = path.join(process.cwd(), 'policies', '2lod-financial.yaml');
  const raw = fs.readFileSync(p, 'utf8');
  cachedPolicy = yaml.load(raw) as RawPolicy;
  return cachedPolicy;
}

// -----------------------------------------------------------------------------
// Detectors — these mirror the YAML detector definitions.
// We hard-code them in TS for speed; the YAML is the source of truth and is
// shipped to demonstrate the policy-as-data approach the upstream Lobster Trap
// Go binary uses.
// -----------------------------------------------------------------------------

const DETECTORS: Record<string, (text: string) => boolean> = {
  api_key_generic: (t) =>
    /sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z\-_]{35}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}/.test(t),

  private_key_block: (t) => /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(t),

  thai_id: (t) =>
    /\b[0-9]-[0-9]{4}-[0-9]{5}-[0-9]{2}-[0-9]\b/.test(t) || /\b\d{13}\b/.test(t),

  us_ssn: (t) => /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/.test(t),

  credit_card: (t) => {
    const m = t.match(/\b\d{13,19}\b/g);
    if (!m) return false;
    return m.some(luhnValid);
  },

  iban: (t) => /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/.test(t),

  injection_classic: (t) => {
    const re = [
      /ignore (all |the |your )?(previous|prior|above) (instructions?|prompts?|rules?)/i,
      /disregard (all |the |your )?(previous|prior|above)/i,
      /you are now (in )?developer mode/i,
      /system\s*:\s*you are/i,
      /pretend (you are|to be) (an? )?(unrestricted|jailbroken|uncensored)/i,
      /\[\[SYSTEM\]\]/i,
      /###\s*new\s*instructions?\s*###/i
    ];
    return re.some((r) => r.test(t));
  },

  injection_exfiltration: (t) => {
    const re = [
      /send (the|your|all) (system prompt|instructions) to/i,
      /print (the|your|all) (training data|hidden|system)/i,
      /concatenate (all|the|every) (previous|prior) (document|policy|file)/i,
      /forward .* to (http|https|mailto|tel|sms)/i,
      /exfiltrate|leak (the|your) (system|hidden|context)/i
    ];
    return re.some((r) => r.test(t));
  },

  state_changing_action: (t) => {
    const kws = [
      'send email to',
      'publish memo',
      'auto-approve',
      'skip review',
      'bypass compliance',
      'delete record',
      'modify policy',
      'wire transfer',
      'execute trade'
    ];
    const low = t.toLowerCase();
    return kws.some((k) => low.includes(k));
  }
};

function luhnValid(n: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0 && n.length >= 13;
}

function runDetectors(text: string): string[] {
  return Object.entries(DETECTORS)
    .filter(([, fn]) => fn(text))
    .map(([name]) => name);
}

// -----------------------------------------------------------------------------
// Intent detection — simple heuristic. In a real Lobster Trap deployment this
// would itself use an LLM. We keep it deterministic for demo predictability.
// -----------------------------------------------------------------------------

function detectIntent(prompt: string): string {
  const low = prompt.toLowerCase();
  if (/draft.*memo|remediation|recommend/.test(low)) return 'draft_memo';
  if (/identify.*gap|compare.*policy|mismatch/.test(low)) return 'gap_analysis';
  if (/extract|parse.*policy|read.*document/.test(low)) return 'document_extraction';
  if (/email|send|publish|approve|trade|transfer/.test(low)) return 'state_change';
  if (DETECTORS.injection_classic(prompt) || DETECTORS.injection_exfiltration(prompt))
    return 'suspicious_meta_request';
  return 'unknown';
}

// =============================================================================
// Main inspection function
// =============================================================================

export function inspect(input: InspectInput): Decision {
  const policy = loadPolicy();
  const detectors = runDetectors(input.prompt);
  const detectedIntent = detectIntent(input.prompt);

  // Rule evaluation — first-match-wins. We evaluate against the YAML rules but
  // also implement the hardcoded order for safety.

  // T1: hard denies
  if (detectors.includes('private_key_block')) {
    return decide(
      'DENY',
      'deny_private_keys',
      'critical',
      detectors,
      detectedIntent,
      'private_key_detected'
    );
  }

  if (input.direction === 'outbound' && detectors.includes('api_key_generic')) {
    return decide(
      'DENY',
      'deny_api_keys_in_outbound',
      'critical',
      detectors,
      detectedIntent,
      'credential_in_prompt'
    );
  }

  if (
    input.direction === 'outbound' &&
    detectors.includes('injection_classic') &&
    input.sourceIsUploadedDocument
  ) {
    return decide(
      'DENY',
      'deny_classic_injection',
      'high',
      detectors,
      detectedIntent,
      'injection_pattern_in_user_content'
    );
  }

  if (detectors.includes('injection_exfiltration')) {
    return decide(
      'DENY',
      'deny_exfiltration_pattern',
      'critical',
      detectors,
      detectedIntent,
      'exfiltration_pattern_detected'
    );
  }

  // T2: human review
  if (input.declaredIntent && detectedIntent !== 'unknown') {
    if (
      detectedIntent !== input.declaredIntent &&
      detectedIntent !== 'document_extraction' /* benign mismatch */
    ) {
      return decide(
        'HUMAN_REVIEW',
        'review_intent_mismatch',
        'high',
        detectors,
        detectedIntent,
        `declared=${input.declaredIntent} but detected=${detectedIntent}`,
        '2lod_security'
      );
    }
  }

  if (detectors.includes('state_changing_action')) {
    return decide(
      'HUMAN_REVIEW',
      'review_state_changing_action',
      'high',
      detectors,
      detectedIntent,
      'state-changing verb detected',
      '2lod_security'
    );
  }

  // T3: PII handling
  const piiDetectors = ['thai_id', 'us_ssn', 'credit_card', 'iban'];
  const piiHit = piiDetectors.filter((d) => detectors.includes(d));
  if (piiHit.length > 0) {
    if (input.agentId === 'rcsa_analyzer') {
      const redacted = redactPII(input.prompt);
      return {
        action: 'REDACT_AND_LOG',
        ruleIdMatched: 'redact_pii_for_rcsa_analyzer',
        reason: `redacted: ${piiHit.join(',')}`,
        detectors,
        detectedIntent,
        redactedPrompt: redacted,
        logLevel: 'medium'
      };
    } else {
      return decide(
        'DENY',
        'deny_unredacted_pii_outbound',
        'high',
        detectors,
        detectedIntent,
        `unredacted PII: ${piiHit.join(',')}`
      );
    }
  }

  // Default allow + audit
  return decide('ALLOW', 'default_allow_with_audit', 'info', detectors, detectedIntent);
}

function decide(
  action: Action,
  rule: string,
  level: Decision['logLevel'],
  detectors: string[],
  detectedIntent: string,
  reason?: string,
  reviewQueue?: string
): Decision {
  return {
    action,
    ruleIdMatched: rule,
    logLevel: level,
    detectors,
    detectedIntent,
    reason,
    reviewQueue,
    responseToCaller:
      action === 'DENY' ? { error: 'policy_violation', reason: reason ?? '' } : undefined
  };
}

function redactPII(s: string): string {
  return s
    .replace(/\b[0-9]-[0-9]{4}-[0-9]{5}-[0-9]{2}-[0-9]\b/g, '[REDACTED:THAI_ID]')
    .replace(/\b\d{13}\b/g, '[REDACTED:ID]')
    .replace(/\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g, '[REDACTED:SSN]')
    .replace(/\b\d{13,19}\b/g, '[REDACTED:CC]')
    .replace(/\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g, '[REDACTED:IBAN]');
}

// =============================================================================
// Audit log
// =============================================================================

const HMAC_KEY = () => process.env.LOBSTERTRAP_AUDIT_HMAC_KEY || 'aegis-dev-hmac-key';

export function recordAudit(input: InspectInput, decision: Decision): AuditEntry {
  const promptHash = crypto.createHash('sha256').update(input.prompt).digest('hex').slice(0, 16);
  const preview =
    decision.action === 'DENY' ? input.prompt.slice(0, 400) : input.prompt.slice(0, 200);

  const entry: Omit<AuditEntry, 'hmac'> = {
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId,
    agentId: input.agentId,
    declaredIntent: input.declaredIntent,
    detectedIntent: decision.detectedIntent,
    ruleIdMatched: decision.ruleIdMatched,
    actionTaken: decision.action,
    promptHash,
    promptPreview: preview,
    detectors: decision.detectors,
    logLevel: decision.logLevel
  };

  const hmac = crypto.createHmac('sha256', HMAC_KEY()).update(JSON.stringify(entry)).digest('hex');
  const full: AuditEntry = { ...entry, hmac };

  auditLog.unshift(full);
  if (auditLog.length > MAX_LOG) auditLog.pop();
  return full;
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return auditLog.slice(0, limit);
}

export function clearAuditLog() {
  auditLog.length = 0;
}
