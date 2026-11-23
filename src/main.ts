import { Notice, Plugin, requestUrl, type App } from "obsidian";
import { renderWeather, WEATHER_VIEW, WeatherView } from "./dashboard";
import { NwsClient, WeatherService } from "./provider";
import { createSnapshot } from "./repository";
import { WeatherSettingsTab } from "./settings";
import type { HttpCache, Transport, WeatherSettings, WeatherStorage } from "./types";
import { DEFAULT_SETTINGS, locationKey, normalizeSettings } from "./utils";
declare global { interface WindowEventMap { "red-beard-dashboard-ready": CustomEvent } }

interface DashboardHost {
  registerWidget(def:{id:string;name:string;description:string;icon:string;defaultLayout:{w:number;mobileW:number;h:number;order:number};render:(context:unknown,container:HTMLElement)=>void}):()=>void;
  registerModule(def:{id:string;name:string;command:string;icon:string;description:string;order:number}):()=>void;
  registerQuickAction?(def:{id:string;name:string;command:string;description:string}):()=>void;
  refreshViews():Promise<void>;
}
const transport: Transport = async(url,headers)=>{
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const response=await Promise.race([
      requestUrl({url,headers,throw:false}),
      new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error("NWS request timed out; retrying later.")),20_000);})
    ]);
    // Empty 304/error bodies are not necessarily JSON.
    let json: unknown;
    if(response.status >= 200 && response.status < 300) json=response.json;
    return {status:response.status,headers:response.headers,json};
  } finally {if(timeout) clearTimeout(timeout);}
};
export default class WeatherPlugin extends Plugin {
  settings:WeatherSettings={...DEFAULT_SETTINGS};
  service!:WeatherService;
  private listeners=new Set<()=>void>();
  private widgetContainers=new Set<HTMLElement>();
  private host?:DashboardHost;
  private detachHost:(()=>void)[]=[];
  private disposed=false;
  private saves:Promise<void>=Promise.resolve();
  private lastSaved="";
  private snapshotPending=false;
  async onload(){
    const stored=await this.loadData() as WeatherStorage | null;
    this.settings=normalizeSettings(stored?.settings);
    const cache:HttpCache={};
    for(const [url,entry] of Object.entries(stored?.cache ?? {})) {
      if(url.startsWith("https://api.weather.gov/") && entry && typeof entry === "object" && Number.isFinite(entry.checkedAt) && Number.isFinite(entry.expiresAt)) cache[url]=entry;
    }
    this.service=new WeatherService(this.settings,new NwsClient(cache,transport));
    this.registerView(WEATHER_VIEW,leaf=>new WeatherView(leaf,this));
    this.addSettingTab(new WeatherSettingsTab(this.app,this));
    this.addRibbonIcon("cloud-sun","Open Weather",()=>void this.openDashboard());
    this.addCommand({id:"open-dashboard",name:"Open weather",callback:()=>void this.openDashboard()});
    this.addCommand({id:"refresh",name:"Refresh weather",callback:()=>void this.refresh(true)});
    this.addCommand({id:"new-snapshot",name:"New Weather Snapshot",callback:()=>void this.saveSnapshot()});
    this.addCommand({id:"open-settings",name:"Open weather settings",callback:()=>this.openSettings()});
    this.registerDomEvent(window,"red-beard-dashboard-ready",()=>this.connectHost());
    this.registerDomEvent(document,"visibilitychange",()=>{if(!document.hidden) void this.refresh();});
    this.registerDomEvent(window,"focus",()=>void this.refresh());
    this.registerInterval(window.setInterval(()=>{
      this.connectHost();
      if(!document.hidden && this.settings.autoRefresh) void this.refresh();
    },60_000));
    this.app.workspace.onLayoutReady(()=>{this.connectHost();void this.refresh();});
  }
  onunload(){this.disposed=true;this.detachHost.forEach(fn=>fn());this.detachHost=[];this.listeners.clear();this.widgetContainers.clear();}
  subscribe(callback:()=>void):()=>void{this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  private notify(){
    if(this.disposed)return;
    for(const fn of this.listeners)fn();
    for(const container of this.widgetContainers){if(!container.isConnected)this.widgetContainers.delete(container);else renderWeather(container,this,true);}
  }
  private persist():Promise<void>{
    const serialized=JSON.stringify({settings:this.settings,cache:this.service.client.cache});
    this.saves=this.saves.catch(()=>{}).then(async()=>{
      if(serialized===this.lastSaved)return;
      await this.saveData(JSON.parse(serialized));this.lastSaved=serialized;
    });return this.saves;
  }
  async refresh(showNotice=false):Promise<void>{
    if(this.disposed)return;
    const service=this.service, pending=service.refresh();this.notify();
    try {
      await pending;
      if(this.disposed || service!==this.service)return;
      await this.persist();
      if(showNotice){const errors=[service.state.forecast,service.state.hourly,service.state.observation,service.state.alerts].filter(f=>f.error);new Notice(errors.length ? "Weather updated with unavailable or cached sections. Open Weather for details." : "Weather checked with NWS.");}
    }catch(error){if(showNotice)new Notice(`Weather: ${error instanceof Error ? error.message : "Could not save the offline cache."}`);}
    finally{this.notify();}
  }
  async applySettings(settings:WeatherSettings){
    const changed=locationKey(settings)!==locationKey(this.settings);
    const previous=this.settings, previousService=this.service;this.settings=settings;
    if(changed)this.service=new WeatherService(settings,new NwsClient({},transport));
    else this.service.settings=settings;
    try{await this.persist();}catch(error){this.settings=previous;this.service=previousService;this.service.settings=previous;throw error;}
    this.notify();void this.refresh();
  }
  async openDashboard(){
    let leaf=this.app.workspace.getLeavesOfType(WEATHER_VIEW)[0];
    if(!leaf){leaf=this.app.workspace.getLeaf(true);await leaf.setViewState({type:WEATHER_VIEW,active:true});}
    await this.app.workspace.revealLeaf(leaf);
  }
  openSettings(){const settings=(this.app as App&{setting?:{open:()=>void;openTabById:(id:string)=>void}}).setting;settings?.open();settings?.openTabById(this.manifest.id);}
  async saveSnapshot(){
    if(this.snapshotPending)return;this.snapshotPending=true;
    try{
      await this.refresh();
      const file=await createSnapshot(this.app.vault,this.settings,this.service.state);
      await this.app.workspace.getLeaf(false).openFile(file);new Notice("Weather snapshot saved.");
    }catch(error){new Notice(error instanceof Error ? error.message : "Weather snapshot could not be saved.");}
    finally{this.snapshotPending=false;}
  }
  private connectHost(){
    if(this.disposed)return;
    const candidate=(this.app as App&{plugins?:{getPlugin:(id:string)=>unknown}}).plugins?.getPlugin("red-beard-dashboard") as DashboardHost|undefined;
    if(candidate===this.host)return;
    this.detachHost.forEach(fn=>fn());this.detachHost=[];this.host=undefined;this.widgetContainers.clear();
    if(!candidate?.registerModule || !candidate.registerWidget)return;
    this.host=candidate;
    this.detachHost.push(candidate.registerModule({id:this.manifest.id,name:"Weather",command:`${this.manifest.id}:open-dashboard`,icon:"cloud-sun",description:"Peoria conditions, forecasts, and NWS alerts.",order:70}));
    this.detachHost.push(candidate.registerWidget({id:"red-beard-weather/overview",name:"Weather",description:"Conditions now and the next few hours.",icon:"cloud-sun",defaultLayout:{w:4,mobileW:12,h:3,order:15},render:(_,container)=>{for(const old of this.widgetContainers)if(!old.isConnected)this.widgetContainers.delete(old);this.widgetContainers.add(container);renderWeather(container,this,true);}}));
    if(candidate.registerQuickAction)this.detachHost.push(candidate.registerQuickAction({id:"red-beard-weather/new-snapshot",name:"New Weather Snapshot",command:`${this.manifest.id}:new-snapshot`,description:"Save the current NWS data to a Markdown note."}));
  }
}
