/**
 * useGeoTracking.js
 *
 * Tracks participant countries and locations via IP geolocation.
 * Uses ipapi.co (free tier: 1,000 requests/day, no key needed).
 *
 * What it captures per participant:
 *   - Country, city, region
 *   - Timezone (for scheduling insights)
 *   - ISP/carrier (mobile vs broadband)
 *   - Approximate lat/lng (not exact — city-level only)
 *
 * Data sent to your backend for analytics dashboard.
 * GDPR note: IP geolocation is city-level only — not personally identifiable.
 * Still, add this to your privacy policy: "We collect approximate location."
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useGeoTracking({ roomCode, participantName, enabled = true } = {}) {
  const [myLocation,     setMyLocation]     = useState(null);
  const [participantMap, setParticipantMap] = useState({}); // identity → location
  const [countryStats,   setCountryStats]   = useState({}); // country → count
  const [loading,        setLoading]        = useState(false);

  // Fetch and report own location on mount
  useEffect(() => {
    if (!enabled || !roomCode) return;

    async function fetchAndReport() {
      setLoading(true);
      try {
        // ipapi.co — free, no API key needed, city-level only
        const res  = await fetch('https://ipapi.co/json/');
        const data = await res.json();

        const location = {
          country:      data.country_name,
          countryCode:  data.country_code,
          city:         data.city,
          region:       data.region,
          timezone:     data.timezone,
          isp:          data.org,
          lat:          data.latitude,
          lng:          data.longitude,
          participant:  participantName,
        };

        setMyLocation(location);

        // Report to your backend analytics endpoint
        await fetch(`${API_BASE}/api/analytics/geo`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode, ...location, ts: Date.now() }),
        }).catch(() => {}); // non-critical — don't throw if analytics fails

      } catch (err) {
        console.warn('[GeoTracking] Could not detect location:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAndReport();
  }, [enabled, roomCode, participantName]);

  // Called when a remote participant joins — their location is broadcast
  // via LiveKit DataChannel from their own client
  const registerParticipant = useCallback((identity, location) => {
    if (!location?.country) return;
    setParticipantMap(prev => ({ ...prev, [identity]: location }));
    setCountryStats(prev => ({
      ...prev,
      [location.country]: (prev[location.country] || 0) + 1,
    }));
  }, []);

  const removeParticipant = useCallback((identity) => {
    setParticipantMap(prev => {
      const updated = { ...prev };
      const location = updated[identity];
      if (location?.country) {
        setCountryStats(cs => ({
          ...cs,
          [location.country]: Math.max(0, (cs[location.country] || 1) - 1),
        }));
      }
      delete updated[identity];
      return updated;
    });
  }, []);

  // Top countries sorted by participant count
  const topCountries = Object.entries(countryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));

  return {
    myLocation,
    participantMap,
    countryStats,
    topCountries,
    loading,
    registerParticipant,
    removeParticipant,
    totalParticipants: Object.keys(participantMap).length + (myLocation ? 1 : 0),
  };
}
