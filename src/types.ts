export interface WeatherSettings {
  settingsVersion: number;
  locationName: string;
  latitude: number;
  longitude: number;
  units: "us" | "si";
  timeZone: string;
  snapshotFolder: string;
  autoRefresh: boolean;
}
export interface CacheEntry {
  data: unknown;
  checkedAt: number;
  expiresAt: number;
  etag?: string;
  lastModified?: string;
}
export type HttpCache = Record<string, CacheEntry>;
export interface HttpResponse { status: number; headers: Record<string, string>; json: unknown }
export type Transport = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;
export interface Feed<T> { data?: T; checkedAt?: number; expiresAt?: number; error?: string; source?: string }
export interface Period {
  name: string; startTime: string; endTime: string; temperature: number | null;
  temperatureUnit: string; windSpeed: string; windDirection: string;
  shortForecast: string; detailedForecast: string; precipitation: number | null;
}
export interface Forecast { updated: string; periods: Period[] }
export interface Observation {
  station: string; stationName: string; timestamp: string; description: string;
  temperatureC: number | null; humidity: number | null; windKmh: number | null;
}
export interface Alert {
  id: string; event: string; headline: string; severity: string;
  sent: string; effective: string; expires: string; ends: string;
  description: string; instruction: string; source: string;
}
export interface WeatherState {
  locationKey: string;
  forecast: Feed<Forecast>;
  hourly: Feed<Forecast>;
  observation: Feed<Observation>;
  alerts: Feed<Alert[]>;
  refreshing: boolean;
  lastAttempt?: number;
}
export interface WeatherStorage { settings?: WeatherSettings; cache?: HttpCache }
