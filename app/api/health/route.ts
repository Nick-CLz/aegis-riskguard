import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'aegis-riskguard',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    },
    { headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
