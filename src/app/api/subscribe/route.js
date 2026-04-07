import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendFlightDeals } from '@/lib/email';

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, searchParams, flights } = body;

    if (!to || !searchParams) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Send the first email immediately so user knows it works
    if (flights && flights.length > 0) {
      await sendFlightDeals(to, flights.slice(0, 10), searchParams);
    }

    // 2. Add to Supabase for the 6-hour cron
    const { error: dbError } = await supabase
      .from('subscriptions')
      .upsert({
        email: to,
        from_airport: searchParams.from,
        to_airport: searchParams.to,
        outbound_date: searchParams.outboundDate,
        return_date: searchParams.returnDate || null,
        currency: searchParams.currency || 'INR',
        trip_type: searchParams.tripType || 2,
        adults: searchParams.adults || 1,
        travel_class: searchParams.travelClass || 1,
        stops: searchParams.stops || 0
      }, { onConflict: 'email,from_airport,to_airport,outbound_date' });

    if (dbError) {
      console.error('[Supabase] Insert error:', dbError);
      return NextResponse.json(
        { error: `Database Error: ${dbError.message || JSON.stringify(dbError)}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to flight alerts'
    });
  } catch (error) {
    console.error('[API] Subscribe error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
