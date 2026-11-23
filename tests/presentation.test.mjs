import test from "node:test";
import assert from "node:assert/strict";
import {load} from "./helpers.mjs";
const {conditionVisual,dailyOutlook,chartPoints,glanceModel,dateKey}=await load("src/presentation.ts");
const {DEFAULT_SETTINGS}=await load("src/utils.ts");
const now=Date.parse("2026-11-23T18:00:00Z"),zone="America/Chicago";
const period=(overrides={})=>({name:"Today",startTime:"2026-11-23T12:00:00-06:00",endTime:"2026-11-23T18:00:00-06:00",temperature:43,temperatureUnit:"F",windSpeed:"10 mph",windDirection:"W",shortForecast:"Sunny",detailedForecast:"Sunny.",precipitation:0,isDaytime:true,...overrides});
test("condition icons distinguish day/night and severe mixed weather",()=>{
  assert.equal(conditionVisual("Clear",false).icon,"moon");assert.equal(conditionVisual("Mostly Cloudy").icon,"cloud");
  assert.equal(conditionVisual("Partly Cloudy",false).icon,"cloud-moon");assert.equal(conditionVisual("Snow and Rain").tone,"snow");assert.equal(conditionVisual("Thunderstorms likely").tone,"storm");assert.equal(conditionVisual("").icon,"circle-help");
});
test("daily ranges pair local daytime highs and following night lows without inventing values",()=>{
  const periods=[period(),period({name:"Tonight",isDaytime:false,startTime:"2026-11-23T18:00:00-06:00",endTime:"2026-11-24T06:00:00-06:00",temperature:24}),period({name:"Tuesday",startTime:"2026-11-24T06:00:00-06:00",endTime:"2026-11-24T18:00:00-06:00",temperature:0,precipitation:null})];
  const days=dailyOutlook(periods,zone,now);assert.equal(days.length,2);assert.equal(days[0].label,"Today");assert.equal(days[0].high,43);assert.equal(days[0].low,24);assert.equal(days[1].high,0);assert.equal(days[1].low,null);assert.equal(days[1].precipitation,null);
  assert.equal(dateKey("2026-11-24T02:00:00Z",zone),"2026-11-23");
  const tonight=dailyOutlook([period({name:"Tonight",isDaytime:false,shortForecast:"Clear"})],zone,now)[0];assert.equal(tonight.daytime,false);assert.equal(conditionVisual(tonight.condition,tonight.daytime).icon,"moon");
});
test("chart uses true samples, breaks unknown temperatures, and keeps unknown precipitation distinct from zero",()=>{
  const c=chartPoints([period({temperature:0,precipitation:0}),period({temperature:null,precipitation:null}),period({temperature:-10,precipitation:100})]);
  assert.equal(c.low,-10);assert.equal(c.high,0);assert.equal(c.segments.length,2);assert.equal(c.points[1].y,null);assert.equal(c.points[1].rainY,null);assert.equal(c.points[0].rainY,158);assert.equal(c.points[2].rainY,118);
  assert.equal(c.points[0].y,28);assert.equal(c.points[2].y,96);
  assert(chartPoints([period({temperature:0}),period({temperature:0})]).points.every(p=>Number.isFinite(p.y)));
  assert.deepEqual(chartPoints([]).segments,[]);
});
test("glance model uses upcoming hours, excludes expired alerts, and keeps stale alerts uncertain",()=>{
  const feed=data=>({data,checkedAt:now,expiresAt:now+60000});
  const hourly=[0,1,2,3,4].map(i=>period({name:"",startTime:new Date(now+(i-.5)*3600000).toISOString(),endTime:new Date(now+(i+.5)*3600000).toISOString()}));
  const state={locationKey:"",refreshing:false,forecast:feed({updated:new Date(now).toISOString(),periods:[period()]}),hourly:feed({updated:new Date(now).toISOString(),periods:hourly}),observation:{},alerts:{data:[],expiresAt:now-1,error:"offline"}};
  const m=glanceModel(state,DEFAULT_SETTINGS,now);assert.equal(m.nextHours.length,3);assert(Date.parse(m.nextHours[0].startTime)>now);assert.notEqual(m.alertStatus,"Current");assert.equal(m.daily[0].low,null);
});
