export function formatDuration(minutes) {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatPrice(price, currency = 'INR') {
  if (!price && price !== 0) return 'N/A';
  const symbols = { INR: '₹', USD: '$', CAD: 'C$', GBP: '£' };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${price.toLocaleString()}`;
}

export function getStopsLabel(flights) {
  if (!flights || flights.length === 0) return 'N/A';
  const stops = flights.length - 1;
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

export function getPriceLevelColor(level) {
  const colors = {
    low: '#10b981',
    typical: '#f59e0b',
    high: '#ef4444',
  };
  return colors[level] || '#8b5cf6';
}

export function getPriceLevelLabel(level) {
  const labels = {
    low: '🟢 Great Price',
    typical: '🟡 Typical Price',
    high: '🔴 High Price',
  };
  return labels[level] || 'Price';
}

export function buildGoogleFlightsUrl({ from, to, outboundDate, returnDate, tripType = 2, currency = 'INR' }) {
  const base = 'https://www.google.com/travel/flights';
  const params = new URLSearchParams({
    hl: 'en',
    curr: currency,
  });
  // Google Flights uses its own TFS encoding, so we provide a basic search URL
  return `${base}?${params.toString()}`;
}

export function getLayoverSummary(layovers) {
  if (!layovers || layovers.length === 0) return '';
  return layovers
    .map(l => `${formatDuration(l.duration)} in ${l.name} (${l.id})${l.overnight ? ' · Overnight' : ''}`)
    .join(' → ');
}

export function extractAirlines(flights) {
  if (!flights) return [];
  const seen = new Set();
  return flights
    .map(f => ({
      name: f.airline,
      logo: f.airline_logo,
      flightNumber: f.flight_number,
    }))
    .filter(a => {
      if (seen.has(a.name)) return false;
      seen.add(a.name);
      return true;
    });
}
