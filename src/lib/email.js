import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHTML(flights, searchParams) {
  const currencySymbol = { INR: '₹', USD: '$', CAD: 'C$', GBP: '£' }[searchParams.currency] || searchParams.currency;

  const flightRows = flights.map((flight, index) => {
    const segments = flight.flights || [];
    const firstSeg = segments[0] || {};
    const lastSeg = segments[segments.length - 1] || {};
    const airlines = [...new Set(segments.map(s => s.airline))].join(', ');
    const flightNumbers = segments.map(s => s.flight_number).join(' → ');
    const stops = segments.length - 1;
    const stopsLabel = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
    const durationH = Math.floor((flight.total_duration || 0) / 60);
    const durationM = (flight.total_duration || 0) % 60;
    const duration = `${durationH}h ${durationM}m`;

    const bookingUrl = flight._bookingUrl || `https://www.google.com/travel/flights?hl=en&curr=${searchParams.currency}`;

    return `
      <tr style="border-bottom: 1px solid #2a2a4a;">
        <td style="padding: 16px; text-align: center;">
          <strong style="color: #a78bfa; font-size: 16px;">#${index + 1}</strong>
        </td>
        <td style="padding: 16px;">
          <div style="font-weight: 600; color: #e2e8f0; font-size: 14px;">${airlines}</div>
          <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">${flightNumbers}</div>
        </td>
        <td style="padding: 16px;">
          <div style="color: #e2e8f0; font-size: 14px;">${firstSeg.departure_airport?.time?.split(' ')[1] || 'N/A'}</div>
          <div style="color: #94a3b8; font-size: 12px;">${firstSeg.departure_airport?.id || ''}</div>
        </td>
        <td style="padding: 16px;">
          <div style="color: #e2e8f0; font-size: 14px;">${lastSeg.arrival_airport?.time?.split(' ')[1] || 'N/A'}</div>
          <div style="color: #94a3b8; font-size: 12px;">${lastSeg.arrival_airport?.id || ''}</div>
        </td>
        <td style="padding: 16px; text-align: center;">
          <div style="color: #e2e8f0; font-size: 14px;">${duration}</div>
          <div style="color: #94a3b8; font-size: 12px;">${stopsLabel}</div>
        </td>
        <td style="padding: 16px; text-align: center;">
          <div style="font-weight: 700; color: #10b981; font-size: 18px;">${currencySymbol}${(flight.price || 0).toLocaleString()}</div>
        </td>
        <td style="padding: 16px; text-align: center;">
          <a href="${bookingUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">Book Now →</a>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 800px; margin: 0 auto; padding: 32px 16px;">
        
        <!-- Header -->
        <div style="text-align: center; padding: 40px 24px; background: linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95); border-radius: 16px 16px 0 0;">
          <h1 style="margin: 0; font-size: 28px; color: white;">✈️ Flight Deal Alert</h1>
          <p style="margin: 8px 0 0; color: #c4b5fd; font-size: 16px;">
            ${searchParams.from} → ${searchParams.to} · ${searchParams.outboundDate}${searchParams.returnDate ? ' — ' + searchParams.returnDate : ''}
          </p>
          <p style="margin: 8px 0 0; color: #a78bfa; font-size: 14px;">
            Top ${flights.length} cheapest flights found for you
          </p>
        </div>

        <!-- Flight Table -->
        <div style="background-color: #1a1a3e; border-radius: 0 0 16px 16px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #252550; border-bottom: 2px solid #4c1d95;">
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: center;">#</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: left;">Airline</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: left;">Depart</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: left;">Arrive</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: center;">Duration</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: center;">Price</th>
                <th style="padding: 12px 16px; color: #a78bfa; font-size: 12px; text-transform: uppercase; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${flightRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p>Powered by <strong style="color: #a78bfa;">Flight Deal Hunter</strong></p>
          <p>Prices are sourced from Google Flights and may vary. Book quickly — deals don't last!</p>
          <a href="https://www.google.com/travel/flights?hl=en&curr=${searchParams.currency}" target="_blank" style="color: #7c3aed; text-decoration: none;">
            Search more on Google Flights →
          </a>
        </div>

      </div>
    </body>
    </html>
  `;
}

export async function sendFlightDeals(to, flights, searchParams) {
  const html = buildEmailHTML(flights, searchParams);

  const { data, error } = await resend.emails.send({
    from: 'Flight Deal Hunter <onboarding@resend.dev>',
    to: [to],
    subject: `✈️ ${flights.length} Cheap Flight${flights.length > 1 ? 's' : ''}: ${searchParams.from} → ${searchParams.to} from ${
      { INR: '₹', USD: '$', CAD: 'C$', GBP: '£' }[searchParams.currency] || ''
    }${flights[0]?.price?.toLocaleString() || 'N/A'}`,
    html,
  });

  if (error) {
    console.error('[Resend] Email error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  return data;
}
