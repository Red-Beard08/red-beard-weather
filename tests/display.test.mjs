import test from "node:test";
import assert from "node:assert/strict";
import {Window} from "happy-dom";
import {load} from "./helpers.mjs";
const window=new Window();globalThis.document=window.document;
const make=function(tag,options={}){
  const element=document.createElement(tag);
  if(options.cls)element.className=options.cls;
  if(options.text!==undefined)element.textContent=options.text;
  for(const [key,value] of Object.entries(options.attr ?? {}))element.setAttribute(key,String(value));
  for(const key of ["href","title","type","value"])if(options[key]!==undefined)element.setAttribute(key,String(options[key]));
  this.appendChild(element);return element;
};
Object.assign(window.HTMLElement.prototype,{
  createEl:make,createDiv(options){return make.call(this,"div",options);},createSpan(options){return make.call(this,"span",options);},
  empty(){this.replaceChildren();},addClass(name){this.classList.add(name);},toggleClass(name,value){this.classList.toggle(name,value);}
});
const {renderWeather}=await load("src/dashboard.ts",true),{DEFAULT_SETTINGS}=await load("src/utils.ts");
const {default:WeatherPlugin}=await load("src/main.ts",true);
const now=Date.now(),iso=t=>new Date(t).toISOString();
function fixture(){
  const period={isDaytime:true,name:"Today",startTime:iso(now),endTime:iso(now+12*3600000),temperature:43,temperatureUnit:"F",windSpeed:"10 mph",windDirection:"W",shortForecast:"Sunny",detailedForecast:"Sunny through the afternoon.",precipitation:0};
  const feed=data=>({data,checkedAt:now,expiresAt:now+900000,source:"https://api.weather.gov/points/40.6936,-89.5890"});
  return {settings:{...DEFAULT_SETTINGS},service:{state:{locationKey:"test",refreshing:false,
    observation:feed({station:"KPIA",stationName:"Backend Airport Station",timestamp:iso(now-600000),description:"Clear",temperatureC:0,windKmh:0,humidity:0}),
    forecast:feed({updated:iso(now),periods:[period,{...period,isDaytime:false,name:"Tonight",startTime:iso(now+12*3600000),endTime:iso(now+20*3600000),temperature:24}]}),
    hourly:feed({updated:iso(now),periods:Array.from({length:25},(_,i)=>({...period,startTime:iso(now+i*3600000),endTime:iso(now+(i+1)*3600000),temperature:i===2 ? null : 30+i,precipitation:i===2 ? null : i*4}))}),alerts:feed([])}},refresh(){},openDashboard(){},saveSnapshot(){},openSettings(){}};
}
function target(){document.body.replaceChildren();const root=document.createElement("div");document.body.appendChild(root);return root;}
test("widget is a weather summary without provider diagnostics or operating explanations",()=>{
  const root=target(),plugin=fixture();renderWeather(root,plugin,true);
  assert.match(root.textContent,/32°F/);assert.match(root.textContent,/0 mph/);assert.match(root.textContent,/0%/);
  assert.equal(root.querySelectorAll(".rbw-hour").length,3);assert.equal(root.querySelectorAll(".rbw-actions").length,0);
  assert(!/Backend Airport|KPIA|checked|public domain|endorsement|Obsidian is running|snapshots do not update|HTTP/i.test(root.textContent));
  assert.equal(root.querySelectorAll("table").length,0);assert.match(root.textContent,/Observed/);
});
test("full view offers true chart data and text alternatives without a visible table",()=>{
  const root=target(),plugin=fixture();renderWeather(root,plugin);
  assert.equal(root.querySelectorAll("table").length,0);assert(root.querySelector("svg[role=img]"));
  assert.equal(root.querySelectorAll(".rbw-temp-line").length,2,"Missing sample must interrupt the temperature line");
  assert(root.querySelector(".rbw-sr-only").textContent.includes("Temperature unavailable"));
  assert(root.querySelector(".rbw-rain-missing"));assert.match(root.querySelector(".rbw-chart-legend").textContent,/chance unavailable/);
  assert(root.querySelector(".rbw-sources").textContent.includes("Backend Airport Station"));assert.equal(root.querySelector(".rbw-sources").open,false);
});
test("refresh preserves open forecast, keyboard focus, and horizontal/vertical position",()=>{
  const root=target(),plugin=fixture();renderWeather(root,plugin);
  root.querySelector(".rbw-day").open=true;root.scrollTop=150;root.querySelector(".rbw-hour-strip").scrollLeft=40;
  root.querySelector('[data-rbw-focus="refresh"]').focus();plugin.service.state.refreshing=true;renderWeather(root,plugin);
  assert.equal(root.querySelector(".rbw-day").open,true);assert.equal(document.activeElement.dataset.rbwFocus,"refresh");
  assert.equal(document.activeElement.getAttribute("aria-disabled"),"true");assert.equal(root.scrollTop,150);assert.equal(root.querySelector(".rbw-hour-strip").scrollLeft,40);
  const summary=root.querySelector(".rbw-day summary");summary.focus();const key=summary.dataset.rbwFocus;renderWeather(root,plugin);assert.equal(document.activeElement.dataset.rbwFocus,key);
  root.querySelector(".rbw-hour-strip").focus();renderWeather(root,plugin);assert.equal(document.activeElement.dataset.rbwFocus,"hourly-scroll");
  root.querySelector(".rbw-sources").open=true;const link=root.querySelector(".rbw-sources a");link.focus();const linkKey=link.dataset.rbwFocus;renderWeather(root,plugin);assert.equal(document.activeElement.dataset.rbwFocus,linkKey);
});
test("stale alerts never show all-clear or technical errors in widget",()=>{
  const root=target(),plugin=fixture();plugin.service.state.alerts={data:[],expiresAt:now-1,error:"HTTP 429 private debug details"};
  plugin.service.state.observation.expiresAt=now-1;renderWeather(root,plugin,true);
  assert.match(root.textContent,/Alerts unavailable/);assert.match(root.textContent,/Reading may be out of date/);assert(!/No active weather alerts|HTTP 429/.test(root.textContent));
});
test("severe alerts remain conspicuous and official text is rendered as text",()=>{
  const root=target(),plugin=fixture();plugin.service.state.alerts.data=[{id:"test",event:"Winter Storm Warning",headline:"Snow expected",severity:"Severe",sent:iso(now-1000),effective:iso(now-1000),expires:iso(now+3600000),ends:"",description:"<script>test()</script>\nHeavy snow.",instruction:"Avoid unnecessary travel.",source:"https://api.weather.gov/alerts/test"}];
  renderWeather(root,plugin,true);assert.match(root.querySelector(".rbw-warning-link").textContent,/Winter Storm Warning/);
  renderWeather(root,plugin);assert(root.querySelector(".rbw-alert-severe"));assert.equal(root.querySelectorAll("script").length,0);assert(root.querySelector(".rbw-official-text").textContent.includes("<script>"));
});
test("weather notifications update only connected weather widgets without rebuilding the host",()=>{
  const root=target(),plugin=new WeatherPlugin();Object.assign(plugin,fixture());let hostRefreshes=0;plugin.host={refreshViews(){hostRefreshes++;}};
  const disconnected=document.createElement("div");plugin.widgetContainers.add(root);plugin.widgetContainers.add(disconnected);plugin.notify();
  assert.equal(hostRefreshes,0);assert(root.querySelector(".rbw-temperature"));assert.equal(plugin.widgetContainers.size,1);
});
