// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { runGapDetector } from '@/lib/agents/gap-detector';
import { DEMO_POLICY, DEMO_RCSA, DEMO_GAPS_FALLBACK } from '@/lib/agents/demo-fixtures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId ?? uuid();

    const policy = body.policy ?? DEMO_POLICY;
    const rcsa = body.rcsa ?? DEMO_RCSA;

    const result = await runGapDetector(sessionId, policy, rcsa);

    // Graceful fallback: if Gemini failed (no key, rate limit), still return demo data
    // so the UI is never broken during a live demo.
    if (!result.ok && result.gaps.length === 0) {
      return NextResponse.json({
        ok: true,
        sessionId,
        fallback: true,
        fallbackReason: result.blockedReason,
        gaps: DEMO_GAPS_FALLBACK.gaps,
        coverageScore: DEMO_GAPS_FALLBACK.coverageScore,
        decisionTrail: result.decisionTrail
      });
    }

    return NextResponse.json({ sessionId, ...result, ok: result.ok });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? String(err) }, { status: 500 });
  }
}
