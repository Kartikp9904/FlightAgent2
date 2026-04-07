import { NextResponse } from 'next/server';
import { searchFlights } from '@/lib/serpapi';
import { sendFlightDeals } from '@/lib/email';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    // 1. Verify Vercel Cron Secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      );
    }

    const results = [];

    // 2. Fetch subscriptions from Supabase
    const { data: subscriptions, error: dbError } = await supabase
      .from('subscriptions')
      .select('*');

    if (dbError) {
      throw new Error(`Supabase select error: ${dbError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No subscriptions found' });
    }

    // 3. Loop over subscriptions and run the exact logic
    for (const sub of subscriptions) {
      console.log(`[Cron] Processing subscription for ${sub.email}: ${sub.from} -> ${sub.to}`);
      
      try {
        // Run specific flight search using our existing utility without changing logic
        const searchResult = await searchFlights({
          from: sub.from,
          to: sub.to,
          outboundDate: sub.outboundDate,
          returnDate: sub.returnDate,
          tripType: sub.tripType || 2,
          adults: sub.adults || 1,
          travelClass: sub.travelClass || 1,
          currency: sub.currency || 'INR',
          stops: sub.stops || 0,
        });

        // Get top 10 cheapest flights
        const flights = searchResult.flights || [];

        if (flights.length > 0) {
          // Send email using our existing utility without changing logic
          await sendFlightDeals(sub.email, flights.slice(0, 10), {
            from: sub.from,
            to: sub.to,
            outboundDate: sub.outboundDate,
            returnDate: sub.returnDate,
            currency: sub.currency || 'INR',
          });

          results.push({ email: sub.email, route: `${sub.from}-${sub.to}`, status: 'sent', dealsFound: flights.length });
        } else {
          results.push({ email: sub.email, route: `${sub.from}-${sub.to}`, status: 'skipped', reason: 'No flights found' });
        }
      } catch (err) {
        console.error(`[Cron] Failed to process subscription for ${sub.email}:`, err.message);
        results.push({ email: sub.email, route: `${sub.from}-${sub.to}`, status: 'error', reason: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Cron] Critical error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}
