import {type WorkspaceState,type Metric,type MetricName,type Recommendation,dayOffset,dateInZone,id} from './types';
export function sum(rows:Metric[],metric:MetricName):number|null{if(!rows.length||rows.some(r=>r[metric]===null))return null;return rows.reduce((n,r)=>n+r[metric]!,0);}
export function rate(n:number|null,d:number|null):number|null{return n===null||d===null||d===0?null:n/d;}
export function change(current:number,previous:number){return previous===0?null:(current-previous)/previous*100;}
export function formatMetric(value:number,metric:string,currency='USD'){if(['conversionRate','ctr'].includes(metric))return `${(value*100).toFixed(2)}%`;if(metric==='spend')return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value);return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value);}
export function analyze(state:WorkspaceState,now=new Date()):{recommendations:Recommendation[];limitations:string[]}{
 const groups=new Map<string,Metric[]>();const limitations:string[]=[];const result:Recommendation[]=[];
 for(const report of state.imports.filter(i=>i.status==='imported'&&i.grain==='range_entity'))limitations.push(`${report.account}: ${report.start} – ${report.end} is a date-range summary. View it in Performance; daily trend recommendations need daily data.`);
 for(const m of state.metrics){const k=JSON.stringify([m.source,m.account,m.entity,m.timezone,m.currency,m.definition]);groups.set(k,[...(groups.get(k)??[]),m]);}
 for(const rows of groups.values()){
 const m=rows[0],rules=state.rules;const delay=m.source==='ads'?Math.max(3,rules.adsLagDays):m.source==='gsc'?3:2;
 const today=dateInZone(now,m.timezone),end=dayOffset(today,-delay),start=dayOffset(end,1-rules.window),previousEnd=dayOffset(start,-1),previousStart=dayOffset(start,-rules.window);
 const current=rows.filter(r=>r.date>=start&&r.date<=end),previous=rows.filter(r=>r.date>=previousStart&&r.date<=previousEnd);
 if(new Set(current.map(r=>r.date)).size!==rules.window||new Set(previous.map(r=>r.date)).size!==rules.window){limitations.push(`${m.entity}: incomplete ${rules.window}-day comparison; no recommendation generated.`);continue;}
 if([...current,...previous].some(r=>(+now-+new Date(r.collectedAt))/86400000>rules.maxAgeDays)){limitations.push(`${m.entity}: source collection is stale; re-export both windows.`);continue;}
 const base={entity:m.entity,source:m.source,account:m.account,start,end,previousStart,previousEnd,createdAt:now.toISOString(),evidenceIds:[...current,...previous].map(r=>r.id),status:'open' as const,limitations:[`${delay} days excluded for source delay${m.source==='ads'?' / configured conversion lag':''}.`,`Only imported daily entity records are available. No traffic-source or device breakdown; causes cannot be established.`,`Metric definition: ${m.definition}. ${m.currency} · ${m.timezone}.`, 'CSV coverage is user-supplied; daily rows do not establish complete account coverage.'],confidence:'Medium' as const,effort:'Low' as const};
 const add=(kind:Recommendation['kind'],title:string,summary:string,why:string,action:string,metric:Recommendation['metric'],c:number,p:number,impact:Recommendation['impact'])=>{
 const key=JSON.stringify([m.source,m.account,m.entity,kind,rules.window]);const fingerprint=JSON.stringify([start,end,c,p]);
 const dismissed=state.decisions.filter(d=>d.action==='dismissed').find(d=>state.recommendations.find(r=>r.id===d.recommendationId)?.key===key);
 // A newer time range alone is not material change. Require >=25% movement in current observed metric.
 if(dismissed){const old=state.recommendations.find(r=>r.id===dismissed.recommendationId);if(old&&(old.current===0?c===0:Math.abs(c-old.current)/Math.abs(old.current)<.25))return;}
 const existing=state.recommendations.find(r=>r.key===key&&r.fingerprint===fingerprint);
 result.push({...base,id:existing?.id??id(),key,kind,title,summary,why,action,metric,current:c,previous:p,impact,ranking:`${impact} potential impact · medium confidence because this is observational CSV evidence · low initial investigation effort.`,fingerprint,status:existing?.status??'open',draftId:existing?.draftId});
 };
 if(m.source==='ads'){
 const spend=sum(current,'spend'),conv=sum(current,'conversions'),prev=sum(previous,'spend');
 if(spend!==null&&conv===0&&spend>=rules.minSpend&&prev!==null)add('spend',`${m.entity} has spend, but no recorded conversions`,`${formatMetric(spend,'spend',m.currency)} spent over ${rules.window} complete days with 0 recorded conversions.`,`This spend warrants a measurement check before a budget decision. Zero recorded conversions does not establish wasted spend.`,`Verify the conversion action, consent setup, attribution window, and actual conversion lag. Confirm reporting is complete before changing bids or budget.`,'spend',spend,prev,'High');
 }
 if(m.source==='ga4'){
 const cs=sum(current,'sessions'),ps=sum(previous,'sessions'),cr=rate(sum(current,'conversions'),cs),pr=rate(sum(previous,'conversions'),ps);
 if(cs!==null&&ps!==null&&cs>=rules.minSessions&&ps>=rules.minSessions&&cr!==null&&pr!==null&&pr>0&&(change(cr,pr)??0)<=-rules.declinePercent)add('conversion',`Conversion rate fell on ${m.entity}`,`Session conversion rate moved from ${formatMetric(pr,'conversionRate')} to ${formatMetric(cr,'conversionRate')} (${change(cr,pr)!.toFixed(0)}%).`,`Fewer visits are reaching the recorded conversion. Traffic mix, tracking, and the page experience are hypotheses to investigate.`,`Check tracking and traffic mix, then review the headline, CTA, and conversion path.`,'conversionRate',cr,pr,'High');
 }
 if(m.source==='gsc'){
 const impressions=sum(current,'impressions'),clicks=sum(current,'clicks'),pi=sum(previous,'impressions'),pc=sum(previous,'clicks'),ctr=rate(clicks,impressions),ptr=rate(pc,pi);
 if(impressions!==null&&impressions>=rules.minImpressions&&ctr!==null&&ptr!==null&&ctr<.02)add('ctr',`More visibility than clicks for ${m.entity}`,`${impressions.toLocaleString('en-US')} impressions with a ${formatMetric(ctr,'ctr')} click-through rate.`,`This page has search exposure. A clearer title could be worth testing; position and query mix are not available in this report.`,`Inspect the search results and query intent, then prepare a title and description experiment.`,'ctr',ctr,ptr,'Medium');
 if(clicks!==null&&pc!==null&&pc>=100&&(change(clicks,pc)??0)<=-rules.declinePercent)add('traffic',`Search clicks declined for ${m.entity}`,`Clicks decreased from ${pc.toLocaleString()} to ${clicks.toLocaleString()} (${change(clicks,pc)!.toFixed(0)}%).`,`A traffic decline may affect discovery. Seasonality, rankings, and query mix remain unverified explanations.`,`Check index coverage, page changes, and query-level performance before revising content.`,'clicks',clicks,pc,'Medium');
 }
 }
 result.sort((a,b)=>(a.impact==='High'?0:1)-(b.impact==='High'?0:1)||a.title.localeCompare(b.title));return {recommendations:result,limitations:[...new Set(limitations)]};
}
export function refreshRecommendations(state:WorkspaceState,now=new Date()):WorkspaceState{const fresh=analyze(state,now).recommendations;const keys=new Set(fresh.map(r=>r.id));return {...state,recommendations:[...fresh,...state.recommendations.filter(r=>!keys.has(r.id)&&r.status!=='open')]};}
