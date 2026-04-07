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

// ============ AIRPORT INPUT ============
function AirportInput({ label, value, onChange, placeholder, id }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value && !displayValue) setDisplayValue(value);
  }, [value, displayValue]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.airports || []);
      setShowDropdown(true);
    } catch { setSuggestions([]); }
  }, []);

  const extractCode = (text) => {
    // Extract IATA code: first 2-4 uppercase letters
    const match = text.trim().match(/^([A-Z]{2,4})/i);
    return match ? match[1].toUpperCase() : text.trim().toUpperCase();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setDisplayValue(val);
    // Always update parent with the extracted code
    const code = extractCode(val);
    if (code.length >= 2) onChange(code);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleBlur = () => {
    // On blur, extract and set the code
    const code = extractCode(displayValue);
    if (code.length >= 2) onChange(code);
  };

  const handleSelect = (airport) => {
    const code = airport.id || airport.iata;
    const name = airport.name || '';
    onChange(code);
    setDisplayValue(`${code} — ${name}`);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div className="form-group" ref={wrapperRef}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        className="form-input"
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((apt, i) => (
            <div
              key={`${apt.id || apt.iata}-${i}`}
              className="autocomplete-item"
              onClick={() => handleSelect(apt)}
            >
              <span className="airport-code">{apt.id || apt.iata}</span>
              <span className="airport-name">{apt.name}{apt.city ? `, ${apt.city}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ FLIGHT CARD ============
function FlightCard({ flight, index, currency, onViewBooking }) {
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
        body: JSON.stringify({ bookingToken: flight.booking_token }),
      });
      const data = await res.json();
      setBookingOptions(data.bookingOptions || []);
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
                <div className="booking-options-grid">
                  {bookingOptions.map((opt, oi) => (
                    <div key={oi} className="booking-option">
                      <span className="booking-provider">{opt.together?.book_with || opt.book_with || `Option ${oi + 1}`}</span>
                      {opt.price && <span className="booking-price">{formatPrice(opt.price, currency)}</span>}
                      {(opt.booking_request?.url || opt.url) && (
                        <a href={opt.booking_request?.url || opt.url} target="_blank" rel="noopener noreferrer" className="btn-book">
                          Book Now →
                        </a>
                      )}
                    </div>
                  ))}
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
  // Search form state
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType] = useState(2); // 1=round, 2=one-way
  const [currency, setCurrency] = useState('INR');
  const [adults, setAdults] = useState(1);
  const [travelClass, setTravelClass] = useState(1);
  const [stops, setStops] = useState(0);
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Results state
  const [flights, setFlights] = useState([]);
  const [priceInsights, setPriceInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Email state
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [subscribeChecked, setSubscribeChecked] = useState(true);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setOutboundDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!from || !to || !outboundDate) {
      setError('Please fill in departure, arrival, and date');
      return;
    }

    setLoading(true);
    setError('');
    setFlights([]);
    setPriceInsights(null);
    setSearched(true);

    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          outboundDate,
          returnDate: tripType === 1 ? returnDate : undefined,
          tripType,
          adults,
          travelClass,
          currency,
          stops,
          maxPrice: maxPrice || undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setFlights(data.flights || []);
        setPriceInsights(data.priceInsights);
        if (!data.flights?.length) {
          setError('No flights found for this route. Try different dates or airports.');
        }
      }
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    }

    setLoading(false);
  };

  const handleSendEmail = async () => {
    if (!email || flights.length === 0) return;
    setEmailSending(true);

    try {
      const endpoint = subscribeChecked ? '/api/subscribe' : '/api/email';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          flights: flights.slice(0, 10),
          searchParams: { from, to, outboundDate, returnDate, currency, tripType, adults, travelClass, stops },
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${subscribeChecked ? 'Subscribed and deals sent to ' : 'Flight deals sent to '}${email}`);
      } else {
        showToast(`❌ ${data.error || 'Failed to send email'}`, 'error');
      }
    } catch {
      showToast('❌ Failed to process request', 'error');
    }

    setEmailSending(false);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-gradient-hero" style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section className="hero">
        <div className="hero-icon">✈️</div>
        <h1 className="hero-title animate-fade-in-up">Find The Cheapest Flights Instantly</h1>
        <p className="hero-subtitle animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Stop wasting hours searching. We find the best deals and send them to your inbox with real booking links.
        </p>
      </section>

      {/* Search Form */}
      <section className="search-section container">
        <form className="search-card glass-card animate-fade-in-up" style={{ animationDelay: '0.2s' }} onSubmit={handleSearch}>
          {/* Trip Type Toggle */}
          <div style={{ marginBottom: '24px' }}>
            <div className="trip-toggle" style={{ maxWidth: '300px' }}>
              <button type="button" className={`trip-toggle-btn ${tripType === 2 ? 'active' : ''}`} onClick={() => setTripType(2)}>
                One Way
              </button>
              <button type="button" className={`trip-toggle-btn ${tripType === 1 ? 'active' : ''}`} onClick={() => setTripType(1)}>
                Round Trip
              </button>
            </div>
          </div>

          <div className="form-grid">
            <AirportInput
              label="From"
              value={from}
              onChange={setFrom}
              placeholder="e.g. BOM, DEL, JFK"
              id="input-from"
            />

            <AirportInput
              label="To"
              value={to}
              onChange={setTo}
              placeholder="e.g. LHR, DXB, SIN"
              id="input-to"
            />

            <div className="form-group">
              <label className="form-label" htmlFor="input-outbound">Departure Date</label>
              <input
                id="input-outbound"
                type="date"
                className="form-input"
                value={outboundDate}
                onChange={(e) => setOutboundDate(e.target.value)}
                min={today}
              />
            </div>

            {tripType === 1 && (
              <div className="form-group">
                <label className="form-label" htmlFor="input-return">Return Date</label>
                <input
                  id="input-return"
                  type="date"
                  className="form-input"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={outboundDate || today}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="input-currency">Currency</label>
              <select id="input-currency" className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">🇮🇳 INR (₹)</option>
                <option value="USD">🇺🇸 USD ($)</option>
                <option value="CAD">🇨🇦 CAD (C$)</option>
                <option value="GBP">🇬🇧 GBP (£)</option>
              </select>
            </div>

            {tripType !== 1 && <div></div>}

            {/* Advanced Filters */}
            <div className="full-width">
              <div className="filters-toggle">
                <button
                  type="button"
                  className="filters-toggle-btn"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? '▾ Hide Filters' : '▸ Advanced Filters'}
                </button>
              </div>

              {showFilters && (
                <div className="advanced-filters">
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-adults">Passengers</label>
                    <select id="input-adults" className="form-select" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                        <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-class">Travel Class</label>
                    <select id="input-class" className="form-select" value={travelClass} onChange={(e) => setTravelClass(Number(e.target.value))}>
                      <option value={1}>Economy</option>
                      <option value={2}>Premium Economy</option>
                      <option value={3}>Business</option>
                      <option value={4}>First</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-stops">Stops</label>
                    <select id="input-stops" className="form-select" value={stops} onChange={(e) => setStops(Number(e.target.value))}>
                      <option value={0}>Any</option>
                      <option value={1}>Nonstop only</option>
                      <option value={2}>1 stop or fewer</option>
                      <option value={3}>2 stops or fewer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-maxprice">Max Price</label>
                    <input
                      id="input-maxprice"
                      type="number"
                      className="form-input"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="No limit"
                    />
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn-search" disabled={loading}>
              {loading && <span className="spinner"></span>}
              {loading ? 'Searching Flights...' : '🔍 Search Cheapest Flights'}
            </button>
          </div>
        </form>
      </section>

      {/* Results */}
      {searched && (
        <section className="results-section container">
          {/* Error */}
          {error && !loading && (
            <div className="no-results animate-fade-in">
              <div className="no-results-icon">😔</div>
              <h3>No Flights Found</h3>
              <p>{error}</p>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="animate-fade-in">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}></div>
              ))}
            </div>
          )}

          {/* Results Header + Email */}
          {flights.length > 0 && !loading && (
            <>
              <div className="results-header animate-fade-in-up">
                <div className="results-count">
                  Found <span>{flights.length}</span> flights · Sorted by <span>cheapest first</span>
                </div>
                <div className="email-bar">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        id="input-email"
                        style={{ width: '280px' }}
                      />
                      <button
                        className="btn-email"
                        onClick={handleSendEmail}
                        disabled={emailSending || !email}
                      >
                        {emailSending ? 'Processing...' : '📧 Email Deals'}
                      </button>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={subscribeChecked}
                        onChange={(e) => setSubscribeChecked(e.target.checked)}
                        style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      Subscribe me to automated 6-hour deal alerts for this route
                    </label>
                  </div>
                </div>
              </div>

              {/* Price Insights */}
              <PriceInsightsPanel insights={priceInsights} currency={currency} />

              {/* Flight Cards */}
              {flights.map((flight, i) => (
                <FlightCard
                  key={`${flight.booking_token || flight.departure_token || i}`}
                  flight={flight}
                  index={i}
                  currency={currency}
                />
              ))}
            </>
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
      <footer style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>Powered by <strong style={{ color: 'var(--text-accent)' }}>Flight Deal Hunter</strong> · Data from Google Flights via SerpAPI</p>
        <p style={{ marginTop: '4px' }}>Prices may vary. Always verify on the airline&apos;s website before booking.</p>
      </footer>
    </div>
  );
}
