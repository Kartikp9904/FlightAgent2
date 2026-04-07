import axios from 'axios';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

export async function searchFlights({
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
}) {
  const params = {
    engine: 'google_flights',
    api_key: process.env.SERPAPI_KEY,
    departure_id: from,
    arrival_id: to,
    outbound_date: outboundDate,
    type: tripType,
    adults,
    children,
    travel_class: travelClass,
    currency,
    sort_by: 2, // Sort by price
    show_hidden: true,
    deep_search: true,
    hl: 'en',
  };

  if (tripType === 1 && returnDate) {
    params.return_date = returnDate;
  }
  if (maxPrice) {
    params.max_price = maxPrice;
  }
  if (stops > 0) {
    params.stops = stops;
  }

  try {
    const response = await axios.get(SERPAPI_BASE, { params });
    const data = response.data;

    if (data.error) {
      throw new Error(data.error);
    }

    const bestFlights = (data.best_flights || []).map(f => ({ ...f, _tier: 'best' }));
    const otherFlights = (data.other_flights || []).map(f => ({ ...f, _tier: 'other' }));
    const allFlights = [...bestFlights, ...otherFlights];

    // Sort by price ascending
    allFlights.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));

    return {
      flights: allFlights.slice(0, 15),
      priceInsights: data.price_insights || null,
      airports: data.airports || [],
      searchMetadata: data.search_metadata || {},
      searchParams: data.search_parameters || {},
      googleFlightsUrl: data.search_metadata?.google_flights_url || null,
    };
  } catch (error) {
    console.error('[SerpAPI] Flight search error:', error.message);
    throw error;
  }
}

export async function getBookingOptions(bookingToken) {
  try {
    const params = {
      engine: 'google_flights',
      api_key: process.env.SERPAPI_KEY,
      booking_token: bookingToken,
      hl: 'en',
    };

    const response = await axios.get(SERPAPI_BASE, { params });
    const data = response.data;

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      bookingOptions: data.booking_options || [],
      searchMetadata: data.search_metadata || {},
    };
  } catch (error) {
    console.error('[SerpAPI] Booking options error:', error.message);
    throw error;
  }
}

export async function autocompleteAirport(query) {
  try {
    const params = {
      engine: 'google_flights_autocomplete',
      api_key: process.env.SERPAPI_KEY,
      query,
    };

    const response = await axios.get(SERPAPI_BASE, { params });
    return response.data.airports || [];
  } catch (error) {
    console.error('[SerpAPI] Autocomplete error:', error.message);
    return [];
  }
}
