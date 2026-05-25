import { describe, it, expect, vi } from 'vitest';
import { WeatherClient, decodeWeatherCode, WeatherError } from '../src/index.js';

function mockFetch(payload: unknown, status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('WeatherClient', () => {
  it('builds the scoova weather /v1/forecast URL with sane defaults', async () => {
    const fetchImpl = mockFetch({
      latitude: 30, longitude: 31,
      generationtime_ms: 0, utc_offset_seconds: 0, timezone: 'auto', timezone_abbreviation: 'GMT',
      current: { time: '2026-05-04T15:00', interval: 900, temperature_2m: 24 },
    });
    const client = new WeatherClient({ baseUrl: 'https://example.test', fetch: fetchImpl });

    await client.current(30.04, 31.24);

    const url = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://example.test/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('30.04');
    expect(url.searchParams.get('longitude')).toBe('31.24');
    expect(url.searchParams.get('current')).toContain('temperature_2m');
    expect(url.searchParams.get('timezone')).toBe('auto');
  });

  it('forwards forecastDays / units / pastDays', async () => {
    const fetchImpl = mockFetch({ latitude: 0, longitude: 0, generationtime_ms: 0, utc_offset_seconds: 0, timezone: 'auto', timezone_abbreviation: 'GMT' });
    const client = new WeatherClient({ baseUrl: 'https://example.test', fetch: fetchImpl });
    await client.forecast({
      lat: 30, lon: 31,
      hourly: ['temperature_2m', 'wind_speed_10m'],
      daily: ['temperature_2m_max'],
      forecastDays: 3, pastDays: 1,
      temperatureUnit: 'fahrenheit', windSpeedUnit: 'ms',
    });
    const url = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(url.searchParams.get('hourly')).toBe('temperature_2m,wind_speed_10m');
    expect(url.searchParams.get('daily')).toBe('temperature_2m_max');
    expect(url.searchParams.get('forecast_days')).toBe('3');
    expect(url.searchParams.get('past_days')).toBe('1');
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
  });

  it('wraps non-2xx responses in WeatherError', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 502 })) as unknown as typeof fetch;
    const client = new WeatherClient({ baseUrl: 'https://example.test', fetch: fetchImpl });
    await expect(client.current(30, 31)).rejects.toBeInstanceOf(WeatherError);
  });

  it('attaches X-API-Key header when apiKey is set', async () => {
    const fetchImpl = mockFetch({
      latitude: 0, longitude: 0,
      generationtime_ms: 0, utc_offset_seconds: 0,
      timezone: 'auto', timezone_abbreviation: 'GMT',
    });
    const client = new WeatherClient({
      baseUrl: 'https://api.scoo-va.info/v1/weather',
      apiKey: 'sk_live_abc',
      fetch: fetchImpl,
    });
    await client.current(30, 31);

    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('sk_live_abc');
  });

  it('forwards client-level locale on ?locale= and Accept-Language', async () => {
    const fetchImpl = mockFetch({
      latitude: 0, longitude: 0,
      generationtime_ms: 0, utc_offset_seconds: 0,
      timezone: 'auto', timezone_abbreviation: 'GMT',
    });
    const client = new WeatherClient({
      baseUrl: 'https://example.test',
      locale: 'fr',
      fetch: fetchImpl,
    });
    await client.current(30, 31);

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(call[0] as string);
    const headers = (call[1] as RequestInit).headers as Record<string, string>;
    expect(url.searchParams.get('locale')).toBe('fr');
    expect(headers['Accept-Language']).toBe('fr');
  });

  it('per-call locale overrides client default', async () => {
    const fetchImpl = mockFetch({
      latitude: 0, longitude: 0,
      generationtime_ms: 0, utc_offset_seconds: 0,
      timezone: 'auto', timezone_abbreviation: 'GMT',
    });
    const client = new WeatherClient({
      baseUrl: 'https://example.test',
      locale: 'en',
      fetch: fetchImpl,
    });
    await client.forecast({ lat: 0, lon: 0, locale: 'ar-EG' });

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(call[0] as string);
    const headers = (call[1] as RequestInit).headers as Record<string, string>;
    expect(url.searchParams.get('locale')).toBe('ar-EG');
    expect(headers['Accept-Language']).toBe('ar-EG');
  });
});

describe('decodeWeatherCode', () => {
  it('maps WMO codes to broad conditions', () => {
    expect(decodeWeatherCode(0)).toBe('clear');
    expect(decodeWeatherCode(2)).toBe('cloudy');
    expect(decodeWeatherCode(45)).toBe('fog');
    expect(decodeWeatherCode(53)).toBe('drizzle');
    expect(decodeWeatherCode(63)).toBe('rain');
    expect(decodeWeatherCode(80)).toBe('rain');
    expect(decodeWeatherCode(73)).toBe('snow');
    expect(decodeWeatherCode(96)).toBe('thunderstorm');
    expect(decodeWeatherCode(null)).toBe('unknown');
    expect(decodeWeatherCode(undefined)).toBe('unknown');
    expect(decodeWeatherCode(123)).toBe('unknown');
  });
});
