// app/api/audit/route.ts
import { NextResponse } from 'next/server';
import { getAuditLog } from '@/lib/lobstertrap/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

export async function GET() {
  return NextResponse.json({ entries: getAuditLog(100) }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
