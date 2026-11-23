import type { Period, WeatherState, WeatherSettings } from "./types";
import { activeAlerts, currentPeriods, feedStatus } from "./utils";

export type WeatherTone = "sun" | "cloud" | "rain" | "snow" | "storm";
export interface ConditionVisual { icon: string; tone: WeatherTone }
export function conditionVisual(text: string, daytime=true): ConditionVisual {
  const t=text.toLowerCase();
  if(/thunder|t-storm/.test(t)) return {icon:"cloud-lightning",tone:"storm"};
  if(/snow|flurr|sleet|ice|freezing/.test(t)) return {icon:"cloud-snow",tone:"snow"};
  if(/rain|shower|drizzle/.test(t)) return {icon:"cloud-rain",tone:"rain"};
  if(/fog|mist|haze|smoke/.test(t)) return {icon:"cloud-fog",tone:"cloud"};
  if(/partly|mostly (?:sunny|clear)|few clouds/.test(t)) return {icon:daytime ? "cloud-sun" : "cloud-moon",tone:"sun"};
  if(/cloud|overcast/.test(t)) return {icon:"cloud",tone:"cloud"};
  if(/sun|clear|fair/.test(t)) return {icon:daytime ? "sun" : "moon",tone:"sun"};
  return {icon:"circle-help",tone:"cloud"};
}
export function dateKey(value: string|number, zone: string): string {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "";
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");
}
export function hourLabel(value: string|number, zone: string, minutes=false): string {
  return new Intl.DateTimeFormat("en-US",{timeZone:zone,hour:"numeric",...(minutes ? {minute:"2-digit" as const} : {})}).format(new Date(value));
}
export function isDaytime(period: Period): boolean {
  return period.isDaytime ?? !/night|overnight/i.test(period.name);
}
export interface DailyOutlook {
  key:string; label:string; high:number|null; low:number|null; condition:string;
  precipitation:number|null; daytime:boolean; periods:Period[];
}
export function dailyOutlook(periods: Period[], zone: string, now: number): DailyOutlook[] {
  const today=dateKey(now,zone), days=new Map<string,DailyOutlook>();
  for(const p of periods) {
    const date=dateKey(p.startTime,zone);
    if(!date)continue;
    const key=date<today ? today : date;
    let day=days.get(key);
    if(!day){day={key,label:key===today ? "Today" : new Intl.DateTimeFormat("en-US",{timeZone:zone,weekday:"short"}).format(new Date(p.startTime)),high:null,low:null,condition:p.shortForecast,precipitation:p.precipitation,daytime:isDaytime(p),periods:[]};days.set(key,day);}
    day.periods.push(p);
    if(isDaytime(p)) {
      day.high=p.temperature;day.condition=p.shortForecast;day.precipitation=p.precipitation;day.daytime=true;
    } else if(p.temperature!==null) day.low=day.low===null ? p.temperature : Math.min(day.low,p.temperature);
  }
  return [...days.values()].sort((a,b)=>a.key.localeCompare(b.key)).slice(0,7);
}
export interface ChartPoint { x:number; y:number|null; rainY:number|null; period:Period }
export function chartPoints(periods:Period[]):{points:ChartPoint[];low:number|null;high:number|null;segments:string[]} {
  const temperatures=periods.flatMap(p=>p.temperature===null ? [] : [p.temperature]);
  const low=temperatures.length ? Math.min(...temperatures) : null, high=temperatures.length ? Math.max(...temperatures) : null;
  const span=Math.max(1,(high ?? 0)-(low ?? 0));
  const points=periods.map((period,i)=>({period,x:72+i*588/Math.max(1,periods.length-1),y:period.temperature===null ? null : high===low ? 62 : 28+((high ?? 0)-period.temperature)*68/span,rainY:period.precipitation===null ? null : 158-Math.max(0,Math.min(100,period.precipitation))*0.4}));
  const segments:string[]=[];let current:string[]=[];
  for(const point of points){if(point.y===null){if(current.length)segments.push(current.join(" "));current=[];}else current.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);}
  if(current.length)segments.push(current.join(" "));
  return {points,low,high,segments};
}
export function glanceModel(state:WeatherState,s:WeatherSettings,now:number){
  const hourly=currentPeriods(state.hourly.data,now,true), daily=dailyOutlook(currentPeriods(state.forecast.data,now),s.timeZone,now);
  const nextHours=hourly.filter(p=>Date.parse(p.startTime)>=now).slice(0,3);
  const observation=state.observation.data, obsStatus=feedStatus(state.observation,now,"observation");
  const alertStatus=feedStatus(state.alerts,now,"alerts"), alerts=activeAlerts(state.alerts.data ?? [],now).sort((a,b)=>severityRank(a.severity)-severityRank(b.severity));
  return {hourly,daily,nextHours,observation,obsStatus,alertStatus,alerts,forecastStatus:feedStatus(state.forecast,now,"forecast"),hourlyStatus:feedStatus(state.hourly,now,"hourly"),visual:conditionVisual(observation?.description ?? "",hourly[0] ? isDaytime(hourly[0]) : true)};
}
function severityRank(severity:string):number {return ["Extreme","Severe","Moderate","Minor","Unknown"].indexOf(severity)<0 ? 4 : ["Extreme","Severe","Moderate","Minor","Unknown"].indexOf(severity);}
