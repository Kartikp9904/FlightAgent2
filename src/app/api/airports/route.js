import { NextResponse } from 'next/server';
import { autocompleteAirport } from '@/lib/serpapi';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ airports: [] });
    }

    const airports = await autocompleteAirport(query);
    return NextResponse.json({ airports });
  } catch (error) {
    console.error('[API] Autocomplete error:', error.message);
    return NextResponse.json({ airports: [] });
  }
}
