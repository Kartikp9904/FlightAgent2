import { NextResponse } from 'next/server';
import { getBookingOptions } from '@/lib/serpapi';

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookingToken, from, to, outboundDate, type, currency } = body;

    if (!bookingToken || !from || !to || !outboundDate) {
      return NextResponse.json(
        { error: 'Missing required fields for booking' },
        { status: 400 }
      );
    }

    const result = await getBookingOptions({ bookingToken, from, to, outboundDate, type, currency });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Booking options error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking options' },
      { status: 500 }
    );
  }
}
