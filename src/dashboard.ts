import { ItemView, type WorkspaceLeaf } from "obsidian";
import type WeatherPlugin from "./main";
import { hourStrip, smallIcon, temperatureChart, weatherIcon } from "./graphics";
import { dateKey, glanceModel, hourLabel } from "./presentation";
import { feedStatus, formatTime, temperature } from "./utils";
export const WEATHER_VIEW="red-beard-weather-view";

function action(parent:HTMLElement,label:string,icon:string,key:string,run:()=>void,iconOnly=false):HTMLButtonElement {
  const button=parent.createEl("button",{cls:`rbw-action${iconOnly ? " rbw-icon-action" : ""}`,attr:{"aria-label":label,title:label,"data-rbw-focus":key}});
  smallIcon(button,icon);if(!iconOnly)button.createSpan({text:label});button.onclick=run;return button;
}
function metric(parent:HTMLElement,label:string,value:string,icon:string):void {
  const item=parent.createDiv({cls:"rbw-metric",attr:{"aria-label":`${label}: ${value}`,title:`${label}: ${value}`}}),head=item.createDiv({cls:"rbw-metric-label"});smallIcon(head,icon);head.createSpan({text:label});item.createEl("strong",{text:value});
}
function disclosure(parent:HTMLElement,label:string,key:string):HTMLDetailsElement {
  const element=parent.createEl("details",{cls:"rbw-disclosure",attr:{"data-rbw-detail":key}});
  element.createEl("summary",{text:label,attr:{"data-rbw-focus":`detail-${key}`}});return element;
}
function announce(parent:HTMLElement,text:string):void {
  const line=parent.createDiv({cls:"rbw-notice",attr:{role:"status"}});smallIcon(line,"clock-3");line.createSpan({text});
}
function restoreInteraction(container:HTMLElement,open:Set<string>,focus:string|undefined,scroll:number,offsets:Map<string,number>):void {
  for(const element of Array.from(container.querySelectorAll<HTMLDetailsElement>("details[data-rbw-detail]")))element.open=open.has(element.dataset.rbwDetail!);
  for(const element of Array.from(container.querySelectorAll<HTMLElement>("[data-rbw-scroll]")))element.scrollLeft=offsets.get(element.dataset.rbwScroll!) ?? 0;
  if(focus)Array.from(container.querySelectorAll<HTMLElement>("[data-rbw-focus]")).find(el=>el.dataset.rbwFocus===focus)?.focus({preventScroll:true});
  container.scrollTop=scroll;
}
export function renderWeather(container:HTMLElement,plugin:WeatherPlugin,compact=false):void {
  const scroll=container.scrollTop,open=new Set(Array.from(container.querySelectorAll<HTMLDetailsElement>("details[open][data-rbw-detail]")).map(el=>el.dataset.rbwDetail!));
  const active=document.activeElement as HTMLElement|null,focus=active && container.contains(active) ? active.dataset.rbwFocus : undefined;
  const offsets=new Map(Array.from(container.querySelectorAll<HTMLElement>("[data-rbw-scroll]")).map(el=>[el.dataset.rbwScroll!,el.scrollLeft]));
  container.empty();container.addClass("rbw");container.toggleClass("rbw-compact",compact);
  const root=container.createDiv({cls:"rbw-body"}),{state}=plugin.service,s=plugin.settings,now=Date.now(),m=glanceModel(state,s,now),o=m.observation;
  const time=(value:string|number|undefined)=>formatTime(value,s.timeZone),sourceUrl=`https://forecast.weather.gov/MapClick.php?lat=${s.latitude}&lon=${s.longitude}`;
  const header=root.createDiv({cls:"rbw-header"});header.createEl(compact ? "h3" : "h1",{text:s.locationName});
  if(!compact){
    const controls=header.createDiv({cls:"rbw-actions"});
    const refresh=action(controls,state.refreshing ? "Refreshing weather" : "Refresh weather","refresh-cw","refresh",()=>{if(!state.refreshing)void plugin.refresh(true);},true);
    refresh.setAttribute("aria-disabled",String(state.refreshing));refresh.toggleClass("rbw-refreshing",state.refreshing);
    action(controls,"Save snapshot","file-plus","snapshot",()=>void plugin.saveSnapshot());action(controls,"Weather settings","settings","settings",()=>plugin.openSettings(),true);
  }
  if(m.alerts.length){
    const first=m.alerts[0];
    if(compact){const alert=action(root,`${first.event}${m.alerts.length>1 ? ` +${m.alerts.length-1}` : ""}`,"triangle-alert","open-alerts",()=>void plugin.openDashboard());alert.addClass("rbw-warning-link");alert.setAttribute("title",first.headline);}
    else {
      const section=root.createEl("section",{cls:"rbw-alert-list",attr:{"aria-label":"Weather alerts"}});
      for(const a of m.alerts){
        const details=disclosure(section,a.event,`alert-${a.id}`);details.addClass("rbw-alert");details.toggleClass("rbw-alert-severe",a.severity==="Extreme" || a.severity==="Severe");smallIcon(details.querySelector("summary")!,"triangle-alert");
        details.createEl("p",{text:a.headline});details.createEl("p",{cls:"rbw-muted",text:`${a.severity} · Until ${time(a.expires)}`});details.createEl("p",{cls:"rbw-official-text",text:a.description});if(a.instruction)details.createEl("p",{cls:"rbw-official-text",text:a.instruction});
        details.createEl("a",{text:"Official NWS alert",href:a.source,attr:{target:"_blank",rel:"noopener noreferrer"}});
      }
    }
  }
  const hero=root.createEl("section",{cls:"rbw-now",attr:{"aria-label":"Current conditions"}}),current=hero.createDiv({cls:"rbw-current-reading"});
  weatherIcon(current,m.hourly[0]?.isDaytime===undefined ? "" : o?.description ?? "",m.hourly[0]?.isDaytime ?? true,true);current.createDiv({cls:"rbw-temperature",text:o ? temperature(o.temperatureC,s.units) : "—"});
  const description=hero.createDiv({cls:"rbw-current-copy"});description.createEl("p",{cls:"rbw-condition",text:o?.description || (state.refreshing ? "Loading weather…" : "Conditions unavailable")});
  const today=m.daily.find(day=>day.key===dateKey(now,s.timeZone));
  if(today){const range=description.createDiv({cls:"rbw-today-range",attr:{"aria-label":"Today's available forecast high and low"}});range.createSpan({text:`High ${today.high===null ? "—" : `${today.high}°`}`});range.createSpan({text:`Low ${today.low===null ? "—" : `${today.low}°`}`});}
  if(o){description.createEl("p",{cls:`rbw-observed ${m.obsStatus==="Current" ? "" : "rbw-stale"}`,text:`Observed ${dateKey(o.timestamp,s.timeZone)===dateKey(now,s.timeZone) ? hourLabel(o.timestamp,s.timeZone,true) : time(o.timestamp)}`});if(m.obsStatus!=="Current")announce(hero,"Reading may be out of date.");}
  else if(!state.refreshing)announce(hero,"Current reading unavailable. Try Refresh.");
  if(m.forecastStatus!=="Current" && m.daily.length)announce(root,"Daily forecast may be out of date.");
  if(m.hourlyStatus!=="Current" && m.hourly.length)announce(root,"Hourly forecast may be out of date.");
  const metrics=root.createDiv({cls:"rbw-metrics"}),next=m.hourly[0];
  metric(metrics,"Wind",o?.windKmh===null || o?.windKmh===undefined ? "—" : `${Math.round(s.units==="us" ? o.windKmh/1.609344 : o.windKmh)} ${s.units==="us" ? "mph" : "km/h"}`,"wind");
  metric(metrics,"Hourly precip. chance",next?.precipitation===null || next?.precipitation===undefined ? "—" : `${next.precipitation}%`,"droplets");
  if(!compact)metric(metrics,"Humidity",o?.humidity===null || o?.humidity===undefined ? "—" : `${Math.round(o.humidity)}%`,"waves");
  const status=root.createDiv({cls:`rbw-alert-status ${m.alertStatus==="Current" ? "" : "rbw-stale"}`});smallIcon(status,m.alertStatus==="Current" ? (m.alerts.length ? "triangle-alert" : "shield-check") : "shield-question");
  status.createSpan({text:m.alertStatus!=="Current" ? (m.alerts.length ? "Alerts may be out of date" : "Alerts unavailable") : m.alerts.length ? `${m.alerts.length} active ${m.alerts.length===1 ? "alert" : "alerts"}` : "No active weather alerts"});
  if(compact){
    if(m.nextHours.length)hourStrip(root,m.nextHours,s.timeZone,true);else root.createEl("p",{cls:"rbw-muted",text:state.refreshing ? "Loading forecast…" : "Hourly forecast unavailable"});
    const footer=root.createDiv({cls:"rbw-widget-footer"});footer.createEl("a",{text:"NWS",href:sourceUrl,attr:{title:"National Weather Service forecast",target:"_blank",rel:"noopener noreferrer"}});action(footer,"Forecast","arrow-up-right","open-weather",()=>void plugin.openDashboard());
  } else {
    const hours=root.createEl("section",{cls:"rbw-hours"});hours.createEl("h2",{text:"Next 24 hours"});
    if(m.hourly.length){temperatureChart(hours,m.hourly,s.timeZone);hourStrip(hours,m.hourly.filter((_,i)=>i%3===0),s.timeZone);}else hours.createEl("p",{cls:"rbw-empty",text:state.refreshing ? "Loading the hourly outlook…" : "Hourly forecast unavailable. Try Refresh."});
    const week=root.createEl("section",{cls:"rbw-week"}),weekHeader=week.createDiv({cls:"rbw-section-header"});weekHeader.createEl("h2",{text:"Seven days"});weekHeader.createSpan({cls:"rbw-muted",text:`Low / high · °${s.units==="us" ? "F" : "C"}`});
    const temps=m.daily.flatMap(day=>[day.low,day.high].filter((v):v is number=>v!==null)),min=temps.length ? Math.min(...temps) : 0,max=temps.length ? Math.max(...temps) : 1;
    for(const day of m.daily){
      const details=disclosure(week,"",`day-${day.key}`);details.addClass("rbw-day");const summary=details.querySelector("summary")!;summary.setAttribute("aria-label",`${day.label}: ${day.condition}. Low ${day.low===null ? "unavailable" : `${day.low} degrees`}; high ${day.high===null ? "unavailable" : `${day.high} degrees`}. Expand forecast.`);
      summary.createSpan({cls:"rbw-day-label",text:day.label});weatherIcon(summary,day.condition,day.daytime);summary.createSpan({cls:"rbw-day-condition",text:day.condition});
      const range=summary.createSpan({cls:"rbw-day-range"});range.createSpan({cls:"rbw-day-low",text:day.low===null ? "—" : `${day.low}°`});const track=range.createSpan({cls:"rbw-range-track",attr:{"aria-hidden":"true"}});
      if(day.low!==null && day.high!==null){const bar=track.createSpan({cls:"rbw-range-value"}),left=(Math.min(day.low,day.high)-min)/Math.max(1,max-min)*100,width=Math.abs(day.high-day.low)/Math.max(1,max-min)*100;bar.style.left=`${Math.min(97,left)}%`;bar.style.width=`${Math.max(3,width)}%`;}
      range.createSpan({cls:"rbw-day-high",text:day.high===null ? "—" : `${day.high}°`});smallIcon(summary,"chevron-down");
      for(const p of day.periods){details.createEl("p",{text:`${p.name}: ${p.detailedForecast || p.shortForecast}`});details.createEl("p",{cls:"rbw-muted",text:`Wind ${p.windSpeed} ${p.windDirection} · Precipitation chance ${p.precipitation===null ? "unavailable" : `${p.precipitation}%`}`});}
    }
    if(!m.daily.length)week.createEl("p",{cls:"rbw-empty",text:state.refreshing ? "Loading the week ahead…" : "Daily forecast unavailable. Try Refresh."});
    const sources=disclosure(root,"Weather details & sources","sources");sources.addClass("rbw-sources");if(o)sources.createEl("p",{text:`Observation station: ${o.stationName} (${o.station}). Observed ${time(o.timestamp)}.`});
    for(const kind of ["observation","forecast","hourly","alerts"] as const){const f=state[kind];sources.createEl("p",{text:`${kind}: ${feedStatus(f,now,kind)}. Last checked ${time(f.checkedAt)}.`});if(f.source)sources.createEl("a",{cls:"rbw-source-link",text:`${kind} source`,href:f.source,attr:{target:"_blank",rel:"noopener noreferrer"}});}
    sources.createEl("p",{text:"Weather data: National Weather Service, public domain. Independently developed; no NOAA/NWS endorsement. Forecasts are predictions; station observations describe the named station."});root.createEl("a",{cls:"rbw-credit",text:"National Weather Service",href:sourceUrl,attr:{target:"_blank",rel:"noopener noreferrer"}});
  }
  Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]")).forEach((link,index)=>link.dataset.rbwFocus=`link-${index}-${link.getAttribute("href")}`);
  restoreInteraction(container,open,focus,scroll,offsets);
}
export class WeatherView extends ItemView {
  private unsubscribe?:()=>void;
  constructor(leaf:WorkspaceLeaf,private plugin:WeatherPlugin){super(leaf);}
  getViewType(){return WEATHER_VIEW;}
  getDisplayText(){return "Weather";}
  getIcon(){return "cloud-sun";}
  async onOpen(){this.unsubscribe=this.plugin.subscribe(()=>renderWeather(this.contentEl,this.plugin));renderWeather(this.contentEl,this.plugin);void this.plugin.refresh();}
  async onClose(){this.unsubscribe?.();this.contentEl.empty();}
}
