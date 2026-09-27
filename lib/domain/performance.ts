import type {Profile} from './types';
export type PerformanceKind='traffic'|'acquisition'|'events'|'paid';
export type PerformanceRange={start:string;end:string;previousStart:string;previousEnd:string;lagDays:number;timezone:string};
export type PerformanceRow={date:string;[key:string]:string|number};
export type PerformanceReport={kind:PerformanceKind;start:string;end:string;range:PerformanceRange;collectedAt:string;provider:string;account:{id:string;name:string;currency:string;timezone:string};rows:PerformanceRow[];limitations:string[];query?:unknown};
export type CampaignPlan={segment:string;objective:string;budget:number|null;targetCPA:number|null};
export type PerformanceConfig={model:'services'|'saas'|'commerce';lagDays:number;resultLabel:string;adsResultsVerified:boolean;targetResults:number|null;targetCPA:number|null;targetRevenue:number|null;events:Record<string,string>;campaigns:Record<string,CampaignPlan>};
export type Journey={id:string;dates:(string|null)[]};
export type JourneyImport={filename:string;importedAt:string;model:PerformanceConfig['model'];rows:Journey[]};
export const funnelModels={services:{name:'Local services',stages:['Website visit','Inquiry / call','Qualified lead','Booked job','Completed job']},saas:{name:'Software / AI app',stages:['Website visit','Trial signup','Activated user','Paid subscriber','Retained customer']},commerce:{name:'Ecommerce',stages:['Product view','Add to cart','Checkout','Purchase','Repeat purchase']}} as const;
export const kinds:PerformanceKind[]=['traffic','acquisition','events','paid'];
export const kindLabels:Record<PerformanceKind,string>={traffic:'Traffic & engagement',acquisition:'New-user acquisition',events:'Conversion events',paid:'Paid campaigns'};
export function defaultPerformance(profile:Profile):PerformanceConfig{const text=(profile.name+' '+profile.products).toLowerCase(),model=/plumb|service|contractor/.test(text)?'services':/home goods|commerce|candles|shop|decorative/.test(text)?'commerce':'saas';return {model,lagDays:7,resultLabel:'Google Ads conversions',adsResultsVerified:false,targetResults:null,targetCPA:null,targetRevenue:null,events:{},campaigns:{}};}
export function offset(date:string,days:number){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function localRange(timezone:string,lagDays=7):PerformanceRange{const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date()),end=offset(today,-lagDays),start=offset(end,-27);return {start,end,previousStart:offset(start,-28),previousEnd:offset(start,-1),lagDays,timezone};}
export function usable(report:PerformanceReport|undefined|null,range:PerformanceRange){return !!report&&report.start<=range.previousStart&&report.end>=range.end;}
export function rowsIn(report:PerformanceReport|undefined|null,range:PerformanceRange,previous=false){if(!usable(report,range))return [];return report!.rows.filter(row=>row.date>=(previous?range.previousStart:range.start)&&row.date<=(previous?range.previousEnd:range.end));}
export function total(rows:PerformanceRow[],metric:string):number|null{let sum=0;for(const row of rows){const n=row[metric];if(typeof n!=='number'||!Number.isFinite(n))return null;sum+=n;}return sum;}
export function measure(report:PerformanceReport|undefined|null,range:PerformanceRange,metric:string,previous=false){return usable(report,range)?total(rowsIn(report,range,previous),metric):null;}
export function ratio(n:number|null,d:number|null){return n===null||d===null||d<=0?null:n/d;}
export function percentChange(current:number|null,prior:number|null){return current===null||prior===null||prior===0?null:(current-prior)/prior*100;}
export function groupRows(rows:PerformanceRow[],key:string){const groups=new Map<string,PerformanceRow[]>();for(const row of rows){const id=String(row[key]);groups.set(id,[...(groups.get(id)??[]),row]);}return groups;}
export function campaignReview({spend,conversions,cpa,previousCPA,target,minSpend,verified,stale}:{spend:number;conversions:number;cpa:number|null;previousCPA:number|null;target:number|null;minSpend:number;verified:boolean;stale:boolean}){
 if(stale)return {label:'Insufficient evidence',reason:'Refresh the report before making a budget decision.'};
 if(conversions===0&&spend>=minSpend)return {label:'Investigate',reason:'Spend passed your investigation threshold with no recorded conversions. Check tracking and conversion delay first.'};
 if(conversions<10)return {label:'Insufficient evidence',reason:'Fewer than 10 recorded conversions in this period. Review volume and conversion delay before changing budget.'};
 if(!verified)return {label:'Verify results',reason:'Confirm that the Google Ads primary conversion actions represent your intended business result.'};
 if(!target)return {label:'Set target',reason:'Set a target cost per result to evaluate efficiency.'};
 if(cpa!==null&&cpa>target)return {label:'Investigate',reason:'Cost per result exceeds the target. Review campaign intent, conversion quality, and the landing page.'};
 if(cpa!==null&&cpa<=target*.85&&previousCPA!==null&&cpa<=previousCPA)return {label:'Consider scaling',reason:'Cost per result is at least 15% below target and no higher than the prior period. Check capacity and lead quality, then test a small increase.'};
 return {label:'Hold',reason:'Cost per result is within target. Continue monitoring before making a material budget change.'};
}
export function funnelCounts(rows:Journey[],range:PerformanceRange,previous=false){const start=previous?range.previousStart:range.start,end=previous?range.previousEnd:range.end;const cohort=rows.filter(r=>r.dates[0]!==null&&r.dates[0]!>=start&&r.dates[0]!<=end);return Array.from({length:5},(_,i)=>cohort.filter(r=>r.dates.slice(0,i+1).every(d=>d!==null&&d<=end)).length);}
export function validateJourneys(input:Record<string,string>[]):Journey[]{
 if(!input.length||input.length>5000)throw new Error('Upload between 1 and 5,000 journeys.');const seen=new Set<string>();
 return input.map((row,i)=>{const id=(row.entity_id??'').trim();if(!id||id.length>200||seen.has(id))throw new Error(`Row ${i+2}: use a unique anonymized entity_id.`);seen.add(id);let gap=false,prior='';const dates=Array.from({length:5},(_,stage)=>{const value=(row['stage_'+(stage+1)+'_at']??'').trim();if(!value){gap=true;return null;}if(gap||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<prior)throw new Error(`Row ${i+2}: stage dates must be valid YYYY-MM-DD dates in order, with no skipped stages.`);prior=value;return value;});if(!dates[0])throw new Error(`Row ${i+2}: stage_1_at is required.`);return {id,dates};});
}
