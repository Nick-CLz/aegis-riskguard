// app/api/draft-memo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { runMemoDrafter } from '@/lib/agents/memo-drafter';
import { DEMO_MEMO_FALLBACK, DEMO_GAPS_FALLBACK } from '@/lib/agents/demo-fixtures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId ?? uuid();

    // If no gaps are provided, we fallback to the demo gaps
    const gaps = (body.gaps && body.gaps.length > 0) ? body.gaps : DEMO_GAPS_FALLBACK.gaps;

    const result = await runMemoDrafter(sessionId, gaps);

    // Graceful fallback: if Gemini failed (no key, rate limit), still return demo data
    // so the UI is never broken during a live demo.
    if (!result.ok && !result.memo) {
      return NextResponse.json({
        ok: true,
        sessionId,
        fallback: true,
        fallbackReason: result.blockedReason,
        usedDemoData: true,
        memo: DEMO_MEMO_FALLBACK,
        decisionTrail: result.decisionTrail
      });
    }

    return NextResponse.json({ 
      sessionId, 
      ...result, 
      ok: result.ok, 
      usedDemoData: !body.gaps 
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? String(err) }, { status: 500 });
  }
}
