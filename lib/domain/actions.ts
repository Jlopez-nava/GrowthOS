import {dateInZone,dayOffset,type WorkspaceState,type Recommendation} from './types';
import type {PerformanceReport,PerformanceKind} from './performance';

export type ActionStatus='planned'|'in_progress'|'measuring'|'completed'|'cancelled';
export type ActionMetric='sessions'|'conversions'|'spend'|'clicks'|'impressions'|'cpa'|'conversionRate'|'ctr'|'totalRevenue'|'engagedSessions'|'keyEvents'|'newUsers'|'eventCount';
export type ActionSource={origin:'live'|'sample'|'csv';kind:string;account:string;entity:string;currency:string;timezone:string;definition:string};
export type ActionDataset={source:ActionSource;label:string;start:string;end:string;collectedAt:string;lagDays:number;sparse:boolean;rows:Record<string,string|number|null>[]};
export type ActionSnapshot={start:string;end:string;value:number;collectedAt:string;rowCount:number};
export type ActionResult={baseline:ActionSnapshot;after:ActionSnapshot;delta:number;percent:number|null;outcome:'target_met'|'improved'|'unchanged'|'worse';checkedAt:string};
export type ActionPlan={id:string;brandId:string;timezone?:string;kind:'task'|'experiment';title:string;owner:string;dueDate:string;hypothesis:string;status:ActionStatus;createdAt:string;updatedAt:string;evidence:{title:string;summary:string;reference:string;capturedAt:string};source?:ActionSource;metric?:ActionMetric;direction:'increase'|'decrease';targetPercent:number;window:7|14|28;lagDays:number;implementedAt?:string;changeNotes?:string;baseline?:ActionSnapshot;measurementNote?:string;result?:ActionResult;decision?:'keep'|'iterate'|'revert'|'inconclusive'|'done';learning?:string;history:{at:string;message:string}[]};
export type ActionSeed={title:string;summary:string;reference:string;source?:ActionSource;metric?:ActionMetric};
export const statusLabels:Record<ActionStatus,string>={planned:'Planned',in_progress:'In progress',measuring:'Measuring',completed:'Completed',cancelled:'Cancelled'};
export const metricLabels:Record<ActionMetric,string>={sessions:'Sessions',conversions:'Recorded conversions',spend:'Ad spend',clicks:'Clicks',impressions:'Impressions',cpa:'Cost per conversion',conversionRate:'Session conversion rate',ctr:'Click-through rate',totalRevenue:'Recorded revenue',engagedSessions:'Engaged sessions',keyEvents:'Key events',newUsers:'New users',eventCount:'Event count'};
export function sourceKey(source:ActionSource){return JSON.stringify([source.origin,source.kind,source.account,source.entity,source.currency,source.timezone,source.definition]);}
export function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function actionDatasets(state:WorkspaceState,reports:Partial<Record<PerformanceKind,PerformanceReport|null>>,sample:boolean):ActionDataset[]{
 const datasets:ActionDataset[]=[];
 for(const report of Object.values(reports)){
  if(!report)continue;
  const field=report.kind==='paid'?'id':report.kind==='events'?'event':'channel';
  for(const entity of [...new Set(report.rows.map(row=>String(row[field])))]){
   const rows=report.rows.filter(row=>String(row[field])===entity);
   const source:ActionSource={origin:sample?'sample':'live',kind:report.kind,account:report.account.id,entity,currency:report.account.currency,timezone:report.account.timezone,definition:report.kind==='paid'?'Google Ads conversions and attributed value':report.kind==='events'?'GA4 event occurrences':report.kind==='traffic'?'GA4 session-channel activity':'GA4 first-user channel activity'};
   datasets.push({source,label:(sample?'Sample · ':'')+(report.kind==='paid'?'Google Ads · '+rows[0].name:report.kind==='events'?'GA4 event · '+entity:'GA4 '+(report.kind==='traffic'?'traffic':'acquisition')+' · '+entity),start:report.start,end:report.end,collectedAt:report.collectedAt,lagDays:report.range.lagDays,sparse:true,rows});
  }
 }
 const groups=new Map<string,typeof state.metrics>();
 for(const row of state.metrics){const key=JSON.stringify([row.source,row.account,row.entity,row.currency,row.timezone,row.definition]);groups.set(key,[...(groups.get(key)??[]),row]);}
 for(const rows of groups.values()){
  const row=rows[0],source:ActionSource={origin:state.mode==='demo'?'sample':'csv',kind:'csv-'+row.source,account:row.account,entity:row.entity,currency:row.currency,timezone:row.timezone,definition:row.definition};
  const dates=rows.map(r=>r.date).sort();datasets.push({source,label:(state.mode==='demo'?'Sample CSV · ':'CSV · ')+row.source.toUpperCase()+' · '+row.entity,start:dates[0],end:dates.at(-1)!,collectedAt:rows.map(r=>r.collectedAt).sort()[0],lagDays:row.source==='ga4'?2:row.source==='gsc'?3:Math.max(3,state.rules.adsLagDays),sparse:false,rows:rows.map(r=>({...r}))});
 }
 return datasets;
}
export function datasetMetrics(data:ActionDataset):ActionMetric[]{
 if(data.source.kind==='paid')return ['cpa','conversions','spend','clicks','ctr','impressions'];
 if(data.source.kind==='traffic')return ['sessions','engagedSessions','keyEvents','totalRevenue'];
 if(data.source.kind==='events')return ['eventCount'];
 if(data.source.kind==='acquisition')return ['newUsers'];
 if(data.source.kind==='csv-ads')return ['cpa','conversions','spend','clicks','ctr','impressions'];
 return data.source.kind==='csv-ga4'?['conversionRate','sessions','conversions']:['ctr','clicks','impressions'];
}
export function recommendationSeed(state:WorkspaceState,rec:Recommendation):ActionSeed{
 const data=actionDatasets(state,{},false).find(d=>d.source.kind==='csv-'+rec.source&&d.source.account===rec.account&&d.source.entity===rec.entity);
 return {title:rec.title,summary:rec.summary+' Suggested next step: '+rec.action,reference:'Opportunity '+rec.id+' · '+rec.start+' – '+rec.end,source:data?.source,metric:rec.metric};
}
function metricValue(rows:ActionDataset['rows'],metric:ActionMetric){
 const sum=(key:string)=>{let value=0;for(const row of rows){const n=row[key];if(typeof n!=='number'||!Number.isFinite(n)||(n<0&&key!=='totalRevenue'))throw new Error('The report has missing or invalid '+key+' values.');value+=n;}return value;};
 if(['cpa','conversionRate','ctr'].includes(metric)){const [numerator,denominator]=metric==='cpa'?['spend','conversions']:metric==='ctr'?['clicks','impressions']:['conversions','sessions'];const d=sum(denominator);if(!d)throw new Error('This period has a zero denominator; the selected rate cannot be compared.');return sum(numerator)/d;}
 return sum(metric);
}
export function captureSnapshot(data:ActionDataset,metric:ActionMetric,start:string,end:string,now=new Date(),lagDays=data.lagDays):ActionSnapshot{
 if(!validDate(start)||!validDate(end)||end<start)throw new Error('Choose a valid comparison period.');
 if(!datasetMetrics(data).includes(metric))throw new Error('This metric is not supported by the selected report.');
 const completeThrough=dayOffset(dateInZone(now,data.source.timezone),-Math.max(1,lagDays));
 if(end>completeThrough)throw new Error('Waiting for complete reporting days. This period becomes eligible after the reporting buffer.');
 if(data.start>start||data.end<end)throw new Error('The available report does not cover '+start+' through '+end+'. Refresh or import the matching daily history.');
 const rows=data.rows.filter(r=>String(r.date)>=start&&String(r.date)<=end);
 const mature=(at:string,day:string)=>dateInZone(new Date(at),data.source.timezone)>=dayOffset(day,Math.max(1,lagDays));
 if(data.sparse?!mature(data.collectedAt,end):rows.some(r=>!mature(String(r.collectedAt??data.collectedAt),String(r.date))))throw new Error('Refresh or re-import this report after the reporting buffer before measuring results.');
 if(!data.sparse){const seen=new Set<string>();for(const row of rows){if(seen.has(String(row.date)))throw new Error('Multiple rows exist for one date. Resolve overlapping CSV records before comparing.');seen.add(String(row.date));}for(let day=start;day<=end;day=dayOffset(day,1))if(!seen.has(day))throw new Error('Daily CSV coverage is incomplete. Include a row for every day, including zero-activity days.');}
 return {start,end,value:metricValue(rows,metric),collectedAt:data.sparse?data.collectedAt:rows.map(r=>String(r.collectedAt??data.collectedAt)).sort().at(-1)??data.collectedAt,rowCount:rows.length};
}
export function createAction(input:Omit<ActionPlan,'id'|'status'|'createdAt'|'updatedAt'|'history'>,now=new Date()):ActionPlan{
 if(!input.title.trim()||input.title.length>160)throw new Error('Add an action title of up to 160 characters.');
 if(!input.owner.trim()||input.owner.length>120)throw new Error('Assign an owner (name or team, up to 120 characters).');
 if(input.dueDate&&!validDate(input.dueDate))throw new Error('Choose a valid due date.');
 if(!input.hypothesis.trim()||input.hypothesis.length>2000)throw new Error('Describe the task or the change you want to test.');
 if(input.kind==='experiment'&&(!input.source||!input.metric))throw new Error('Choose the report and metric to measure.');
 if(![7,14,28].includes(input.window)||!Number.isFinite(input.targetPercent)||input.targetPercent<=0||input.targetPercent>100)throw new Error('Choose a valid window and an improvement target between 0 and 100%.');
 const at=now.toISOString();return {...input,title:input.title.trim(),owner:input.owner.trim(),hypothesis:input.hypothesis.trim(),id:crypto.randomUUID(),status:'planned',createdAt:at,updatedAt:at,history:[{at,message:'Created '+input.kind+'.'}]};
}
export function updateAction(action:ActionPlan,patch:Partial<ActionPlan>,message:string,now=new Date()):ActionPlan{const at=now.toISOString();return {...action,...patch,updatedAt:at,history:[...action.history,{at,message}]};}
export function recordChange(action:ActionPlan,date:string,notes:string,datasets:ActionDataset[],now=new Date()):ActionPlan{
 if(!['planned','in_progress'].includes(action.status))throw new Error('The implementation has already been recorded or this action is closed.');
 const zone=action.source?.timezone??action.timezone??'UTC';if(!validDate(date)||date>dateInZone(now,zone))throw new Error('Choose an implementation date that is not in the future.');
 if(!notes.trim()||notes.length>4000)throw new Error('Record exactly what changed (up to 4,000 characters).');
 const next=updateAction(action,{implementedAt:date,changeNotes:notes.trim(),status:action.kind==='task'?'completed':'measuring',...(action.kind==='task'?{decision:'done' as const,learning:notes.trim()}: {})},action.kind==='task'?'Task completed.':'Implementation recorded; measurement started.',now);
 if(action.source&&action.metric){const data=datasets.find(d=>sourceKey(d.source)===sourceKey(action.source!));if(data)try{next.baseline=captureSnapshot(data,action.metric,dayOffset(date,-action.window),dayOffset(date,-1),now,action.lagDays);}catch{/* Capture on the next check when coverage is ready. */}}
 return next;
}
export function checkResults(action:ActionPlan,datasets:ActionDataset[],now=new Date()):ActionPlan{
 if(action.status!=='measuring'||!action.source||!action.metric||!action.implementedAt)throw new Error('Record the experiment implementation before checking results.');
 const data=datasets.find(d=>sourceKey(d.source)===sourceKey(action.source!));if(!data)throw new Error('Load the same source, account, entity, currency, and timezone used for this experiment. Sample and live data cannot be mixed.');
 const baseline=action.baseline??captureSnapshot(data,action.metric,dayOffset(action.implementedAt,-action.window),dayOffset(action.implementedAt,-1),now,action.lagDays);
 let after:ActionSnapshot;try{after=captureSnapshot(data,action.metric,dayOffset(action.implementedAt,1),dayOffset(action.implementedAt,action.window),now,action.lagDays);}catch(e){return updateAction(action,{baseline,measurementNote:(e as Error).message},'Baseline preserved; after-period data not yet ready.',now);}
 const delta=after.value-baseline.value,percent=baseline.value<=0?null:delta/baseline.value*100,improvement=(action.direction==='increase'?1:-1)*delta;
 const outcome=delta===0?'unchanged':improvement<0?'worse':percent!==null&&Math.abs(percent)>=action.targetPercent?'target_met':'improved';
 return updateAction(action,{baseline,measurementNote:undefined,result:{baseline,after,delta,percent,outcome,checkedAt:now.toISOString()}},'Compared equal '+action.window+'-day periods; implementation day excluded.',now);
}
export function closeAction(action:ActionPlan,decision:ActionPlan['decision'],learning:string,now=new Date()):ActionPlan{
 if(action.status!=='measuring')throw new Error('Only a measuring experiment can be reviewed.');
 if(!['keep','iterate','revert','inconclusive'].includes(decision??''))throw new Error('Choose a review decision.');
 if(!action.result&&decision!=='inconclusive')throw new Error('Check results first, or close as inconclusive.');
 if(!learning.trim()||learning.length>4000)throw new Error('Record what you learned (up to 4,000 characters).');
 return updateAction(action,{status:'completed',decision,learning:learning.trim()},'Review saved: '+decision+'.',now);
}
export function formatActionMetric(value:number,metric:ActionMetric,currency='USD'){
 if(['ctr','conversionRate'].includes(metric))return (value*100).toFixed(2)+'%';
 if(['cpa','spend','totalRevenue'].includes(metric)&&/^[A-Z]{3}$/.test(currency))return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(value);
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
}
