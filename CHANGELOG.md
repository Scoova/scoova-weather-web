# Changelog

All notable changes to `@scoova/weather` are documented here.

## 1.1.1 — 2026-05-25
- Default `baseUrl` switched from the retired `https://weather.scoo-va.info` subdomain to the central gateway at `https://api.scoo-va.info/api/v1/weather`. Callers who explicitly set `baseUrl` are unaffected. The old subdomain returns `ENDPOINT_RETIRED`.

## 1.1.0 — 2026-05-25

- **New:** built-in `locale` option (BCP-47 — `en`, `fr`, `es`, `de`, `it`,
  `pt-BR`, `nl`, `ar`, `ar-EG`, `ar-SA`, plus regional variants). Sent as
  `?locale=` and `Accept-Language`; per-call `locale` on `ForecastQuery`
  overrides the client default.
- **New:** built-in `apiKey` option for gateway-routed calls. Reads
  `process.env.SCOOVA_API_KEY` automatically when no value is passed.
- Verified endpoint surface against the live gateway: `current()`,
  `hourly()`, `daily()`, `forecast()`, and `raw()` all hit
  `/v1/forecast` on `weather.scoo-va.info`, and identically when the
  client is pointed at `https://api.scoo-va.info/v1/weather`.
- License: switched from MIT to Apache-2.0 to match the rest of the
  Scoova platform SDKs.
- Repo: moved to `Scoova/scoova-weather-web`.

## 1.0.0 — 2026-04-12

- Initial release: `WeatherClient` with `current`, `hourly`, `daily`,
  `forecast`, `raw` plus `decodeWeatherCode()` helper.
