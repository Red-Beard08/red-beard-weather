import { setIcon } from "obsidian";
import type { Period } from "./types";
import { chartPoints, conditionVisual, hourLabel, isDaytime } from "./presentation";

export function weatherIcon(parent:HTMLElement,text:string,daytime=true,large=false):HTMLElement {
  const visual=conditionVisual(text,daytime);
  const icon=parent.createSpan({cls:`rbw-sky rbw-tone-${visual.tone}${large ? " rbw-sky-large" : ""}`,attr:{"aria-hidden":"true"}});
  setIcon(icon,visual.icon);return icon;
}
export function smallIcon(parent:HTMLElement,name:string):void {setIcon(parent.createSpan({cls:"rbw-small-icon",attr:{"aria-hidden":"true"}}),name);}
const NS="http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(parent:Element,tag:K,attributes:Record<string,string>,text?:string):SVGElementTagNameMap[K]{
  const element=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  if(text!==undefined)element.textContent=text;
  parent.appendChild(element);return element;
}
export function temperatureChart(parent:HTMLElement,periods:Period[],zone:string):void {
  const chart=chartPoints(periods), units=periods.find(p=>p.temperature!==null)?.temperatureUnit ?? "";
  const figure=parent.createEl("figure",{cls:"rbw-chart"});
  const graphic=svg(figure,"svg",{viewBox:"0 0 700 190",role:"img","aria-label":`24-hour forecast. Temperature ${chart.low===null ? "unavailable" : `${chart.low} to ${chart.high} degrees ${units}`}. Blue bars show precipitation chance on a zero to one hundred percent scale. Exact values follow in reading order.`});
  if(chart.high!==null){svg(graphic,"text",{x:"0",y:"24",class:"rbw-chart-label"},`${chart.high}°`);svg(graphic,"text",{x:"0",y:"99",class:"rbw-chart-label"},`${chart.low}°`);}
  svg(graphic,"line",{x1:"72",x2:"660",y1:"106",y2:"106",class:"rbw-chart-rule"});
  svg(graphic,"text",{x:"0",y:"120",class:"rbw-chart-label"},"100%");svg(graphic,"text",{x:"0",y:"159",class:"rbw-chart-label"},"0%");
  for(const point of chart.points){
    const p=point.period,label=`${hourLabel(p.startTime,zone)}: ${p.temperature===null ? "temperature unavailable" : `${p.temperature}°${p.temperatureUnit}`}, ${p.precipitation===null ? "precipitation chance unavailable" : `${p.precipitation}% precipitation chance`}, ${p.shortForecast}`;
    if(point.rainY!==null){const bar=svg(graphic,"rect",{x:String(point.x-5),y:String(point.rainY),width:"10",height:String(158-point.rainY),rx:"2",class:"rbw-rain-bar"});svg(bar,"title",{},label);}
    else {const missing=svg(graphic,"text",{x:String(point.x),y:"152","text-anchor":"middle",class:"rbw-rain-missing"},"?");svg(missing,"title",{},label);}
    if(point.y!==null){const dot=svg(graphic,"circle",{cx:String(point.x),cy:String(point.y),r:"2.5",class:"rbw-temp-dot"});svg(dot,"title",{},label);}
  }
  for(const points of chart.segments)svg(graphic,"polyline",{points,class:"rbw-temp-line",fill:"none","stroke-width":"3","stroke-linejoin":"round","stroke-linecap":"round"});
  const ticks=[0,Math.floor((periods.length-1)/3),Math.floor(2*(periods.length-1)/3),periods.length-1];
  for(const i of [...new Set(ticks)])if(chart.points[i])svg(graphic,"text",{x:String(chart.points[i].x),y:"183","text-anchor":"middle",class:"rbw-chart-label"},hourLabel(periods[i].startTime,zone));
  const caption=figure.createEl("figcaption",{cls:"rbw-chart-legend"});
  const temp=caption.createSpan();smallIcon(temp,"thermometer");temp.createSpan({text:`Temperature (°${units || "—"})`});
  const rain=caption.createSpan();smallIcon(rain,"droplets");rain.createSpan({text:"Precipitation chance (%)"});
  if(periods.some(p=>p.precipitation===null))caption.createSpan({text:"? = chance unavailable"});
  const accessible=figure.createEl("ul",{cls:"rbw-sr-only"});
  for(const p of periods)accessible.createEl("li",{text:`${hourLabel(p.startTime,zone)}: ${p.shortForecast}. ${p.temperature===null ? "Temperature unavailable" : `${p.temperature} degrees ${p.temperatureUnit}`}. ${p.precipitation===null ? "Precipitation chance unavailable" : `Precipitation chance ${p.precipitation}%`}. Wind ${p.windSpeed} ${p.windDirection}.`});
}
export function hourStrip(parent:HTMLElement,periods:Period[],zone:string,compact=false):void {
  const strip=parent.createDiv({cls:compact ? "rbw-hour-strip rbw-mini-hours" : "rbw-hour-strip",attr:{"aria-label":"Hourly forecast","data-rbw-scroll":"hours"}});
  if(!compact){strip.tabIndex=0;strip.setAttribute("role","region");strip.setAttribute("data-rbw-focus","hourly-scroll");}
  for(const p of periods){
    const item=strip.createDiv({cls:"rbw-hour",attr:{"aria-label":`${hourLabel(p.startTime,zone)}, ${p.shortForecast}`}});
    item.createSpan({cls:"rbw-hour-time",text:hourLabel(p.startTime,zone)});weatherIcon(item,p.shortForecast,isDaytime(p));item.createEl("strong",{text:p.temperature===null ? "—" : `${p.temperature}°`});
    if(!compact)item.createSpan({cls:"rbw-hour-rain",text:p.precipitation===null ? "—" : `${p.precipitation}%`,attr:{"aria-label":p.precipitation===null ? "Precipitation chance unavailable" : `Precipitation chance ${p.precipitation}%`}});
  }
}
