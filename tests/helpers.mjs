import {build} from "esbuild";
export async function load(entry,stubObsidian=false){
  const result=await build({entryPoints:[entry],bundle:true,write:false,platform:"node",format:"esm",plugins:stubObsidian?[{name:"obsidian-test",setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:"obsidian",namespace:"stub"}));b.onLoad({filter:/.*/,namespace:"stub"},()=>({contents:`export class ItemView{};export class Plugin{};export class PluginSettingTab{};export class Setting{};export class Notice{};export const requestUrl=async()=>{};export const setIcon=(el,name)=>{el.dataset.icon=name;};export const normalizePath=p=>p;export const stringifyYaml=o=>Object.entries(o).map(([k,v])=>k+': '+JSON.stringify(v)).join('\\n')+'\\n';`}));}}]:[]});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
