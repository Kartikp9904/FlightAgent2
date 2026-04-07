import { NextResponse } from 'next/server';
import { sendFlightDeals } from '@/lib/email';

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, flights, searchParams } = body;

    if (!to || !flights || !searchParams) {
      return NextResponse.json(
        { error: 'Missing required fields: to, flights, searchParams' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const result = await sendFlightDeals(to, flights, searchParams);

    return NextResponse.json({
      success: true,
      message: `Flight deals sent to ${to}`,
      emailId: result?.id,
    });
  } catch (error) {
    console.error('[API] Email error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
