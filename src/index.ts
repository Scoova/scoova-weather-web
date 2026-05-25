/**
 * @scoova/weather
 *
 * Thin client for Scoova's weather endpoint. Speaks the open-meteo
 * `/v1/forecast` shape, so any existing open-meteo code keeps working. The
 * four typed methods cover the 95% case (current conditions, hourly + daily
 * forecasts, full forecast), with `raw()` for anything else.
 *
 * All requests go through the central Scoova gateway:
 *   `https://api.scoo-va.info/api/v1/weather`
 *
 * Pass `apiKey` for key-enforced access; omit for unauthenticated requests
 * (rate-limited).
 */

export type WeatherVar =
  // current / hourly
  | 'temperature_2m'
  | 'relative_humidity_2m'
  | 'apparent_temperature'
  | 'precipitation'
  | 'rain'
  | 'showers'
  | 'snowfall'
  | 'cloud_cover'
  | 'wind_speed_10m'
  | 'wind_direction_10m'
  | 'wind_gusts_10m'
  | 'weather_code'
  | 'pressure_msl'
  | 'surface_pressure'
  | 'visibility'
  | 'uv_index'
  | 'is_day'
  // daily
  | 'temperature_2m_max'
  | 'temperature_2m_min'
  | 'apparent_temperature_max'
  | 'apparent_temperature_min'
  | 'precipitation_sum'
  | 'precipitation_hours'
  | 'wind_speed_10m_max'
  | 'wind_gusts_10m_max'
  | 'sunrise'
  | 'sunset'
  | 'uv_index_max';

export interface ForecastQuery {
  lat: number;
  lon: number;
  current?: WeatherVar[];
  hourly?: WeatherVar[];
  daily?: WeatherVar[];
  /** Default: 'auto' — server returns local-time-stamped data. */
  timezone?: string;
  /** Number of forecast days, 1-16. Default 7. */
  forecastDays?: number;
  /** Number of past days, 0-92. Default 0. */
  pastDays?: number;
  /** Wind speed unit. Default 'kmh'. */
  windSpeedUnit?: 'kmh' | 'ms' | 'mph' | 'kn';
  /** Temperature unit. Default 'celsius'. */
  temperatureUnit?: 'celsius' | 'fahrenheit';
  /** Precipitation unit. Default 'mm'. */
  precipitationUnit?: 'mm' | 'inch';
  /**
   * Per-call locale override (BCP-47 — `en`, `en-US`, `fr`, `es`, `de`, …).
   * Overrides the client-level `locale` for this request only. Used for
   * localised text fields the server returns (e.g. condition descriptions).
   */
  locale?: string;
}

export interface CurrentBlock {
  time: string;
  interval: number;
  [key: string]: number | string | null;
}

export interface SeriesBlock {
  time: string[];
  [key: string]: (number | null)[] | string[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  current_units?: Record<string, string>;
  current?: CurrentBlock;
  hourly_units?: Record<string, string>;
  hourly?: SeriesBlock;
  daily_units?: Record<string, string>;
  daily?: SeriesBlock;
}

export class WeatherError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'WeatherError';
  }
}

const DEFAULT_BASE = 'https://api.scoo-va.info/api/v1/weather';

const DEFAULT_CURRENT: WeatherVar[] = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
  'precipitation', 'wind_speed_10m', 'wind_direction_10m',
  'weather_code', 'is_day',
];
const DEFAULT_HOURLY: WeatherVar[] = [
  'temperature_2m', 'precipitation', 'wind_speed_10m', 'weather_code',
];
const DEFAULT_DAILY: WeatherVar[] = [
  'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'wind_speed_10m_max', 'weather_code', 'sunrise', 'sunset',
];

