# @scoova/weather

TypeScript client for `weather.scoo-va.info` — the Scoova weather endpoint
that speaks the open-meteo `/v1/forecast` shape.

## Install

```sh
npm install @scoova/weather
```

## Usage

```ts
import { WeatherClient, decodeWeatherCode } from '@scoova/weather';

// Unauthenticated against the raw weather subdomain (rate-limited).
const client = new WeatherClient();

// Authenticated via the API gateway (also reads SCOOVA_API_KEY env var).
const gateway = new WeatherClient({
  baseUrl: 'https://api.scoo-va.info/v1/weather',
  apiKey:  process.env.SCOOVA_API_KEY ?? 'demo',
  locale:  'fr',          // server localises text fields where applicable
});

// Just current conditions
const now = await gateway.current(30.04, 31.24);
const condition = decodeWeatherCode(now.current?.weather_code as number);
// → 'clear' | 'cloudy' | 'rain' | 'snow' | …

// 3-day hourly temp + wind
const hourly = await gateway.hourly(30.04, 31.24,
  ['temperature_2m', 'wind_speed_10m'], 3);

// Daily summary
const daily = await gateway.daily(30.04, 31.24,
  ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'], 7);

// Anything else — per-call locale overrides the client default
const custom = await gateway.forecast({
  lat: 30.04, lon: 31.24,
  current: ['temperature_2m', 'apparent_temperature'],
  hourly:  ['precipitation', 'wind_gusts_10m'],
  daily:   ['sunrise', 'sunset'],
  forecastDays: 5,
  temperatureUnit: 'fahrenheit',
  locale: 'es',
});
```

## Locale

`locale` accepts BCP-47 codes: `en`, `en-US`, `en-GB`, `fr`, `es`, `de`, `it`,
`pt-BR`, `nl`, `ar`, `ar-EG`, `ar-SA`, plus regional variants. The value is
sent as both a `?locale=` query string and an `Accept-Language` header. The
gateway falls back to `en` for unsupported codes.

## Tests

```sh
npm test
```

License: Apache-2.0.
