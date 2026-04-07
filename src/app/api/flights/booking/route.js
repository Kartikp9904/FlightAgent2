import { NextResponse } from 'next/server';
import { getBookingOptions } from '@/lib/serpapi';

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookingToken } = body;

    if (!bookingToken) {
      return NextResponse.json(
        { error: 'Missing required field: bookingToken' },
        { status: 400 }
      );
    }

    const result = await getBookingOptions(bookingToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Booking options error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking options' },
      { status: 500 }
    );
  }
}
