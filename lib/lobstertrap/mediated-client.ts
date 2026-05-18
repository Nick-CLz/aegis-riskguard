// lib/lobstertrap/mediated-client.ts
//
// Every AI call is mediated here: Lobster Trap inspects outbound prompts and
// inbound responses. No agent speaks directly to any model.
//
// Providers:
//   gemini  — Google Gemini 2.5 Flash/Pro (default; free-tier compatible)
//   claude  — Anthropic Claude Opus 4.7 / Sonnet 4.6 (premium reasoning)
//
// Set AEGIS_PROVIDER=claude in .env (and add ANTHROPIC_API_KEY) to switch.
// Falls back to gemini if ANTHROPIC_API_KEY is absent.

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { inspect, recordAudit, type Decision } from './engine';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  provider?: string;
  modelUsed?: string;
  inboundDecision?: Decision;
  outboundDecision: Decision;
  blockedReason?: string;
}

// ─── Provider resolution ──────────────────────────────────────────────────────

type Provider = 'gemini' | 'claude';

function activeProvider(): Provider {
  if (
    (process.env.AEGIS_PROVIDER ?? '').toLowerCase() === 'claude' &&
    process.env.ANTHROPIC_API_KEY
  ) return 'claude';
  return 'gemini';
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(key);
}

function geminiModelName(t: 'reasoning' | 'fast' = 'reasoning'): string {
  return t === 'fast'
    ? (process.env.GEMINI_MODEL_FAST    || 'gemini-2.5-flash')
    : (process.env.GEMINI_MODEL_REASONING || 'gemini-2.5-flash');
}

function parseRetryDelay(msg: string): number {
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  return m ? parseFloat(m[1]) * 1000 : 0;
}

async function generateWithRetry(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>,
  prompt: string,
  maxRetries = 2
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      const is429 = String(err?.message ?? '').includes('429');
      if (is429 && attempt < maxRetries) {
        const delay = parseRetryDelay(err.message) || Math.pow(2, attempt) * 6000;
        await new Promise(r => setTimeout(r, Math.min(delay, 60000)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('max_retries_exceeded');
}

async function geminiGenerate(call: MediatedCall, prompt: string): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient();
  const modelId = geminiModelName(call.model);
  const model = ai.getGenerativeModel({ model: modelId, systemInstruction: call.systemInstruction });
  const text = await generateWithRetry(model, prompt);
  return { text, model: modelId };
}

// ─── Claude ───────────────────────────────────────────────────────────────────

function getAnthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: key });
}

function claudeModelName(t: 'reasoning' | 'fast' = 'reasoning'): string {
  return t === 'fast'
    ? (process.env.CLAUDE_MODEL_FAST      || 'claude-sonnet-4-6')
    : (process.env.CLAUDE_MODEL_REASONING || 'claude-opus-4-7');
}

async function claudeGenerate(call: MediatedCall, prompt: string): Promise<{ text: string; model: string }> {
  const client = getAnthropicClient();
  const modelId = claudeModelName(call.model);

  const msg = await client.messages.create({
    model: modelId,
    max_tokens: 8096,
    ...(call.systemInstruction ? { system: call.systemInstruction } : {}),
    messages: [{ role: 'user', content: prompt }],
  });

  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('unexpected_claude_content_type');
  return { text: block.text, model: modelId };
}

// ─── Unified generate ─────────────────────────────────────────────────────────

async function callProvider(call: MediatedCall, prompt: string): Promise<{ text: string; provider: Provider; model: string }> {
  const provider = activeProvider();
  if (provider === 'claude') {
    const result = await claudeGenerate(call, prompt);
    return { ...result, provider: 'claude' };
  }
  const result = await geminiGenerate(call, prompt);
  return { ...result, provider: 'gemini' };
}

// ─── Main mediated entrypoint ─────────────────────────────────────────────────

export async function mediatedGenerate(call: MediatedCall): Promise<MediatedResult> {
  // ── Outbound inspection ──────────────────────────────────────────────────
  const outboundDecision = inspect({
    sessionId: call.sessionId,
    agentId: call.agentId,
    direction: 'outbound',
    declaredIntent: call.declaredIntent,
    sourceIsUploadedDocument: call.sourceIsUploadedDocument,
    prompt: call.prompt,
  });

  recordAudit(
    { sessionId: call.sessionId, agentId: call.agentId, direction: 'outbound',
      declaredIntent: call.declaredIntent, sourceIsUploadedDocument: call.sourceIsUploadedDocument,
      prompt: call.prompt },
    outboundDecision
  );

  if (outboundDecision.action === 'DENY' || outboundDecision.action === 'HUMAN_REVIEW') {
    return {
      ok: false,
      outboundDecision,
      blockedReason: `${outboundDecision.action}: ${outboundDecision.reason ?? outboundDecision.ruleIdMatched}`,
    };
  }

  if (process.env.DEMO_OFFLINE_MODE === 'true') {
    return { ok: true, output: '[DEMO_OFFLINE_MODE] Canned response — see lib/agents/demo-fixtures.ts', outboundDecision };
  }

  const promptToSend = outboundDecision.action === 'REDACT_AND_LOG'
    ? (outboundDecision.redactedPrompt ?? call.prompt)
    : call.prompt;

  // ── Call AI provider ─────────────────────────────────────────────────────
  let providerResult: { text: string; provider: Provider; model: string };
  try {
    providerResult = await callProvider(call, promptToSend);
  } catch (err: any) {
    return {
      ok: false,
      outboundDecision,
      blockedReason: `model_error: ${err.message ?? String(err)}`,
    };
  }

  // ── Inbound inspection ───────────────────────────────────────────────────
  const inboundDecision = inspect({
    sessionId: call.sessionId,
    agentId: call.agentId,
    direction: 'inbound',
    prompt: providerResult.text,
  });

  recordAudit(
    { sessionId: call.sessionId, agentId: call.agentId, direction: 'inbound', prompt: providerResult.text },
    inboundDecision
  );

  if (inboundDecision.action === 'DENY') {
    return { ok: false, outboundDecision, inboundDecision,
      blockedReason: `inbound_blocked: ${inboundDecision.reason}` };
  }

  return {
    ok: true,
    output: providerResult.text,
    provider: providerResult.provider,
    modelUsed: providerResult.model,
    outboundDecision,
    inboundDecision,
  };
}
