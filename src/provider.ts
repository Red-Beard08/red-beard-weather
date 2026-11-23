import type { Alert, CacheEntry, Feed, Forecast, HttpCache, Observation, Transport, WeatherSettings, WeatherState } from "./types";
import { activeAlerts, ALERT_INTERVAL, apiUrl, locationKey, MINUTE, numberOrNull, WEATHER_INTERVAL } from "./utils";

type Json = Record<string, any>;
function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NWS returned an invalid response.");
  return value as Json;
}
function properties(value: unknown): Json { return object(object(value).properties); }
export function parseForecast(value: unknown): Forecast {
  const p = properties(value);
  if (!Array.isArray(p.periods)) throw new Error("NWS forecast periods are unavailable.");
  return {updated:String(p.updateTime ?? p.generatedAt ?? ""), periods:p.periods.map((v: unknown) => {
    const row = object(v);
    return {name:String(row.name ?? ""),startTime:String(row.startTime ?? ""),endTime:String(row.endTime ?? ""),temperature:numberOrNull(row.temperature),temperatureUnit:String(row.temperatureUnit ?? ""),windSpeed:String(row.windSpeed ?? "Unavailable"),windDirection:String(row.windDirection ?? ""),shortForecast:String(row.shortForecast ?? ""),detailedForecast:String(row.detailedForecast ?? ""),precipitation:numberOrNull(row.probabilityOfPrecipitation?.value)};
  })};
}
export function parseAlerts(value: unknown): Alert[] {
  const root = object(value);
  if (!Array.isArray(root.features)) throw new Error("NWS alerts are unavailable.");
  return root.features.filter((v: Json) => v.properties?.status === "Actual" && v.properties?.messageType !== "Cancel").map((v: Json) => {
    const p = properties(v);
    return {id:String(v.id ?? p.id ?? ""),event:String(p.event ?? "Weather alert"),headline:String(p.headline ?? p.event ?? "Weather alert"),severity:String(p.severity ?? "Unknown"),sent:String(p.sent ?? ""),effective:String(p.effective ?? ""),expires:String(p.expires ?? ""),ends:String(p.ends ?? ""),description:String(p.description ?? ""),instruction:String(p.instruction ?? ""),source:apiUrl(v.id ?? p.id)};
  });
}

/** Portable, injected HTTP client; no Node APIs or hosted backend. */
export class NwsClient {
  private failures = new Map<string, {until:number; message:string}>();
  constructor(public cache: HttpCache, private transport: Transport, private clock: () => number = Date.now) {}
  async get(url: string, interval: number): Promise<CacheEntry> {
    url = apiUrl(url);
    const now = this.clock(), previous = this.cache[url], failure = this.failures.get(url);
    if (failure && failure.until > now) throw new Error(failure.message);
    if (previous && previous.expiresAt > now) return previous;
    const headers: Record<string,string> = {Accept:"application/geo+json", "User-Agent":"RedBeardWeather/1.0 (Obsidian; https://github.com/Red-Beard08/red-beard-weather)"};
    if (previous?.etag) headers["If-None-Match"] = previous.etag;
    if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
    try {
      const response = await this.transport(url, headers);
      const h = Object.fromEntries(Object.entries(response.headers).map(([k,v]) => [k.toLowerCase(),v]));
      if (response.status !== 304 && (response.status < 200 || response.status >= 300)) {
        const retry = Number(h["retry-after"]), date = Date.parse(h["retry-after"] ?? "");
        const delay = Number.isFinite(retry) ? retry * 1000 : Number.isFinite(date) ? date-now : MINUTE;
        const message = response.status === 429 ? "NWS rate limit; retrying later." : `NWS request failed (${response.status}); retrying later.`;
        this.failures.set(url,{until:now + Math.max(MINUTE, delay),message});
        throw new Error(message);
      }
      if (response.status === 304 && !previous) throw new Error("NWS returned an empty cached response.");
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(h["cache-control"] ?? "");
      const remaining = maxAge ? Math.max(0,Number(maxAge[1])*1000 - (Number(h.age)||0)*1000) : 0;
      const entry: CacheEntry = {data:response.status === 304 ? previous!.data : object(response.json), checkedAt:now, expiresAt:now + Math.max(interval, remaining), etag:h.etag ?? previous?.etag,lastModified:h["last-modified"] ?? previous?.lastModified};
      // Never persist content explicitly marked private/no-store.
      if (/no-store|private/i.test(h["cache-control"] ?? "")) throw new Error("NWS response could not be stored safely.");
      this.cache[url] = entry;
      this.failures.delete(url);
      return entry;
    } catch (error) {
      if (!this.failures.has(url)) this.failures.set(url,{until:now+MINUTE,message:error instanceof Error ? error.message : "NWS connection unavailable."});
      throw error;
    }
  }
}

