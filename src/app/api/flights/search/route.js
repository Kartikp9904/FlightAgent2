import { NextResponse } from 'next/server';
import { searchFlights } from '@/lib/serpapi';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      from,
      to,
      outboundDate,
      returnDate,
      tripType = 2,
      adults = 1,
      children = 0,
      travelClass = 1,
      currency = 'INR',
      maxPrice,
      stops = 0,
    } = body;

    if (!from || !to || !outboundDate) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, outboundDate' },
        { status: 400 }
      );
    }

    const result = await searchFlights({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      outboundDate,
      returnDate,
      tripType: Number(tripType),
      adults: Number(adults),
      children: Number(children),
      travelClass: Number(travelClass),
      currency,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      stops: Number(stops),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Flight search error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Flight search failed' },
      { status: 500 }
    );
  }
}
