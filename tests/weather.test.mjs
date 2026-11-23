import test from "node:test";
import assert from "node:assert/strict";
import {load} from "./helpers.mjs";
const {NwsClient,WeatherService,parseAlerts}=await load("src/provider.ts"), utils=await load("src/utils.ts");
const {snapshotBody,createSnapshot}=await load("src/repository.ts",true);
const {DEFAULT_SETTINGS,WEATHER_INTERVAL,ALERT_INTERVAL,MINUTE}=utils;
const now=Date.parse("2026-11-23T18:00:00Z");
const origin="https://api.weather.gov",point=`${origin}/points/40.6936,-89.5890`, forecast=`${origin}/gridpoints/ILX/48,97/forecast`,stations=`${origin}/gridpoints/ILX/48,97/stations`, station=`${origin}/stations/KPIA`,alerts=`${origin}/alerts/active?point=40.6936,-89.5890`;
const fc={properties:{updateTime:"2026-11-23T17:00:00Z",periods:[{name:"Today",startTime:"2026-11-23T18:00:00Z",endTime:"2026-11-24T00:00:00Z",temperature:45,temperatureUnit:"F",windSpeed:"10 mph",windDirection:"W",shortForecast:"Sunny",detailedForecast:"Sunny.",probabilityOfPrecipitation:{value:null}}]}};
const fixtures={
  [point]:{properties:{forecast,forecastHourly:forecast+"/hourly",observationStations:stations}},
  [forecast+"?units=us"]:fc,[forecast+"/hourly?units=us"]:fc,
  [stations]:{features:[{id:station,properties:{stationIdentifier:"KPIA",name:"Peoria International Airport"}}]},
  [station+"/observations/latest"]:{properties:{timestamp:"2026-11-23T17:54:00Z",textDescription:"Fair",temperature:{value:7,unitCode:"wmoUnit:degC"},relativeHumidity:{value:null},windSpeed:{value:10,unitCode:"wmoUnit:km_h-1"}}},
  [alerts]:{features:[]}
};
function fakeTransport(data=fixtures){const calls=[];const fn=async(url,headers)=>{calls.push({url,headers});if(!data[url])throw new Error("offline");return {status:200,headers:{},json:structuredClone(data[url])};};return {calls,fn};}
test("Peoria discovery, independent feeds, exact intervals, and request identity",async()=>{
  let time=now;const fake=fakeTransport(),client=new NwsClient({},fake.fn,()=>time),service=new WeatherService(DEFAULT_SETTINGS,client,()=>time);
  await service.refresh();assert.equal(service.state.observation.data.station,"KPIA");assert.equal(service.state.forecast.data.periods[0].temperature,45);assert.deepEqual(service.state.alerts.data,[]);
  assert(fake.calls.every(c=>c.headers["User-Agent"].includes("RedBeardWeather")));assert.equal(fake.calls.length,6);
  await service.refresh();assert.equal(fake.calls.length,6);
  time+=ALERT_INTERVAL;await service.refresh();assert.equal(fake.calls.length,7);assert.equal(fake.calls.at(-1).url,alerts);
  time=now+WEATHER_INTERVAL;await service.refresh();assert.equal(fake.calls.filter(c=>c.url===forecast+"?units=us").length,2);
});
test("HTTP cache honors max-age and conditional 304 without discarding data",async()=>{
  let time=now,calls=0;const client=new NwsClient({},async(_url,headers)=>{
    calls++;if(calls===2){assert.equal(headers["If-None-Match"],"tag");return {status:304,headers:{},json:undefined};}
    return {status:200,headers:{"Cache-Control":"public, max-age=1800",ETag:"tag"},json:{hello:true}};
  },()=>time);
  const first=await client.get(forecast,WEATHER_INTERVAL);time+=16*MINUTE;await client.get(forecast,WEATHER_INTERVAL);assert.equal(calls,1);
  time=now+31*MINUTE;const second=await client.get(forecast,WEATHER_INTERVAL);assert.deepEqual(second.data,first.data);assert.equal(second.checkedAt,time);
});
test("429 Retry-After survives manual refresh; provider URLs are restricted",async()=>{
  let time=now,calls=0;const client=new NwsClient({},async()=>{calls++;return {status:429,headers:{"Retry-After":"600"},json:undefined};},()=>time);
  await assert.rejects(()=>client.get(forecast,MINUTE),/rate limit/);time+=5*MINUTE;await assert.rejects(()=>client.get(forecast,MINUTE),/rate limit/);assert.equal(calls,1);
  time+=6*MINUTE;await assert.rejects(()=>client.get(forecast,MINUTE));assert.equal(calls,2);
  await assert.rejects(()=>client.get("https://example.com/private",MINUTE),/unexpected/);
});
test("cached weather survives offline restart and alerts never claim all clear",async()=>{
  const fake=fakeTransport(),client=new NwsClient({},fake.fn,()=>now),service=new WeatherService(DEFAULT_SETTINGS,client,()=>now);await service.refresh();
  const later=now+25*60*MINUTE;
  const offline=new WeatherService(DEFAULT_SETTINGS,new NwsClient(structuredClone(client.cache),async()=>{throw new Error("offline");},()=>later),()=>later);
  await offline.refresh();assert.equal(offline.state.forecast.data.periods[0].temperature,45);assert.equal(offline.state.observation.data.station,"KPIA");assert(offline.state.alerts.error);
  const body=snapshotBody(offline.state,DEFAULT_SETTINGS,later,"test");assert.match(body,/Alert status unavailable or stale/);assert(!body.includes("No active NWS alerts at the last check."));assert(body.includes("Stale cached data"));
});
test("a failed point lookup still permits independent alert retrieval",async()=>{
  const fake=fakeTransport({[alerts]:{features:[]}}),service=new WeatherService(DEFAULT_SETTINGS,new NwsClient({},fake.fn,()=>now),()=>now);
  await service.refresh();assert(service.state.forecast.error);assert.deepEqual(service.state.alerts.data,[]);assert.equal(utils.feedStatus(service.state.alerts,now,"alerts"),"Current");
});
test("null observations fall through to another station without becoming zero",async()=>{
  const second=`${origin}/stations/KAAA`,data=structuredClone(fixtures);
  data[stations].features.push({id:second,properties:{stationIdentifier:"KAAA",name:"Alternate"}});
  data[station+"/observations/latest"].properties.temperature.value=null;
  data[second+"/observations/latest"]={properties:{timestamp:"2026-11-23T17:50:00Z",temperature:{value:5},relativeHumidity:{value:null},windSpeed:{value:null}}};
  const service=new WeatherService(DEFAULT_SETTINGS,new NwsClient({},fakeTransport(data).fn,()=>now),()=>now);await service.refresh();
  assert.equal(service.state.observation.data.station,"KAAA");assert.equal(service.state.observation.data.humidity,null);assert.equal(service.state.observation.data.windKmh,null);
});
test("alerts expire at expiry/end and forecast excludes elapsed periods",()=>{
  const base={expires:"2026-11-23T19:00:00Z",ends:""};
  assert.equal(utils.activeAlerts([base,{...base,expires:"2026-11-23T17:00:00Z"},{...base,ends:"2026-11-23T17:59:00Z"}],now).length,1);
  assert.equal(utils.currentPeriods({periods:[{endTime:"2026-11-23T17:00:00Z"},{endTime:"2026-11-24T00:00:00Z"}]},now).length,1);
});
test("official alert wording is preserved and test/cancel messages are excluded",()=>{
  const warning={id:`${origin}/alerts/example`,properties:{status:"Actual",messageType:"Alert",event:"Winter Storm Warning",headline:"Warning for Peoria",severity:"Severe",sent:"2026-11-23T17:00:00Z",effective:"2026-11-23T17:00:00Z",expires:"2026-11-23T19:00:00Z",description:"* WHAT...Heavy snow.\n* WHERE...Peoria County.",instruction:"Travel only if necessary."}};
  const parsed=parseAlerts({features:[warning,{...warning,properties:{...warning.properties,status:"Test"}},{...warning,properties:{...warning.properties,messageType:"Cancel"}}]});
  assert.equal(parsed.length,1);assert.equal(parsed[0].description,warning.properties.description);assert.equal(parsed[0].instruction,warning.properties.instruction);assert.equal(parsed[0].source,warning.id);
});
test("Chicago DST repeated hours retain distinct time zone labels",()=>{
  assert.match(utils.formatTime("2026-11-01T06:30:00Z","America/Chicago"),/CDT/);
  assert.match(utils.formatTime("2026-11-01T07:30:00Z","America/Chicago"),/CST/);
});
test("snapshot is creation-only, collision safe, and retains user notes",async()=>{
  const service=new WeatherService(DEFAULT_SETTINGS,new NwsClient({},fakeTransport().fn,()=>now),()=>now);await service.refresh();
  const files=new Map([["Weather/Snapshots/existing.md","My private notes"]]);
  const vault={getAbstractFileByPath:p=>files.has(p)?{path:p}:null,createFolder:async p=>{files.set(p,"");},create:async(p,content)=>{assert(!files.has(p));files.set(p,content);return {path:p};}};
  const first=await createSnapshot(vault,DEFAULT_SETTINGS,service.state,now),second=await createSnapshot(vault,DEFAULT_SETTINGS,service.state,now);
  assert.notEqual(first.path,second.path);assert.equal(files.get("Weather/Snapshots/existing.md"),"My private notes");
  assert.match(files.get(first.path),/weather_observed_at:/);assert.match(files.get(first.path),/## My notes/);assert.match(files.get(first.path),/Rain\/snow chance: Unavailable/);
  assert.throws(()=>utils.safeFolder("../private"));assert.throws(()=>utils.safeFolder("C:\\vault"));assert.throws(()=>utils.safeFolder(".obsidian"));
});
test("concurrent refresh callers share one set of provider requests",async()=>{
  const fake=fakeTransport(),service=new WeatherService(DEFAULT_SETTINGS,new NwsClient({},fake.fn,()=>now),()=>now);
  await Promise.all([service.refresh(),service.refresh(),service.refresh()]);assert.equal(fake.calls.length,6);
});
