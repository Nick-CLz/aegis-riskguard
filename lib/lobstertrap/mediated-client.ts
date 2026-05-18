// lib/lobstertrap/mediated-client.ts
//
// Wraps the Gemini SDK such that every prompt is inspected by the Lobster Trap
// engine BEFORE it leaves the process, and every response is inspected as it
// comes back. This is the trust layer the Veea track is meant to reward.
//
// Usage:
//   import { mediatedGenerate } from '@/lib/lobstertrap/mediated-client';
//   const out = await mediatedGenerate({
//     agentId: 'gap_detector',
//     declaredIntent: 'gap_analysis',
//     sessionId,
//     prompt: '...',
//     sourceIsUploadedDocument: false,
//     model: 'reasoning'
//   });

import { GoogleGenerativeAI } from '@google/generative-ai';
import { inspect, recordAudit, type Decision } from './engine';

export interface MediatedCall {
  sessionId: string;
  agentId: string;
  declaredIntent: string;
  prompt: string;
  sourceIsUploadedDocument?: boolean;
  model?: 'reasoning' | 'fast';
  systemInstruction?: string;
}

export interface MediatedResult {
  ok: boolean;
  output?: string;
  inboundDecision?: Decision;
  outboundDecision: Decision;
  blockedReason?: string;
}

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(key);
}

function modelName(t: 'reasoning' | 'fast' = 'reasoning'): string {
  return t === 'fast'
    ? process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash'
    : process.env.GEMINI_MODEL_REASONING || 'gemini-2.5-pro';
}

export async function mediatedGenerate(call: MediatedCall): Promise<MediatedResult> {
  // ---- OUTBOUND inspection ----
  const outboundDecision = inspect({
    sessionId: call.sessionId,
    agentId: call.agentId,
    direction: 'outbound',
    declaredIntent: call.declaredIntent,
    sourceIsUploadedDocument: call.sourceIsUploadedDocument,
    prompt: call.prompt
  });

  recordAudit(
    {
      sessionId: call.sessionId,
      agentId: call.agentId,
      direction: 'outbound',
      declaredIntent: call.declaredIntent,
      sourceIsUploadedDocument: call.sourceIsUploadedDocument,
      prompt: call.prompt
    },
    outboundDecision
  );

  if (outboundDecision.action === 'DENY' || outboundDecision.action === 'HUMAN_REVIEW') {
    return {
      ok: false,
      outboundDecision,
      blockedReason: `${outboundDecision.action}: ${outboundDecision.reason ?? outboundDecision.ruleIdMatched}`
    };
  }

  // Demo offline mode for video/talk fallback
  if (process.env.DEMO_OFFLINE_MODE === 'true') {
    return {
      ok: true,
      output: '[DEMO_OFFLINE_MODE] Canned response — see lib/agents/demo-fixtures.ts',
      outboundDecision
    };
  }

  const promptToSend = outboundDecision.action === 'REDACT_AND_LOG'
    ? outboundDecision.redactedPrompt ?? call.prompt
    : call.prompt;

  // ---- Send to Gemini ----
  let output: string;
  try {
    const ai = getClient();
    const model = ai.getGenerativeModel({
      model: modelName(call.model),
      systemInstruction: call.systemInstruction
    });
    const result = await model.generateContent(promptToSend);
    output = result.response.text();
  } catch (err: any) {
    return {
      ok: false,
      outboundDecision,
      blockedReason: `model_error: ${err.message ?? String(err)}`
    };
  }

  // ---- INBOUND inspection ----
  const inboundDecision = inspect({
    sessionId: call.sessionId,
    agentId: call.agentId,
    direction: 'inbound',
    prompt: output
  });

  recordAudit(
    {
      sessionId: call.sessionId,
      agentId: call.agentId,
      direction: 'inbound',
      prompt: output
    },
    inboundDecision
  );

  if (inboundDecision.action === 'DENY') {
    return {
      ok: false,
      outboundDecision,
      inboundDecision,
      blockedReason: `inbound_blocked: ${inboundDecision.reason}`
    };
  }

  return { ok: true, output, outboundDecision, inboundDecision };
}
