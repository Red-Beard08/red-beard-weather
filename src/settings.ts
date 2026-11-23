import { Notice, PluginSettingTab, Setting, type App } from "obsidian";
import type WeatherPlugin from "./main";
import { validateSettings } from "./utils";
export class WeatherSettingsTab extends PluginSettingTab {
  constructor(app:App,private plugin:WeatherPlugin){super(app,plugin);}
  display(){
    const c=this.containerEl;c.empty();const draft={...this.plugin.settings};
    c.createEl("h2",{text:"Red-Beard Weather"});
    c.createEl("h3",{text:"Location and display"});
    c.createEl("p",{text:"NWS coverage is limited to supported U.S. locations. Coordinates are sent directly to NWS; GPS access is not used."});
    new Setting(c).setName("Location name").addText(t=>t.setValue(draft.locationName).onChange(v=>{draft.locationName=v;}));
    new Setting(c).setName("Latitude").addText(t=>t.setValue(String(draft.latitude)).onChange(v=>{draft.latitude=v.trim() ? Number(v) : NaN;}));
    new Setting(c).setName("Longitude").addText(t=>t.setValue(String(draft.longitude)).onChange(v=>{draft.longitude=v.trim() ? Number(v) : NaN;}));
    new Setting(c).setName("Units").addDropdown(d=>d.addOptions({us:"Fahrenheit / mph",si:"Celsius / km/h"}).setValue(draft.units).onChange(v=>{draft.units=v === "si" ? "si" : "us";}));
    new Setting(c).setName("Time zone").setDesc("IANA name; defaults to America/Chicago for Peoria.").addText(t=>t.setValue(draft.timeZone).onChange(v=>{draft.timeZone=v.trim();}));
    c.createEl("h3",{text:"Snapshot storage"});
    new Setting(c).setName("Snapshot folder").setDesc("Vault-relative. Changing this never moves existing notes.").addText(t=>t.setValue(draft.snapshotFolder).onChange(v=>{draft.snapshotFolder=v;}));
    c.createEl("h3",{text:"Automation and privacy"});
    new Setting(c).setName("Automatic refresh").setDesc("Weather every 15 minutes; alerts every 5 minutes while the app is visible. Refreshes on startup and resume. No closed-app notifications.").addToggle(t=>t.setValue(draft.autoRefresh).onChange(v=>{draft.autoRefresh=v;}));
    c.createEl("p",{text:"No accounts, keys, analytics, paid provider, or server. Settings and the offline cache are stored in this plugin’s data.json and may sync with your vault. NWS rate limits and cache guidance apply to manual refresh too."});
    new Setting(c).addButton(b=>b.setButtonText("Save settings").setCta().onClick(async()=>{
      try {const valid=validateSettings(draft);b.setDisabled(true);await this.plugin.applySettings(valid);new Notice("Weather settings saved.");this.display();}
      catch(error){new Notice(error instanceof Error ? error.message : "Could not save weather settings.");b.setDisabled(false);}
    }));
    c.createEl("a",{text:"NWS API documentation and free-use policy",href:"https://www.weather.gov/documentation/services-web-api",attr:{target:"_blank",rel:"noopener noreferrer"}});
  }
}
