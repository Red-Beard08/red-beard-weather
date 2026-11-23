import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type WeatherPlugin from "./main";
import type { Feed } from "./types";
import { activeAlerts, currentPeriods, feedStatus, formatTime, temperature } from "./utils";
export const WEATHER_VIEW="red-beard-weather-view";

function action(parent: HTMLElement, label: string, icon: string, run: () => void, primary=false): HTMLButtonElement {
  const button=parent.createEl("button",{cls:primary ? "mod-cta" : "",attr:{"aria-label":label}});
  setIcon(button.createSpan({cls:"rbw-button-icon"}),icon);
  button.createSpan({text:label});button.onclick=run;return button;
}
export function renderWeather(container: HTMLElement, plugin: WeatherPlugin, compact=false): void {
  const scroll=container.scrollTop;
  container.empty();container.addClass("rbw");container.toggleClass("rbw-compact",compact);
  const {state}=plugin.service, s=plugin.settings, now=Date.now(), time=(v:string|number|undefined)=>formatTime(v,s.timeZone);
  const header=container.createDiv({cls:"rbw-header"}), title=header.createDiv();
  title.createEl(compact ? "h3" : "h1",{text:s.locationName});
  title.createEl("p",{cls:"rbw-muted",text:"National Weather Service"});
  const actions=header.createDiv({cls:"rbw-actions"});
  const refresh=action(actions,state.refreshing ? "Refreshing…" : "Refresh","refresh-cw",()=>void plugin.refresh(true));refresh.disabled=state.refreshing;
  if(compact) action(actions,"Open Weather","cloud-sun",()=>void plugin.openDashboard());
  else {
    action(actions,"New Weather Snapshot","file-plus",()=>void plugin.saveSnapshot(),true);
    action(actions,"Settings","settings",()=>plugin.openSettings());
  }
  const freshness=<T>(parent:HTMLElement,feed:Feed<T>,kind:"forecast"|"hourly"|"observation"|"alerts")=>{
    const status=feedStatus(feed,now,kind), line=parent.createEl("p",{cls:`rbw-freshness ${status === "Current" ? "" : "rbw-stale"}`,text:`${status} · Checked ${time(feed.checkedAt)}`});
    line.setAttribute("role","status");
  };
  const o=state.observation.data, current=container.createEl("section",{cls:"rbw-current",attr:{"aria-label":"Current observations"}});
  current.createDiv({cls:"rbw-temperature",text:o ? temperature(o.temperatureC,s.units) : "—"});
  const copy=current.createDiv();copy.createEl("p",{cls:"rbw-condition",text:o?.description || "Conditions unavailable"});
  if(o) {
    copy.createEl("p",{cls:"rbw-muted",text:`${o.stationName} (${o.station}) · Observed ${time(o.timestamp)}`});
    copy.createEl("p",{text:`Humidity ${o.humidity === null ? "unavailable" : `${Math.round(o.humidity)}%`} · Wind ${o.windKmh === null ? "unavailable" : `${Math.round(s.units === "us" ? o.windKmh/1.609344 : o.windKmh)} ${s.units === "us" ? "mph" : "km/h"}`}`});
  }
  freshness(copy,state.observation,"observation");
  const alertSection=container.createEl("section",{cls:"rbw-alerts"});
  const alerts=activeAlerts(state.alerts.data ?? [],now), alertStatus=feedStatus(state.alerts,now,"alerts");
  alertSection.createEl(compact ? "h4" : "h2",{text:`NWS alerts${alerts.length ? ` (${alerts.length})` : ""}`});
  if(!alerts.length) alertSection.createEl("p",{text:alertStatus === "Current" ? "No active NWS alerts at the last check." : "Alert status unavailable or stale. Check weather.gov for current alerts."});
  for(const a of alerts) {
    const details=alertSection.createEl("details",{cls:`rbw-alert rbw-severity-${a.severity.toLowerCase()}`});
    details.createEl("summary",{text:a.headline});
    details.createEl("p",{cls:"rbw-muted",text:`${a.severity} · Sent ${time(a.sent)} · Expires ${time(a.expires)}`});
    details.createEl("p",{cls:"rbw-official-text",text:a.description});
    if(a.instruction) details.createEl("p",{cls:"rbw-official-text",text:a.instruction});
    details.createEl("a",{text:"Official NWS alert",href:a.source,attr:{target:"_blank",rel:"noopener noreferrer"}});
  }
  freshness(alertSection,state.alerts,"alerts");
  if(compact) {
    const p=currentPeriods(state.forecast.data,now)[0];
    if(p) container.createEl("p",{text:`${p.name}: ${p.temperature ?? "—"}°${p.temperatureUnit} · ${p.shortForecast}`});
    freshness(container,state.forecast,"forecast");
  } else {
    const hourly=container.createEl("section");hourly.createEl("h2",{text:"Next 24 hours"});
    freshness(hourly,state.hourly,"hourly");
    const periods=currentPeriods(state.hourly.data,now,true);
    if(!periods.length) hourly.createEl("p",{text:"Hourly forecast unavailable for the current period."});
    else {
      const table=hourly.createEl("table",{cls:"rbw-table"});table.createEl("caption",{cls:"rbw-muted",text:`Issued ${time(state.hourly.data?.updated)} · ${s.timeZone}`});
      const head=table.createEl("thead").createEl("tr");for(const text of ["Time / weather","Temp","Wind","Rain / snow"]) head.createEl("th",{text,attr:{scope:"col"}});
      const body=table.createEl("tbody");
      for(const p of periods) {
        const row=body.createEl("tr"), first=row.createEl("th",{attr:{scope:"row"}});
        first.createDiv({text:new Intl.DateTimeFormat("en-US",{timeZone:s.timeZone,weekday:"short",hour:"numeric",timeZoneName:"short"}).format(new Date(p.startTime))});
        first.createDiv({cls:"rbw-muted",text:p.shortForecast});
        row.createEl("td",{text:p.temperature === null ? "—" : `${p.temperature}°${p.temperatureUnit}`});
        row.createEl("td",{text:`${p.windSpeed} ${p.windDirection}`});
        row.createEl("td",{text:p.precipitation === null ? "—" : `${p.precipitation}%`});
      }
    }
    const forecast=container.createEl("section");forecast.createEl("h2",{text:"Seven-day forecast"});
    forecast.createEl("p",{cls:"rbw-muted",text:`Issued ${time(state.forecast.data?.updated)}`});freshness(forecast,state.forecast,"forecast");
    const daily=currentPeriods(state.forecast.data,now);
    if(!daily.length) forecast.createEl("p",{text:"Forecast unavailable for the current period."});
    for(const p of daily) {
      const details=forecast.createEl("details",{cls:"rbw-period"}), summary=details.createEl("summary");
      summary.createSpan({cls:"rbw-period-name",text:p.name});summary.createSpan({cls:"rbw-period-temp",text:p.temperature === null ? "—" : `${p.temperature}°${p.temperatureUnit}`});summary.createSpan({text:p.shortForecast});
      details.createEl("p",{text:p.detailedForecast || p.shortForecast});
      details.createEl("p",{cls:"rbw-muted",text:`Wind ${p.windSpeed} ${p.windDirection} · Rain/snow chance ${p.precipitation === null ? "unavailable" : `${p.precipitation}%`}`});
    }
  }
  const footer=container.createEl("footer",{cls:"rbw-footer rbw-muted"});
  footer.createEl("a",{text:"Weather data: NWS · public domain",href:`https://forecast.weather.gov/MapClick.php?lat=${s.latitude}&lon=${s.longitude}`,attr:{target:"_blank",rel:"noopener noreferrer"}});
  footer.createEl("p",{text:"Independent add-on; no NOAA/NWS endorsement. Updates while Obsidian is running. Saved snapshots do not update."});
  container.scrollTop=scroll;
}

export class WeatherView extends ItemView {
  private unsubscribe?:()=>void;
  constructor(leaf: WorkspaceLeaf,private plugin: WeatherPlugin) {super(leaf);}
  getViewType(){return WEATHER_VIEW;}
  getDisplayText(){return "Weather";}
  getIcon(){return "cloud-sun";}
  async onOpen(){this.unsubscribe=this.plugin.subscribe(()=>renderWeather(this.contentEl,this.plugin));renderWeather(this.contentEl,this.plugin);void this.plugin.refresh();}
  async onClose(){this.unsubscribe?.();this.contentEl.empty();}
}
