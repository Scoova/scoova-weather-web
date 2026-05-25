# @scoova/weather — Cross-platform Parity

Five SDKs, one API surface. All target the scoova weather compatible
`/v1/forecast` endpoint at `weather.scoo-va.info` (or via the gateway at
`api.scoo-va.info/v1/weather`).

| Platform     | Package / Path                                                | Version | Tests |
|--------------|---------------------------------------------------------------|---------|-------|
| Web (TS)     | `@scoova/weather` — `/scoova-weather-web`                     | 1.1.0   | 7     |
| React Native | `@scoova/weather-react-native` — `/scoova-weather-react-native`| 1.1.0   | 6     |
| Android JVM  | `info.scoo-va:scoova-weather` — `/scoova-weather-android`     | 1.1.0   | 6     |
| iOS Swift    | `ScoovaWeather` — `/scoova-weather-ios`                       | 1.1.0   | 6     |
| Flutter      | `scoova_weather` — `/scoova-weather-flutter`                  | 1.1.0   | 6     |

## Common surface

```
WeatherClient({ baseUrl?, apiKey?, locale? })
  current(lat, lon, vars?, locale?)             -> ForecastResponse
  hourly (lat, lon, vars?, days?, locale?)      -> ForecastResponse
  daily  (lat, lon, vars?, days?, locale?)      -> ForecastResponse
  forecast(lat, lon, current?, hourly?, daily?,
           timezone?, forecastDays?, pastDays?,
           units?, locale?)                     -> ForecastResponse
  raw(path, params?, locale?)                   -> JSON

decodeWeatherCode(code) -> clear | cloudy | fog | drizzle | rain | snow | thunderstorm | unknown
```

## Locale

Every client takes an optional `locale` (BCP-47 — `en`, `en-US`, `fr`, `es`,
`de`, `it`, `pt-BR`, `nl`, `ar`, `ar-EG`, `ar-SA`, plus regional variants).
Sent as both `?locale=` query string and `Accept-Language` header. Per-call
`locale` overrides the client default. Unsupported codes fall back to `en`
server-side.

## API key

Every client takes an optional `apiKey`. When set, the client adds
`X-API-Key` to every request. On platforms that expose environment access,
the SDK falls back to the `SCOOVA_API_KEY` env var when no value is passed.
Use the gateway base URL — `https://api.scoo-va.info/v1/weather` — for
key-enforced calls.

## Defaults

`current` defaults: temperature_2m, relative_humidity_2m, apparent_temperature,
precipitation, wind_speed_10m, wind_direction_10m, weather_code, is_day.

`hourly` defaults: temperature_2m, precipitation, wind_speed_10m, weather_code.

`daily` defaults: temperature_2m_max/min, precipitation_sum, wind_speed_10m_max,
weather_code, sunrise, sunset.

Every default lines up across all five SDKs, so an app porting between
platforms gets the same payload back from a no-args `current(lat, lon)` call.
