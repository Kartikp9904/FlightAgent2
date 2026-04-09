import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { searchFlights } from '@/lib/serpapi';
import { sendFlightDeals } from '@/lib/email';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are a strict flight search parameter extractor.

Your job:
Convert natural language into a VALID JSON object ONLY.

DO NOT output anything except JSON.

----------------------------------
RULES (CRITICAL)

1. ALWAYS convert city names to IATA airport codes
   Example:
   Ahmedabad → AMD
   Dubai → DXB
   New York → JFK

2. Dates:
   - Convert all dates to YYYY-MM-DD
   - If user says:
     "tomorrow", "next week", "after 10 days" → calculate from today's date: ${new Date().toISOString().split('T')[0]}
   - If no date → use 14 days from today
   - If range given (10–20 May):
       date_start = first date
       date_end = last date
       tripType = 2 (ONE WAY)

3. Trip Type:
   - ONE WAY → 2
   - ROUND TRIP → 1 ONLY if user says or use terms like:
     "return", "roundtrip", "coming back"

4. Stops:
   - "nonstop" / "direct" → 1
   - "1 stop" → 2
   - otherwise → 0

5. Travel Class:
   - economy → 1
   - premium economy → 2
   - business → 3
   - first → 4

6. Currency:
   - Default INR
   - If user mentions country:
       USA → USD
       UAE → AED
       Europe → EUR

7. Adults:
   - Default 1
   - Extract if mentioned

----------------------------------

OUTPUT FORMAT (STRICT JSON)

{
  "from": "",
  "to": "",
  "date_start": "",
  "date_end": "",
  "currency": "INR",
  "tripType": 2,
  "adults": 1,
  "travelClass": 1,
  "stops": 0
}

----------------------------------

DO NOT:
- Add explanation
- Add markdown
- Skip fields
- Return invalid JSON
`;

export async function POST(request) {
  try {
    const { prompt, email } = await request.json();

    if (!prompt || !email) {
      return NextResponse.json({ error: 'Missing prompt or email' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    // 1. Call Gemini to parse
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: SYSTEM_PROMPT });
    const result = await model.generateContent(prompt);
    let rawJson = result.response.text().trim();

    // Clean markdown if Gemini hallucinates it
    if (rawJson.startsWith('```json')) {
      rawJson = rawJson.replace(/^```json\n|\n```$/g, '');
    } else if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```|```$/g, '');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(rawJson);
    } catch (e) {
      console.error("Failed to parse Gemini output:", rawJson);
      throw new Error("Failed to extract flight details. Please be more specific.");
    }

    if (!parsedData.from || !parsedData.to || !parsedData.date_start || !parsedData.date_end) {
      throw new Error("Could not detect origin, destination, or dates.");
    }

    // 2. Fetch Initial Flight immediately
    let cheapestFlight = null;
    let actualFlightDate = parsedData.date_start;

    if (parsedData.tripType === 1 || parsedData.date_start === parsedData.date_end) {
      // Round-trip or exact-day one-way
      const searchResult = await searchFlights({
        ...parsedData,
        outboundDate: parsedData.date_start,
        returnDate: parsedData.tripType === 1 ? parsedData.date_end : null
      });
      if (searchResult.flights && searchResult.flights.length > 0) {
        cheapestFlight = searchResult.flights[0];
      }
    } else {
      // Flexible window (tripType 2, range given)
      let current = new Date(`${parsedData.date_start}T00:00:00Z`);
      const end = new Date(`${parsedData.date_end}T00:00:00Z`);
      let dayCount = 0;

      while (current <= end && dayCount < 14) {
        const targetDate = current.toISOString().split('T')[0];
        try {
          const res = await searchFlights({
            ...parsedData,
            outboundDate: targetDate,
            returnDate: null
          });

          if (res.flights && res.flights.length > 0) {
            const dayCheapest = res.flights[0];
            if (!cheapestFlight || dayCheapest.price < cheapestFlight.price) {
              cheapestFlight = dayCheapest;
              actualFlightDate = targetDate;
              cheapestFlight._targetDate = targetDate;
            }
          }
        } catch (e) {
          console.error(`Search error for ${targetDate}:`, e.message);
        }
        current.setUTCDate(current.getUTCDate() + 1);
        dayCount++;
      }
    }

    if (!cheapestFlight) {
      return NextResponse.json({ error: 'No flights found for this route.' }, { status: 404 });
    }

    // 3. Send email immediately
    await sendFlightDeals(email, [cheapestFlight], {
      from: parsedData.from,
      to: parsedData.to,
      outboundDate: actualFlightDate,
      returnDate: parsedData.tripType === 1 ? parsedData.date_end : null,
      currency: parsedData.currency,
    });

    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert({
        email: email,
        original_prompt: prompt,
        from_airport: parsedData.from,
        to_airport: parsedData.to,
        date_start: parsedData.date_start,
        date_end: parsedData.date_end,
        currency: parsedData.currency || 'INR',
        trip_type: parsedData.tripType || 2,
        adults: parsedData.adults || 1,
        travel_class: parsedData.travelClass || 1,
        stops: parsedData.stops || 0,
        last_lowest_price: cheapestFlight.price || null,
        last_flight_id: cheapestFlight.flight_id || cheapestFlight.flights?.[0]?.flight_number || null
      });

    if (dbError) {
      console.error('[Supabase] Insert error:', dbError);
      throw new Error(`Database Error: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Flight analyzed and tracked successfully.',
      data: parsedData,
      cheapestFlight: cheapestFlight
    });

  } catch (error) {
    console.error('[API] Parse error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
