// Workspace writes remain protected by company authorization and R2 conditional revisions.
// Bound this new optional payload before it can reach another teammate's UI.
export function validateActions(plans,brandId){
 if(plans===undefined)return;
 const bad=()=>{throw new Error('The action records are invalid. Reload this brand before trying again.');};
 const text=(v,max,empty=false)=>typeof v==='string'&&v.length<=max&&(empty||!!v.trim());
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const timestamp=v=>text(v,40)&&Number.isFinite(Date.parse(v));
 const number=v=>typeof v==='number'&&Number.isFinite(v);
 const snapshot=v=>v&&date(v.start)&&date(v.end)&&v.end>=v.start&&number(v.value)&&timestamp(v.collectedAt)&&Number.isInteger(v.rowCount)&&v.rowCount>=0;
 const metrics=['sessions','conversions','spend','clicks','impressions','cpa','conversionRate','ctr','totalRevenue','engagedSessions','keyEvents','newUsers','eventCount'];
 if(!Array.isArray(plans)||plans.length>200)bad();const ids=new Set();
 for(const a of plans){
  if(!a||!text(a.id,100)||ids.has(a.id)||a.brandId!==brandId||!['task','experiment'].includes(a.kind)||!['planned','in_progress','measuring','completed','cancelled'].includes(a.status)||!text(a.title,160)||!text(a.owner,120)||!text(a.hypothesis,2000)||!(a.dueDate===''||date(a.dueDate))||!timestamp(a.createdAt)||!timestamp(a.updatedAt))bad();ids.add(a.id);
  if(!['increase','decrease'].includes(a.direction)||![7,14,28].includes(a.window)||!number(a.targetPercent)||a.targetPercent<=0||a.targetPercent>100||!Number.isInteger(a.lagDays)||a.lagDays<1||a.lagDays>90)bad();
  if(!a.evidence||!text(a.evidence.title,500)||!text(a.evidence.summary,10000)||!text(a.evidence.reference,2000)||!timestamp(a.evidence.capturedAt)||!Array.isArray(a.history)||a.history.length<1||a.history.length>1000||a.history.some(h=>!h||!timestamp(h.at)||!text(h.message,2000)))bad();
  if(a.timezone!==undefined){try{if(!text(a.timezone,100))bad();new Intl.DateTimeFormat('en',{timeZone:a.timezone});}catch{bad();}}
  if(a.source){const s=a.source;if(!['live','sample','csv'].includes(s.origin)||!['paid','traffic','events','acquisition','csv-ads','csv-ga4','csv-gsc'].includes(s.kind)||!text(s.account,500)||!text(s.entity,4000)||!text(s.currency,100)||!text(s.timezone,100)||!text(s.definition,4000)||!metrics.includes(a.metric))bad();try{new Intl.DateTimeFormat('en',{timeZone:s.timezone});}catch{bad();}}
  if(a.kind==='experiment'&&!a.source)bad();
  if(a.implementedAt!==undefined&&(!date(a.implementedAt)||!text(a.changeNotes,4000)))bad();
  if(a.status==='measuring'&&(a.kind!=='experiment'||!a.implementedAt))bad();
  if(a.baseline!==undefined&&!snapshot(a.baseline))bad();
  if(a.measurementNote!==undefined&&!text(a.measurementNote,2000))bad();
  if(a.result){const r=a.result;if(!snapshot(r.baseline)||!snapshot(r.after)||!number(r.delta)||!(r.percent===null||number(r.percent))||!timestamp(r.checkedAt)||!['target_met','improved','unchanged','worse'].includes(r.outcome))bad();}
  if(a.decision!==undefined&&!['keep','iterate','revert','inconclusive','done'].includes(a.decision))bad();
  if(a.learning!==undefined&&!text(a.learning,4000))bad();
 }
}
