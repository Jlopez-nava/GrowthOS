import {dateInZone,dayOffset,type WorkspaceState} from './types';
import {usable,rowsIn,total,measure,ratio,percentChange,groupRows,campaignReview,type PerformanceConfig,type PerformanceKind,type PerformanceRange,type PerformanceReport} from './performance';
import {actionDatasets,checkResults,type ActionPlan} from './actions';

export type PerformanceFocus={section:'goals'|'paid'|'demand'|'actions';campaignId?:string;actionId?:string};
export type PerformanceStatus={configured:boolean;range:PerformanceRange;reports:Partial<Record<PerformanceKind,PerformanceReport|null>>;attempts:Partial<Record<PerformanceKind,{at:string;error?:string|null}|null>>};
export type Priority={id:string;title:string;observed:string;why:string;next:string;source:string;score:number;focus:PerformanceFocus;label:string};
export type FollowUp={plan:ActionPlan;label:string;detail:string;score:number};
const number=(v:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v);
const money=(v:number,currency:string)=>/^[A-Z]{3}$/.test(currency)?new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(v):number(v)+' (currency unavailable)';
export function reportHealth(report:PerformanceReport|null|undefined,range:PerformanceRange,error?:string|null,now=new Date()){
 if(error)return {ready:false,label:'Refresh failed',detail:error};
 if(!report)return {ready:false,label:'Not loaded',detail:'Daily history has not loaded for this source.'};
 if(!usable(report,range))return {ready:false,label:'Incomplete period',detail:'This report does not cover both comparison periods.'};
 const age=now.getTime()-Date.parse(report.collectedAt);
 if(!Number.isFinite(age)||age>48*3600000||age< -300000)return {ready:false,label:'Needs refresh',detail:'Refresh this report before acting on its numbers.'};
 return {ready:true,label:'Ready',detail:'Complete reporting windows are available.'};
}
export function todayPriorities(state:WorkspaceState,reports:PerformanceStatus['reports'],range:PerformanceRange,cfg:PerformanceConfig,attempts:PerformanceStatus['attempts']={},now=new Date()):Priority[]{
 const priorities:Priority[]=[],paid=reports.paid,traffic=reports.traffic;
 if(reportHealth(paid,range,attempts.paid?.error,now).ready){
  const rows=rowsIn(paid,range),currency=paid!.account.currency;
  const spend=total(rows,'spend');
  if(!cfg.adsResultsVerified&&spend!==null&&spend>0)priorities.push({id:'verify-results',score:95,title:'Confirm what counts as a result',observed:money(spend,currency)+' in ad spend is being evaluated against unverified Google Ads conversion actions.',why:'Clicks, calls and qualified leads can represent different outcomes. Budget decisions need the right definition.',next:'Check the primary conversion actions, then save the business result in Goals & tracking.',source:'Google Ads · saved result definition',focus:{section:'goals'},label:'Review measurement'});
  for(const [id,rows] of groupRows(rowsIn(paid,range),'id')){
   const spend=total(rows,'spend'),results=total(rows,'conversions'),previous=rowsIn(paid,range,true).filter(r=>r.id===id),beforeCPA=ratio(total(previous,'spend'),total(previous,'conversions'));
   if(spend===null||results===null)continue;
   const cpa=ratio(spend,results),target=cfg.campaigns[id]?.targetCPA??cfg.targetCPA;
   const review=campaignReview({spend,conversions:results,cpa,previousCPA:beforeCPA,target,minSpend:state.rules.minSpend,verified:cfg.adsResultsVerified,stale:false});
   const name=String(rows[0].name);
   if(review.label==='Investigate')priorities.push({id:'campaign-'+id,score:results===0?100:85,title:results===0?name+' spent without recorded conversions':name+' is above its cost target',observed:money(spend,currency)+' spent · '+number(results)+' recorded conversions'+(cpa!==null?' · '+money(cpa,currency)+' per conversion':'')+(target&&results>0?' · target '+money(target,currency):''),why:review.reason,next:'Inspect the campaign’s conversion actions, search intent and landing page before changing spend.',source:'Google Ads · '+name,focus:{section:'paid',campaignId:id},label:'Investigate campaign'});
   else if(review.label==='Consider scaling')priorities.push({id:'campaign-'+id,score:50,title:'Review room to grow '+name,observed:number(results)+' recorded conversions at '+money(cpa!,currency)+' each; target '+money(target!,currency)+'.',why:review.reason,next:'Confirm lead quality and capacity, then record a small budget experiment if appropriate.',source:'Google Ads · '+name,focus:{section:'paid',campaignId:id},label:'Review campaign'});
  }
  if(cfg.adsResultsVerified&&spend!==null&&spend>0&&!cfg.targetCPA&&!Object.values(cfg.campaigns).some(c=>c.targetCPA))priorities.push({id:'set-target',score:65,title:'Set a cost target for paid results',observed:'Your business result is defined, but no cost-per-result target is saved.',why:'A target makes the campaign assessments useful for budget decisions.',next:'Save a target based on what a qualified result is worth to this brand.',source:'Saved brand goals',focus:{section:'goals'},label:'Set a target'});
 }
 if(reportHealth(traffic,range,attempts.traffic?.error,now).ready&&!traffic!.limitations.length){
  const current=measure(traffic,range,'sessions'),prior=measure(traffic,range,'sessions',true),delta=percentChange(current,prior);
  if(delta!==null&&delta<=-20&&prior!==null&&prior>=100&&current!==null){
   const channels=[...new Set([...rowsIn(traffic,range),...rowsIn(traffic,range,true)].map(r=>String(r.channel)))].map(channel=>({channel,change:(total(rowsIn(traffic,range).filter(r=>r.channel===channel),'sessions')??0)-(total(rowsIn(traffic,range,true).filter(r=>r.channel===channel),'sessions')??0)})).sort((a,b)=>a.change-b.change);
   priorities.push({id:'traffic-down',score:80,title:'Investigate the drop in website visits',observed:number(current)+' sessions versus '+number(prior)+' in the previous 28 days ('+number(delta)+'%).',why:(channels[0]?.change<0?channels[0].channel+' has the largest absolute decline. ':'')+'This is a change in visits, not proof of fewer leads or a specific cause.',next:'Review channel changes, tracking and recent campaigns in Performance.',source:'GA4 · session acquisition',focus:{section:'demand'},label:'Review traffic'});
  }
 }
 return priorities.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function todayFollowUps(state:WorkspaceState,reports:PerformanceStatus['reports'],sample:boolean,attempts:PerformanceStatus['attempts']={},now=new Date()):FollowUp[]{
 const today=dateInZone(now,state.profile.timezone),datasets=actionDatasets(state,reports,sample);
 return (state.actionPlans??[]).filter(plan=>plan.brandId===state.id&&!['completed','cancelled'].includes(plan.status)).map(plan=>{
  if(plan.status==='measuring'){
   if(plan.result)return {plan,label:'Ready for your review',detail:'A result comparison is saved. Decide what to keep, change or stop.',score:100};
   try{
    if(plan.source?.origin==='live'&&attempts[plan.source.kind as PerformanceKind]?.error)throw new Error('Refresh the source report before checking this experiment.');
    const checked=checkResults(plan,datasets,now);
    if(checked.result)return {plan,label:'Ready to check results',detail:'Both reporting windows are available. Open the experiment to calculate and save the result.',score:90};
    return {plan,label:'Waiting for data',detail:checked.measurementNote||'The measurement window is still filling.',score:25};
   }catch(e){const eligible=plan.implementedAt?dayOffset(plan.implementedAt,plan.window+Math.max(1,plan.lagDays)):null;return {plan,label:eligible&&eligible>today?'Experiment running':'Needs matching data',detail:eligible&&eligible>today?'Earliest results check: '+eligible+'.':(e as Error).message,score:eligible&&eligible>today?20:60};}
  }
  const overdue=!!plan.dueDate&&plan.dueDate<today,due=plan.dueDate===today;
  return {plan,label:overdue?'Overdue':due?'Due today':plan.status==='in_progress'?'In progress':'Planned',detail:(plan.dueDate?'Due '+plan.dueDate+' · ':'')+plan.owner,score:overdue?95:due?85:plan.status==='in_progress'?40:30};
 }).sort((a,b)=>b.score-a.score||(a.plan.dueDate||'9999').localeCompare(b.plan.dueDate||'9999'));
}
