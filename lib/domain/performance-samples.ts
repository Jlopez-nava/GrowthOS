import type {Profile} from './types';
import {defaultPerformance,offset,type PerformanceRange,type PerformanceReport,type PerformanceKind,type JourneyImport,type PerformanceConfig} from './performance';
export function sampleBrand(profile:Pick<Profile,'name'|'website'>):'promptpilot'|'juniper'|null {
 try {const host=new URL(profile.website).hostname.toLowerCase();if(host==='promptpilot.example'&&profile.name==='PromptPilot')return 'promptpilot';if(host==='juniperhome.example'&&profile.name==='Juniper & Co.')return 'juniper';}catch{}return null;
}
export function canShowSamples(profile:Pick<Profile,'name'|'website'>,status:{configured:boolean;reports:Partial<Record<PerformanceKind,PerformanceReport|null>>}|null){return !!sampleBrand(profile)&&!!status&&!status.configured&&!Object.values(status.reports).some(Boolean);}
// Deterministic fictional data, kept separate from all saved provider reports.
// Dates roll with the comparison window so the showcase remains usable.
export function makePerformanceSample(profile:Profile,range:PerformanceRange){
 const brand=sampleBrand(profile);if(!brand)return null;const shop=brand==='juniper',name=shop?'Juniper & Co.':'PromptPilot';
 const config:PerformanceConfig={...defaultPerformance(profile),model:shop?'commerce':'saas',lagDays:range.lagDays,resultLabel:shop?'Purchases (sample)':'Trial signups (sample)',adsResultsVerified:true,targetResults:shop?360:650,targetCPA:shop?42:24,targetRevenue:shop?75000:24000,events:shop?{'0':'view_item','1':'add_to_cart','2':'begin_checkout','3':'purchase','4':'repeat_purchase'}:{'1':'sign_up','2':'activation','3':'subscribe','4':'retained_subscriber'},campaigns:{}};
 const campaignSpecs=shop?[
  {id:'juniper-brand',name:'Juniper · Brand search',segment:'Branded search',objective:'Capture existing demand',network:'SEARCH',spend:26,results:3,priorResults:2,cpa:20,budget:850},
  {id:'juniper-home',name:'Home essentials · Non-brand search',segment:'Non-brand search',objective:'Acquire first-time shoppers',network:'SEARCH',spend:168,results:4,priorResults:3,cpa:38,budget:4500},
  {id:'juniper-return',name:'Cart recovery · Remarketing',segment:'Retargeting',objective:'Bring interested shoppers back',network:'DISPLAY',spend:60,results:4,priorResults:3,cpa:25,budget:2000},
  {id:'juniper-launch',name:'Autumn collection · Discovery test',segment:'Prospecting',objective:'Test a new audience',network:'DEMAND_GEN',spend:21,results:0,priorResults:0,cpa:42,budget:700}
 ]:[
  {id:'prompt-brand',name:'PromptPilot · Brand search',segment:'Branded search',objective:'Convert product-aware visitors',network:'SEARCH',spend:30,results:5,priorResults:4,cpa:12,budget:1000},
  {id:'prompt-workflow',name:'AI workflows · Non-brand search',segment:'Non-brand search',objective:'Acquire trial users with a clear use case',network:'SEARCH',spend:180,results:10,priorResults:7,cpa:26,budget:5500},
  {id:'prompt-agency',name:'Agency teams · Prospecting',segment:'Prospecting',objective:'Find new agency teams',network:'DEMAND_GEN',spend:135,results:3,priorResults:4,cpa:30,budget:3600},
  {id:'prompt-return',name:'Product visitors · Retargeting',segment:'Retargeting',objective:'Recover interested trial prospects',network:'DISPLAY',spend:50,results:4,priorResults:3,cpa:20,budget:1600}
 ];
 for(const c of campaignSpecs)config.campaigns[c.id]={segment:c.segment,objective:c.objective,budget:c.budget,targetCPA:c.cpa};
 const generatedAt=new Date().toISOString();const reports={} as Record<PerformanceKind,PerformanceReport>;
 for(const kind of ['traffic','acquisition','events','paid'] as const)reports[kind]={kind,start:range.previousStart,end:range.end,range,collectedAt:generatedAt,provider:'Fictional showcase dataset',account:{id:'sample-'+brand,name:name+' · SAMPLE DATA',currency:'USD',timezone:range.timezone},rows:[],limitations:[],query:{source:'Built-in fictional showcase',version:1,period:'Two rolling 28-day windows',note:'Synthetic values and targets; no Google or Zapier requests.'}};
 const channels=[{name:'Paid Search',base:shop?270:210,engagement:.63,growth:1.26},{name:'Organic Search',base:shop?190:260,engagement:.72,growth:1.34},{name:'Direct',base:shop?130:105,engagement:.68,growth:1.13},{name:'Email',base:shop?155:70,engagement:.78,growth:1.18},{name:'Paid Social',base:shop?100:145,engagement:.39,growth:.88}];
 for(let day=0;day<56;day++){
  const current=day>=28,index=day%28,date=offset(range.previousStart,day),wave=1+Math.sin(index*.7)*.12+(index%7===5?.15:0),trend=current?1+index*.003:1;
  let allSessions=0,allResults=0;
  for(const [i,c] of channels.entries()){
   const sessions=Math.round(c.base*wave*trend*(current?c.growth:1)),keyEvents=Math.round(sessions*(shop?.032:.06)*(i===4?.45:1)),revenue=shop?Math.round(keyEvents*(98+i*7)):Math.round(keyEvents*.18*79);
   allSessions+=sessions;allResults+=keyEvents;
   reports.traffic.rows.push({date,channel:c.name,sessions,engagedSessions:Math.round(sessions*c.engagement),keyEvents,totalRevenue:revenue});
   reports.acquisition.rows.push({date,channel:c.name,newUsers:Math.round(sessions*(i===2?.32:i===3?.22:.77))});
  }
  const eventValues=shop?{view_item:Math.round(allSessions*.9),add_to_cart:Math.round(allSessions*.16),begin_checkout:Math.round(allSessions*.085),purchase:allResults,repeat_purchase:Math.round(allResults*.19)}:{sign_up:allResults,activation:Math.round(allResults*.56),subscribe:Math.round(allResults*.18),retained_subscriber:Math.round(allResults*.11)};
  for(const [event,eventCount] of Object.entries(eventValues))reports.events.rows.push({date,event,eventCount});
  for(const [i,c] of campaignSpecs.entries()){
   const spend=Math.round(c.spend*wave*(current?1:1.04)*100)/100,conversions=Math.max(0,Math.round((current?c.results:c.priorResults)*wave+(c.results?index%4===0?1:0:0))),clicks=Math.round(spend/(shop?.85:1.15)),impressions=Math.round(clicks/(i===0?.1:.028));
   reports.paid.rows.push({date,id:c.id,name:c.name,network:c.network,spend,conversions,clicks,impressions,value:shop?conversions*112:0});
  }
 }
 const journeys:JourneyImport={filename:name+' · synthetic journey cohort',importedAt:generatedAt,model:config.model,rows:[]};
 // Representative linked cohorts, not a claim to include every website visitor.
 for(const prior of [true,false]){const count=prior?1200:1500,start=prior?range.previousStart:range.start,rates=shop?(prior?[1,.43,.25,.13,.035]:[1,.5,.31,.18,.06]):(prior?[1,.21,.105,.04,.02]:[1,.26,.15,.075,.04]);for(let i=0;i<count;i++)journeys.rows.push({id:`sample-${brand}-${prior?'prior':'current'}-${i}`,dates:rates.map((rate,stage)=>i<Math.floor(count*rate)?offset(start,(i%20)+stage*2):null)});}
 return {config,reports,journeys};
}
