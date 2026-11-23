/* The weather box — Open-Meteo, free, no key. One call a day is plenty.

     forecast({ lat, lon, tz }, dateISO) → { high, low, words, rain, sunset, next:[{ dow, high, low, words }] } or null */
'use strict';

const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers',
  82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms', 96: 'Storms, hail', 99: 'Storms, hail'
};

async function forecast(o, iso){
  if (!o || o.lat == null || o.lon == null || o.lat === '' || o.lon === '') return null;
  const q = new URLSearchParams({
    latitude: o.lat, longitude: o.lon, timezone: o.tz || 'auto',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset',
    temperature_unit: o.unit === 'c' ? 'celsius' : 'fahrenheit', start_date: iso,
    end_date: (() => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + 4);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })()
  });
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json(), d = j.daily || {};
    if (!d.time || !d.time.length) return null;
    const day = i => ({
      dow: new Date(d.time[i] + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      high: Math.round(d.temperature_2m_max[i]), low: Math.round(d.temperature_2m_min[i]),
      words: WMO[d.weather_code[i]] || '', rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null
    });
    const sun = d.sunset && d.sunset[0] ? new Date(d.sunset[0]) : null;
    const sunset = sun ? sun.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    return { ...day(0), sunset, next: d.time.slice(1, 5).map((_, i) => day(i + 1)) };
  } catch (e) { return null; }
  finally { clearTimeout(t); }
}

module.exports = { forecast, WMO };
