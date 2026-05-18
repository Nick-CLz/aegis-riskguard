// app/api/audit/route.ts
import { NextResponse } from 'next/server';
import { getAuditLog } from '@/lib/lobstertrap/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ entries: getAuditLog(100) });
}
