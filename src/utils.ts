import type { Alert, Feed, Forecast, Observation, WeatherSettings } from "./types";
export const DEFAULT_SETTINGS: WeatherSettings = {
  settingsVersion: 1, locationName: "Peoria, IL", latitude: 40.6936, longitude: -89.589,
  units: "us", timeZone: "America/Chicago", snapshotFolder: "Weather/Snapshots", autoRefresh: true
};
export const MINUTE = 60_000;
export const WEATHER_INTERVAL = 15 * MINUTE;
export const ALERT_INTERVAL = 5 * MINUTE;
export function safeFolder(value: string): string {
  const raw = value.trim().replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /[:\x00-\x1f]/.test(raw)) throw new Error("Use a vault-relative folder, such as Weather/Snapshots.");
  const parts = raw.split("/").filter(Boolean);
  if (parts.some(p => p === "." || p === ".." || p.startsWith(".") || /[<>"|?*]/.test(p))) throw new Error("Choose a regular vault folder without traversal or reserved characters.");
  return parts.join("/");
}
export function validateSettings(s: WeatherSettings): WeatherSettings {
  if (!Number.isFinite(s.latitude) || s.latitude < -90 || s.latitude > 90 || !Number.isFinite(s.longitude) || s.longitude < -180 || s.longitude > 180) throw new Error("Enter valid latitude and longitude coordinates.");
  try { new Intl.DateTimeFormat("en-US", {timeZone:s.timeZone}).format(); } catch { throw new Error("Enter an IANA time zone, such as America/Chicago."); }
  if (!s.locationName.trim()) throw new Error("Enter a location name.");
  return {...s, settingsVersion:1, units:s.units === "si" ? "si" : "us", locationName:s.locationName.trim(), snapshotFolder:safeFolder(s.snapshotFolder)};
}
export function normalizeSettings(value: unknown): WeatherSettings {
  try { return validateSettings({...DEFAULT_SETTINGS, ...(value && typeof value === "object" ? value : {})}); }
  catch { return {...DEFAULT_SETTINGS}; }
}
export function locationKey(s: WeatherSettings): string { return `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}:${s.units}`; }
export function apiUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("NWS did not provide the requested endpoint.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "api.weather.gov" || url.port || url.username || url.password) throw new Error("Refused an unexpected provider address.");
  return url.toString();
}
export function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
export function formatTime(value: string | number | undefined, zone: string): string {
  if (value === undefined || !Number.isFinite(new Date(value).getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {timeZone:zone, month:"short", day:"numeric", hour:"numeric", minute:"2-digit", timeZoneName:"short"}).format(new Date(value));
}
export function temperature(c: number | null, units: string): string { return c === null ? "Unavailable" : `${Math.round(units === "us" ? c * 9 / 5 + 32 : c)}°${units === "us" ? "F" : "C"}`; }
export function activeAlerts(alerts: Alert[], now: number): Alert[] {
  return alerts.filter(a => {
    const expiry = Date.parse(a.expires), end = Date.parse(a.ends);
    return Number.isFinite(expiry) && expiry > now && (!Number.isFinite(end) || end > now);
  });
}
export function currentPeriods(forecast: Forecast | undefined, now: number, hourly = false): import("./types").Period[] {
  return forecast?.periods.filter(p => Date.parse(p.endTime) > now && (!hourly || Date.parse(p.startTime) < now + 24 * 60 * MINUTE)).slice(0, hourly ? 25 : 14) ?? [];
}
export function feedStatus(feed: Feed<unknown>, now: number, kind: "forecast" | "hourly" | "observation" | "alerts"): string {
  if (!feed.data) return feed.error ? `Unavailable — ${feed.error}` : "Not yet available";
  let old = feed.expiresAt === undefined || now >= feed.expiresAt;
  if (kind === "observation") old ||= now - Date.parse((feed.data as Observation).timestamp) > 2 * 60 * MINUTE;
  if (kind === "forecast" || kind === "hourly") {
    const f = feed.data as Forecast;
    old ||= !currentPeriods(f, now).length || !Number.isFinite(Date.parse(f.updated)) || now - Date.parse(f.updated) > 12 * 60 * MINUTE;
  }
  return feed.error || old ? `Stale cached data${feed.error ? ` — ${feed.error}` : ""}` : "Current";
}
export function markdownText(value: string): string { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]#|!])/g,"\\$1"); }
