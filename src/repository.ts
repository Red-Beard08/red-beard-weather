import { normalizePath, stringifyYaml, type TFile, type Vault } from "obsidian";
import type { WeatherSettings, WeatherState } from "./types";
import { activeAlerts, currentPeriods, feedStatus, formatTime, markdownText, safeFolder, temperature } from "./utils";

export function snapshotBody(state: WeatherState, settings: WeatherSettings, now: number, id: string): string {
  if (![state.forecast.data,state.hourly.data,state.observation.data,state.alerts.data].some(Boolean)) throw new Error("No weather data is available to save. Open Weather and refresh first.");
  const q=markdownText, time=(v: string | number | undefined) => formatTime(v,settings.timeZone);
  const frontmatter={type:"weather-snapshot",schema_version:1,id,created:new Date(now).toISOString(),updated:new Date(now).toISOString(),status:"saved",weather_location:settings.locationName,weather_latitude:settings.latitude,weather_longitude:settings.longitude,weather_units:settings.units,weather_time_zone:settings.timeZone,weather_observed_at:state.observation.data?.timestamp ?? null,weather_forecast_issued_at:state.forecast.data?.updated ?? null,tags:["weather","output"]};
  const lines=["---",stringifyYaml(frontmatter).trimEnd(),"---","",`# Weather — ${q(settings.locationName)}`,"",`Saved ${time(now)}.`,"","## Conditions",""];
  const o=state.observation.data;
  lines.push(o ? `${temperature(o.temperatureC,settings.units)} — ${q(o.description)}. Station: ${q(o.stationName)} (${q(o.station)}). Observed ${time(o.timestamp)}.` : "Conditions unavailable.");
  for(const [kind,title] of [["forecast","Seven-day forecast"],["hourly","Next 24 hours"]] as const) {
    const feed=state[kind];
    lines.push("",`## ${title}`,"",`Issued ${time(feed.data?.updated)}.`,"");
    for(const p of currentPeriods(feed.data,now,kind==="hourly")) lines.push(`- **${q(p.name || time(p.startTime))} · ${p.temperature ?? "Unavailable"}${p.temperature === null ? "" : `°${q(p.temperatureUnit)}`}** — ${q(p.detailedForecast || p.shortForecast)} Wind: ${q(p.windSpeed)} ${q(p.windDirection)}. Rain/snow chance: ${p.precipitation === null ? "Unavailable" : `${p.precipitation}%`}.`);
    if(!currentPeriods(feed.data,now,kind==="hourly").length) lines.push("Forecast unavailable for the current period.");
  }
  lines.push("","## NWS alerts","");
  const alerts=activeAlerts(state.alerts.data ?? [],now), status=feedStatus(state.alerts,now,"alerts");
  if(!alerts.length) lines.push(status === "Current" ? "No active NWS alerts at the last check." : "Alert status unavailable or stale; an empty cached list does not confirm that there are no active alerts.");
  for(const a of alerts) lines.push(`### ${q(a.headline)}`,"",`Severity: ${q(a.severity)}. Sent ${time(a.sent)}. Expires ${time(a.expires)}.`,"",q(a.description),"",q(a.instruction),"",`[Official NWS alert](${a.source})`,"");
  lines.push("","## Sources and freshness","");
  for(const kind of ["observation","forecast","hourly","alerts"] as const) {
    const f=state[kind];
    lines.push(`- ${kind}: ${q(feedStatus(f,now,kind))}. Checked ${time(f.checkedAt)}.${f.source ? ` [NWS data](${f.source})` : ""}`);
  }
  lines.push("","Weather data: National Weather Service, public domain. Red-Beard Weather is independently developed and is not endorsed by NOAA/NWS. This snapshot records data available when saved; alerts are not updated in saved notes.","","## My notes","","");
  return lines.join("\n");
}

export async function createSnapshot(vault: Vault, settings: WeatherSettings, state: WeatherState, now=Date.now()): Promise<TFile> {
  const id=`weather-${crypto.randomUUID()}`;
  const body=snapshotBody(state,settings,now,id);
  const folder=safeFolder(settings.snapshotFolder);
  let parent="";
  for(const segment of folder.split("/")) {
    parent=parent ? `${parent}/${segment}` : segment;
    if(!vault.getAbstractFileByPath(parent)) {
      try { await vault.createFolder(parent); }
      catch(error) { if(!vault.getAbstractFileByPath(parent)) throw error; }
    }
  }
  const stamp=new Date(now).toISOString().replace(/[:.]/g,"-");
  const path=normalizePath(`${folder}/weather-${stamp}-${id.slice(-8)}.md`);
  // Creation only: existing snapshots and user notes are never overwritten.
  return vault.create(path,body);
}
