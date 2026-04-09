'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ============ UTILITY FUNCTIONS ============
function formatDuration(minutes) {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPrice(price, currency = 'INR') {
  if (!price && price !== 0) return 'N/A';
  const symbols = { INR: '₹', USD: '$', CAD: 'C$', GBP: '£' };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${price.toLocaleString()}`;
}

function getStopsLabel(flights) {
  if (!flights || flights.length === 0) return 'N/A';
  const stops = flights.length - 1;
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

// AI handles airport resolution now

// ============ FLIGHT CARD ============
function FlightCard({ flight, index, currency, searchParams, onViewBooking }) {
  const [expanded, setExpanded] = useState(false);
  const [bookingOptions, setBookingOptions] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  const segments = flight.flights || [];
  const firstSeg = segments[0] || {};
  const lastSeg = segments[segments.length - 1] || {};
  const airlines = [...new Set(segments.map(s => s.airline))];
  const mainLogo = flight.airline_logo || firstSeg.airline_logo;

  const handleViewBooking = async () => {
    if (bookingOptions) return;
    if (!flight.booking_token) return;
    setLoadingBooking(true);
    try {
      const res = await fetch('/api/flights/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingToken: flight.booking_token,
          from: searchParams?.from,
          to: searchParams?.to,
          outboundDate: searchParams?.date_start,
          type: searchParams?.tripType || 2,
          currency: currency
        }),
      });
      const data = await res.json();
      const sorted = (data.bookingOptions || []).sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
      setBookingOptions(sorted);
    } catch (err) {
      console.error('Booking fetch error:', err);
    }
    setLoadingBooking(false);
  };

  return (
    <div className="flight-card glass-card" style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="flight-card-main" onClick={() => setExpanded(!expanded)}>
        <div className="flight-rank">
          <div className="flight-rank-number">#{index + 1}</div>
          {index === 0 && <div className="flight-rank-label" style={{ color: '#10b981' }}>Cheapest</div>}
        </div>

        <div className="flight-airline">
          {mainLogo && <img src={mainLogo} alt={airlines[0]} className="airline-logo" />}
          <div className="airline-info">
            <h3>{airlines.join(' + ')}</h3>
            <p>{segments.map(s => s.flight_number).join(' → ')}</p>
          </div>
        </div>

        <div className="flight-time">
          <div className="time">{firstSeg.departure_airport?.time?.split(' ')[1] || '—'}</div>
          <div className="airport">{firstSeg.departure_airport?.id}</div>
        </div>

        <div className="flight-time">
          <div className="time">{lastSeg.arrival_airport?.time?.split(' ')[1] || '—'}</div>
          <div className="airport">{lastSeg.arrival_airport?.id}</div>
        </div>

        <div className="flight-duration">
          <div className="duration">{formatDuration(flight.total_duration)}</div>
          <div className="stops">{getStopsLabel(segments)}</div>
        </div>

        <div className="flight-price">
          <div className="price">{formatPrice(flight.price, currency)}</div>
          <div className="type">{flight.type || 'per person'}</div>
        </div>
      </div>

      {expanded && (
        <div className="flight-details">
          <div className="flight-segments">
            {segments.map((seg, si) => (
              <div key={si}>
                <div className="segment">
                  {seg.airline_logo && (
                    <img src={seg.airline_logo} alt={seg.airline} className="segment-airline-logo" />
                  )}
                  <div className="segment-info">
                    <div className="segment-route">
                      <span>{seg.departure_airport?.name} ({seg.departure_airport?.id})</span>
                      <span className="arrow">→</span>
                      <span>{seg.arrival_airport?.name} ({seg.arrival_airport?.id})</span>
                    </div>
                    <div className="segment-meta">
                      <span>✈️ {seg.airline} {seg.flight_number}</span>
                      <span>⏱️ {formatDuration(seg.duration)}</span>
                      <span>🪑 {seg.travel_class}</span>
                      {seg.airplane && <span>🛩️ {seg.airplane}</span>}
                      {seg.legroom && <span>📏 {seg.legroom}</span>}
                      <span>🕐 {seg.departure_airport?.time} → {seg.arrival_airport?.time}</span>
                    </div>
                    {seg.extensions && seg.extensions.length > 0 && (
                      <div className="segment-meta" style={{ marginTop: '4px', opacity: 0.7 }}>
                        {seg.extensions.map((ext, ei) => (
                          <span key={ei} style={{ fontSize: '0.72rem' }}>{ext}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {flight.layovers && flight.layovers[si] && (
                  <div className="layover-badge">
                    ⏳ Layover: {formatDuration(flight.layovers[si].duration)} at {flight.layovers[si].name} ({flight.layovers[si].id})
                    {flight.layovers[si].overnight && ' · Overnight'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {flight.carbon_emissions && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>🌿 CO₂: {((flight.carbon_emissions.this_flight || 0) / 1000).toFixed(0)} kg</span>
              {flight.carbon_emissions.difference_percent !== undefined && (
                <span style={{ color: flight.carbon_emissions.difference_percent < 0 ? '#10b981' : '#ef4444' }}>
                  {flight.carbon_emissions.difference_percent > 0 ? '+' : ''}{flight.carbon_emissions.difference_percent}% vs typical
                </span>
              )}
            </div>
          )}

          {/* Booking Options */}
          {flight.booking_token && (
            <div className="booking-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="booking-title">🔗 Booking Options</span>
                {!bookingOptions && (
                  <button className="btn-book" onClick={handleViewBooking} disabled={loadingBooking}>
                    {loadingBooking ? 'Loading...' : 'Fetch Booking Links'}
                  </button>
                )}
              </div>
              {bookingOptions && bookingOptions.length > 0 && (
                <div className="booking-options-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookingOptions.map((opt, oi) => {
                    const isCheapest = oi === 0;
                    return (
                      <div key={oi} className="booking-option glass-card" style={isCheapest ? { border: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px' } : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="booking-provider" style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                              {opt.together?.book_with || opt.book_with || `Option ${oi + 1}`}
                            </span>
                            {isCheapest && <span style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Best Deal</span>}
                          </div>
                          {opt.price && (
                            <span className="booking-price" style={isCheapest ? { color: '#10b981', fontWeight: '900', fontSize: '1.2rem' } : { color: 'var(--text-accent)', fontWeight: 'bold' }}>
                              {formatPrice(opt.price, currency)}
                            </span>
                          )}
                        </div>

                        {(opt.booking_request?.url || opt.url) && (
                          <a href={opt.booking_request?.url || opt.url} target="_blank" rel="noopener noreferrer" className="btn-book" style={isCheapest ? { backgroundColor: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' } : { backgroundColor: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
                            Checkout →
                          </a>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
              {bookingOptions && bookingOptions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No booking options found. Try Google Flights directly.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ PRICE INSIGHTS ============
function PriceInsightsPanel({ insights, currency }) {
  if (!insights) return null;

  return (
    <div className="price-insights glass-card animate-fade-in-up">
      <div className="price-insights-header">
        📊 Price Insights
      </div>
      <div className="price-insights-grid">
        <div className="price-insight-item">
          <div className="price-insight-label">Lowest Price</div>
          <div className="price-insight-value" style={{ color: '#10b981' }}>
            {formatPrice(insights.lowest_price, currency)}
          </div>
        </div>
        <div className="price-insight-item">
          <div className="price-insight-label">Price Level</div>
          <div className="price-insight-value" style={{
            color: insights.price_level === 'low' ? '#10b981' : insights.price_level === 'high' ? '#ef4444' : '#f59e0b'
          }}>
            {insights.price_level === 'low' ? '🟢 Great Deal' : insights.price_level === 'high' ? '🔴 High' : '🟡 Typical'}
          </div>
        </div>
        <div className="price-insight-item">
          <div className="price-insight-label">Typical Range</div>
          <div className="price-insight-value" style={{ color: 'var(--text-accent)', fontSize: '1rem' }}>
            {insights.typical_price_range
              ? `${formatPrice(insights.typical_price_range[0], currency)} — ${formatPrice(insights.typical_price_range[1], currency)}`
              : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function Home() {
  // AI Prompt State
  const [prompt, setPrompt] = useState('Find the cheapest flight from Ahmedabad to Dubai between 10th-20th May');
  const [email, setEmail] = useState('');
  
  // Results / UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [cheapestFlight, setCheapestFlight] = useState(null);
  const [searched, setSearched] = useState(false);
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePlanFlight = async (e) => {
    e.preventDefault();
    if (!prompt || !email) {
      setError('Please provide both a prompt and your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setParsedData(null);
    setCheapestFlight(null);
    setSearched(true);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, email }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to analyze flight request.');
      } else {
        setSuccessMsg(data.message);
        setParsedData(data.data);
        setCheapestFlight(data.cheapestFlight);
        showToast('✅ Analysis complete! Deal sent to your email.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="bg-gradient-hero" style={{ minHeight: '100vh', paddingBottom: '60px' }}>
      {/* Hero */}
      <section className="hero">
        <div className="hero-icon">🤖</div>
        <h1 className="hero-title animate-fade-in-up">AI Flight Planner</h1>
        <p className="hero-subtitle animate-fade-in-up" style={{ animationDelay: '0.1s', maxWidth: '600px', margin: '0 auto 20px auto' }}>
          Tell the AI your travel plans. It finds the single absolute cheapest flight and continuously tracks it for you.
        </p>
      </section>

      {/* AI Prompt Box */}
      <section className="search-section container">
        <form className="search-card glass-card animate-fade-in-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handlePlanFlight}>
          
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
              Where do you want to fly?
            </label>
            <textarea
              className="form-input"
              rows={3}
              style={{ padding: '16px', fontSize: '1.1rem', resize: 'vertical' }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Find the cheapest flight from Ahmedabad to Dubai between 10th-20th May"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Your Email (to receive the deal & tracking updates)</label>
            <input
              type="email"
              className="form-input"
              style={{ maxWidth: '400px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <button type="submit" className="btn-search" disabled={loading} style={{ marginTop: '10px' }}>
            {loading && <span className="spinner"></span>}
            {loading ? '🧠 AI is Analyzing & Searching...' : '✨ Plan & Track My Flight'}
          </button>
        </form>
      </section>

      {/* Results Section */}
      {searched && (
        <section className="results-section container" style={{ marginTop: '40px' }}>
          
          {loading && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '20px' }}>⏳</div>
              <h3 style={{ color: 'var(--text-primary)' }}>Parsing your request with Gemini Model...</h3>
              <p style={{ color: 'var(--text-muted)' }}>We are analyzing your dates and finding the absolute cheapest flight.</p>
              <div className="skeleton skeleton-card" style={{ marginTop: '30px' }}></div>
            </div>
          )}

          {error && !loading && (
            <div className="no-results animate-fade-in">
              <div className="no-results-icon">🤔</div>
              <h3>AI Could Not Find Flights</h3>
              <p>{error}</p>
            </div>
          )}

          {parsedData && cheapestFlight && !loading && (
            <div className="animate-fade-in-up">
              
              <div className="results-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '15px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#10b981' }}>
                  <strong>{successMsg}</strong>
                </div>
                
                <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)' }}>🧠 AI Extracted Itinerary:</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <li><strong>Origin:</strong> {parsedData.from}</li>
                    <li><strong>Destination:</strong> {parsedData.to}</li>
                    <li><strong>Start Date:</strong> {parsedData.date_start}</li>
                    <li><strong>End Date:</strong> {parsedData.date_end}</li>
                  </ul>
                  <p style={{ marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Our automated agent will now check this exact route daily. If a flight drops below the current lowest price, we will email you immediately.
                  </p>
                </div>
              </div>

              <h3 style={{ margin: '30px 0 20px 0', color: 'var(--text-primary)', textAlign: 'center' }}>🏆 Absolute Cheapest Flight Found</h3>
              
              <FlightCard
                flight={cheapestFlight}
                index={0}
                currency={parsedData.currency}
                searchParams={parsedData}
              />
            </div>
          )}
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '40px 20px', marginTop: '40px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>Powered by <strong style={{ color: 'var(--text-accent)' }}>Gemini AI</strong> & <strong style={{ color: 'var(--text-accent)' }}>Flight Deal Tracker</strong></p>
        <p style={{ marginTop: '4px' }}>Automated Daily Cron Tracking Active.</p>
      </footer>
    </div>
  );
}