export class WeatherService {
  state: WeatherState;
  private pending?: Promise<void>;
  constructor(public settings: WeatherSettings, public client: NwsClient, private clock: () => number = Date.now) {
    this.state = {locationKey:locationKey(settings),forecast:{},hourly:{},observation:{},alerts:{},refreshing:false};
  }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => {this.pending=undefined;});
    return this.pending;
  }
  private async feed<T>(previous: Feed<T>, url: string, interval: number, parse: (data: unknown) => T): Promise<Feed<T>> {
    try {
      const entry = await this.client.get(url,interval);
      return {data:parse(entry.data),checkedAt:entry.checkedAt,expiresAt:entry.expiresAt,source:url};
    } catch(error) {
      const cached=this.client.cache[url];
      let fallback=previous;
      if (!previous.data && cached) { try { fallback={data:parse(cached.data),checkedAt:cached.checkedAt,expiresAt:cached.expiresAt}; } catch { /* Invalid stored responses are never displayed. */ } }
      return {...fallback,source:url,error:error instanceof Error ? error.message : "NWS unavailable."};
    }
  }
  private async observations(stationsUrl: string): Promise<Feed<Observation>> {
    try {
      let metadata:unknown;
      try { metadata=(await this.client.get(stationsUrl,24*60*MINUTE)).data; }
      catch(error) {if(!this.client.cache[stationsUrl])throw error;metadata=this.client.cache[stationsUrl].data;}
      const stations = object(metadata);
      if (!Array.isArray(stations.features)) throw new Error("Nearby observation stations are unavailable.");
      let best: Feed<Observation> | undefined;
      for (const feature of stations.features.slice(0,3)) {
        const station = object(feature), props = properties(station);
        const source = `${apiUrl(station.id).replace(/\/$/,"")}/observations/latest`;
        const result = await this.feed<Observation>({},source,WEATHER_INTERVAL,value => {
          const p = properties(value);
          if (!Number.isFinite(Date.parse(p.timestamp)) || numberOrNull(p.temperature?.value) === null) throw new Error("Station has no recent temperature observation.");
          const t = numberOrNull(p.temperature?.value), w = numberOrNull(p.windSpeed?.value);
          const temperatureC = t === null ? null : p.temperature?.unitCode === "wmoUnit:degF" ? (t-32)*5/9 : t;
          const windKmh = w === null ? null : p.windSpeed?.unitCode === "wmoUnit:m_s-1" ? w*3.6 : p.windSpeed?.unitCode === "wmoUnit:kn" ? w*1.852 : w;
          return {station:String(props.stationIdentifier ?? ""),stationName:String(props.name ?? props.stationIdentifier ?? "Nearby station"),timestamp:String(p.timestamp),description:String(p.textDescription ?? ""),temperatureC,humidity:numberOrNull(p.relativeHumidity?.value),windKmh};
        });
        if (result.data && (!best?.data || Date.parse(result.data.timestamp) > Date.parse(best.data.timestamp))) best = result;
        if (best?.data && this.clock()-Date.parse(best.data.timestamp) < 2*60*MINUTE) return best;
      }
      if (best) return best;
      throw new Error("Nearby stations have no usable observations.");
    } catch(error) { return {...this.state.observation,error:error instanceof Error ? error.message : "Observation unavailable."}; }
  }
  private async run(): Promise<void> {
    this.state.refreshing = true;
    this.state.lastAttempt = this.clock();
    const point = `https://api.weather.gov/points/${this.settings.latitude.toFixed(4)},${this.settings.longitude.toFixed(4)}`;
    const alertUrl = `https://api.weather.gov/alerts/active?point=${this.settings.latitude.toFixed(4)},${this.settings.longitude.toFixed(4)}`;
    try {
      const forecastTask = (async () => {
        try {
          let metadata: unknown;
          try { metadata=(await this.client.get(point,24*60*MINUTE)).data; }
          catch(error) { if (!this.client.cache[point]) throw error; metadata=this.client.cache[point].data; }
          const p = properties(metadata);
          const suffix = `?units=${this.settings.units}`;
          const [forecast,hourly,observation] = await Promise.all([
            this.feed(this.state.forecast,apiUrl(p.forecast)+suffix,WEATHER_INTERVAL,parseForecast),
            this.feed(this.state.hourly,apiUrl(p.forecastHourly)+suffix,WEATHER_INTERVAL,parseForecast),
            this.observations(apiUrl(p.observationStations))
          ]);
          Object.assign(this.state,{forecast,hourly,observation});
        } catch (error) {
          const message = error instanceof Error ? error.message : "NWS location lookup failed.";
          for (const feed of [this.state.forecast,this.state.hourly,this.state.observation]) feed.error=message;
        }
      })();
      const alertTask = this.feed(this.state.alerts,alertUrl,ALERT_INTERVAL,parseAlerts).then(alerts => {this.state.alerts=alerts;});
      await Promise.all([forecastTask,alertTask]);
      if (this.state.alerts.data) this.state.alerts.data=activeAlerts(this.state.alerts.data,this.clock());
    } finally { this.state.refreshing = false; }
  }
}