export interface WeatherClientOptions {
  /**
   * Base URL. Defaults to the central Scoova gateway
   * (`https://api.scoo-va.info/api/v1/weather`). Override only if you are
   * pointing at a self-hosted weather endpoint.
   */
  baseUrl?: string;
  /**
   * Scoova API key. When set, the client adds `X-API-Key` to every request
   * and goes through the gateway path. If `process.env.SCOOVA_API_KEY` is set
   * and `apiKey` is omitted, that value wins; otherwise unauthenticated.
   */
  apiKey?: string;
  /**
   * Default locale for every response that carries localised text
   * (BCP-47 codes — `en`, `en-US`, `fr`, `es`, `de`, `it`, `pt-BR`, `nl`,
   * `ar`, `ar-EG`, `ar-SA`, plus regional variants). Sent as both `?locale=`
   * and `Accept-Language`. Per-call `locale` on a `ForecastQuery` overrides.
   * Unsupported codes fall back to `en` server-side.
   */
  locale?: string;
  fetch?: typeof fetch;
}

export class WeatherClient {
  private baseUrl: string;
  private apiKey?: string;
  private locale?: string;
  private fetchImpl: typeof fetch;

  constructor(opts: WeatherClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    // Lookup process.env.SCOOVA_API_KEY without leaning on Node typings —
    // this package ships type-clean in browser builds too.
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const envKey = proc?.env?.SCOOVA_API_KEY;
    this.apiKey = opts.apiKey ?? envKey;
    this.locale = opts.locale;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Current observed conditions only — minimum payload. */
  async current(lat: number, lon: number, vars: WeatherVar[] = DEFAULT_CURRENT): Promise<ForecastResponse> {
    return this.forecast({ lat, lon, current: vars, forecastDays: 1 });
  }

  /** Hourly series — defaults to 7 days of temperature/precip/wind/weather code. */
  async hourly(lat: number, lon: number, vars: WeatherVar[] = DEFAULT_HOURLY, days = 7): Promise<ForecastResponse> {
    return this.forecast({ lat, lon, hourly: vars, forecastDays: days });
  }

  /** Daily summary series. */
  async daily(lat: number, lon: number, vars: WeatherVar[] = DEFAULT_DAILY, days = 7): Promise<ForecastResponse> {
    return this.forecast({ lat, lon, daily: vars, forecastDays: days });
  }

  /** Full forecast call. Pass `current`, `hourly`, and/or `daily`. */
  async forecast(query: ForecastQuery): Promise<ForecastResponse> {
    const params = new URLSearchParams();
    params.set('latitude', String(query.lat));
    params.set('longitude', String(query.lon));
    if (query.current?.length)  params.set('current', query.current.join(','));
    if (query.hourly?.length)   params.set('hourly', query.hourly.join(','));
    if (query.daily?.length)    params.set('daily', query.daily.join(','));
    params.set('timezone', query.timezone ?? 'auto');
    if (query.forecastDays !== undefined) params.set('forecast_days', String(query.forecastDays));
    if (query.pastDays !== undefined)     params.set('past_days', String(query.pastDays));
    if (query.windSpeedUnit)              params.set('wind_speed_unit', query.windSpeedUnit);
    if (query.temperatureUnit)            params.set('temperature_unit', query.temperatureUnit);
    if (query.precipitationUnit)          params.set('precipitation_unit', query.precipitationUnit);
    const callLocale = query.locale ?? this.locale;
    if (callLocale) params.set('locale', callLocale);

    return this.request(`/v1/forecast?${params.toString()}`, callLocale);
  }

  /** Escape hatch — hits any path on the weather server, returns parsed JSON. */
  async raw<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, this.locale);
  }

  private async request<T>(path: string, callLocale: string | undefined): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    if (callLocale)  headers['Accept-Language'] = callLocale;

    const res = await this.fetchImpl(url, { headers });
    const body = await res.text();
    if (!res.ok) throw new WeatherError(body.slice(0, 200), res.status);
    try {
      return JSON.parse(body) as T;
    } catch (e) {
      throw new WeatherError(`Invalid JSON from ${url}: ${(e as Error).message}`);
    }
  }
}

/**
 * Map an open-meteo WMO weather code to a coarse-grained label / icon hint.
 * Useful for UIs that just want one of "clear / cloudy / rain / snow / fog / storm".
 */
export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm' | 'unknown';

export function decodeWeatherCode(code: number | null | undefined): WeatherCondition {
  if (code === null || code === undefined) return 'unknown';
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'unknown';
}
