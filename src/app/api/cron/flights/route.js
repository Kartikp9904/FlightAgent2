import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchFlights } from '@/lib/serpapi';
import { sendFlightDeals } from '@/lib/email';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscriptions, error } = await supabase.from('subscriptions').select('*');
    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No active subscriptions' });
    }

    const today = new Date().toISOString().split('T')[0];
    let processedCount = 0;

    for (const sub of subscriptions) {
      // Clean up past subscriptions
      if (sub.date_end < today) {
        await supabase.from('subscriptions').delete().eq('id', sub.id);
        continue;
      }

      // Generate array of dates to check safely without timezone drift
      let datesToCheck = [];
      const startStr = sub.date_start < today ? today : sub.date_start;
      
      let current = new Date(`${startStr}T00:00:00Z`);
      const end = new Date(`${sub.date_end}T00:00:00Z`);

      while (current <= end) {
        datesToCheck.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
      }

      if (datesToCheck.length === 0) continue;

      let absoluteCheapestFlight = null;

      // Check each day, taking care not to aggressively rate-limit SerpApi
      for (const targetDate of datesToCheck) {
        try {
          const res = await searchFlights({
            from: sub.from_airport,
            to: sub.to_airport,
            outboundDate: targetDate,
            currency: sub.currency,
            tripType: sub.trip_type,
            adults: sub.adults,
            stops: sub.stops,
          });

          if (res.flights && res.flights.length > 0) {
            const cheapestForDay = res.flights[0];
            if (!absoluteCheapestFlight || cheapestForDay.price < absoluteCheapestFlight.price) {
              absoluteCheapestFlight = cheapestForDay;
              absoluteCheapestFlight._targetDate = targetDate;
            }
          }
        } catch (err) {
          console.error(`Cron error fetching ${sub.from_airport}-${sub.to_airport} for ${targetDate}:`, err.message);
        }
      }

      // Did we find a flight? Is it cheaper than the last time we checked?
      if (absoluteCheapestFlight) {
        const isFirstTime = !sub.last_lowest_price;
        const priceDropped = absoluteCheapestFlight.price < sub.last_lowest_price;
        const flightChanged = absoluteCheapestFlight.flight_id !== sub.last_flight_id;

        // Smart Mailing Logic:
        // Only email if price dropped OR (if we want, flight completely changed and is somehow still cheapest).
        // Let's stick to true price-drops to avoid spamming the user.
        if (isFirstTime || priceDropped) {
          await sendFlightDeals(sub.email, [absoluteCheapestFlight], {
            from: sub.from_airport,
            to: sub.to_airport,
            outboundDate: absoluteCheapestFlight._targetDate,
            currency: sub.currency,
          });

          // Update tracking data
          await supabase.from('subscriptions').update({
            last_lowest_price: absoluteCheapestFlight.price,
            last_flight_id: absoluteCheapestFlight.flight_id || absoluteCheapestFlight.flights?.[0]?.flight_number || null,
          }).eq('id', sub.id);
        }
      }

      processedCount++;
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
