import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,dayOffset} from '../lib/domain/types';
import {actionDatasets,createAction,recordChange,checkResults,closeAction,captureSnapshot,type ActionDataset,type ActionPlan} from '../lib/domain/actions';
import {validateActions} from '../server/action-validation.mjs';
const now=new Date('2026-08-30T12:00:00Z');
function data():ActionDataset{return {source:{origin:'live',kind:'paid',account:'test-account',entity:'test-campaign',currency:'USD',timezone:'UTC',definition:'Google Ads conversions and attributed value'},label:'Test campaign',start:'2026-07-01',end:'2026-08-23',collectedAt:now.toISOString(),lagDays:7,sparse:true,rows:Array.from({length:54},(_,i)=>{const date=dayOffset('2026-07-01',i);return {date,spend:date<'2026-08-10'?100:80,conversions:2,clicks:10,impressions:100};})};}
function action():ActionPlan{return createAction({brandId:'brand-test',kind:'experiment',title:'Test landing page',owner:'Growth team',dueDate:'2026-08-10',hypothesis:'A shorter form should reduce cost per conversion.',source:data().source,metric:'cpa',direction:'decrease',targetPercent:10,window:7,lagDays:7,evidence:{title:'High cost',summary:'Investigate this campaign.',reference:'Campaign test-campaign',capturedAt:now.toISOString()}},now);}
test('experiment uses weighted metric, excludes implementation day and retains immutable baseline',()=>{
 const d=data();d.rows.find(r=>r.date==='2026-08-10')!.spend=90000;
 const measured=checkResults(recordChange(action(),'2026-08-10','Shortened the signup form.',[d],now),[d],now);
 assert.equal(measured.baseline?.start,'2026-08-03');assert.equal(measured.baseline?.end,'2026-08-09');assert.equal(measured.result?.after.start,'2026-08-11');assert.equal(measured.result?.after.end,'2026-08-17');assert.equal(measured.result?.baseline.value,50);assert.equal(measured.result?.after.value,40);assert.equal(measured.result?.percent,-20);assert.equal(measured.result?.outcome,'target_met');
 const restated=data();for(const row of restated.rows)if(String(row.date)<'2026-08-10')row.spend=999;
 assert.equal(checkResults(measured,[restated],now).result?.baseline.value,50);
 const closed=closeAction(measured,'keep','Keep the form; traffic mix could also explain the difference.',now);assert.equal(closed.status,'completed');assert.equal(closed.decision,'keep');assert.throws(()=>recordChange(closed,'2026-08-10','Again',[d],now));validateActions([closed],'brand-test');
});
test('preserves an eligible baseline while waiting for the full after window and buffer',()=>{
 const date=new Date('2026-08-21T12:00:00Z'),d=data();d.collectedAt=date.toISOString();d.end='2026-08-14';
 const changed=recordChange(action(),'2026-08-14','Changed form.',[d],date),pending=checkResults(changed,[d],date);
 assert(pending.baseline);assert.equal(pending.result,undefined);assert.match(pending.measurementNote!,/Waiting for complete/);assert.equal(pending.status,'measuring');
});
test('refuses cross-account, currency, timezone and sample/live comparisons',()=>{
 const changed=recordChange(action(),'2026-08-10','Changed form.',[data()],now);
 for(const patch of [{account:'other-account'},{origin:'sample' as const},{currency:'EUR'},{timezone:'America/New_York'},{definition:'Different conversion definition'}]){const d=data();d.source={...d.source,...patch};assert.throws(()=>checkResults(changed,[d],now),/same source/);}
});
test('incomplete, duplicate, missing and zero-denominator daily data do not produce results',()=>{
 let d=data();d.sparse=false;d.rows=d.rows.filter(r=>r.date!=='2026-08-04');assert.throws(()=>captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now),/incomplete/);
 d=data();d.sparse=false;d.rows.push({...d.rows.find(r=>r.date==='2026-08-04')!});assert.throws(()=>captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now),/Multiple rows/);
 d=data();d.rows.forEach(r=>r.conversions=0);assert.throws(()=>captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now),/zero denominator/);
 d=data();d.rows.find(r=>r.date==='2026-08-04')!.spend=null;assert.throws(()=>captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now),/missing or invalid/);
 d=data();d.collectedAt='2026-08-10T00:00:00Z';assert.throws(()=>captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now),/Refresh or re-import/);
});
test('zero baselines never invent a relative lift or target attainment',()=>{
 const d=data();d.rows.forEach(r=>r.conversions=String(r.date)<'2026-08-10'?0:2);
 const p={...action(),metric:'conversions' as const,direction:'increase' as const};const measured=checkResults(recordChange(p,'2026-08-10','Changed form.',[d],now),[d],now);
 assert.equal(measured.result?.percent,null);assert.equal(measured.result?.outcome,'improved');
});
test('tasks complete with a recorded change; inconclusive experiments require learning',()=>{
 const task={...action(),kind:'task' as const};const complete=recordChange(task,'2026-08-10','Tracking verified.',[],now);assert.equal(complete.status,'completed');assert.equal(complete.result,undefined);
 const experiment=recordChange(action(),'2026-08-10','Changed form.',[],now);assert.throws(()=>closeAction(experiment,'keep','Keep it.',now),/Check results first/);assert.throws(()=>closeAction(experiment,'inconclusive','',now),/learned/);assert.equal(closeAction(experiment,'inconclusive','Insufficient history; repeat with daily reports.',now).status,'completed');assert.throws(()=>recordChange(action(),'2026-09-01','Future.',[],now),/future/);
});
test('new workspace field is optional and validation prevents malformed or cross-brand records',()=>{
 validateActions(undefined,'brand-test');validateActions([action()],'brand-test');
 for(const invalid of [[{...action(),brandId:'another-brand'}],[{...action(),history:null}],[{...action(),result:{}}],[{...action(),source:{...data().source,timezone:'invalid'}}]])assert.throws(()=>validateActions(invalid,'brand-test'));
 const workspace=emptyWorkspace();assert.deepEqual(actionDatasets(workspace,{},false),[]);
});

test('daily CSVs can be collected in separate mature batches without treating early dates as stale',()=>{
 const d=data();d.sparse=false;d.source.kind='csv-ads';d.rows.forEach(r=>r.collectedAt=dayOffset(String(r.date),7)+'T12:00:00Z');
 const value=captureSnapshot(d,'cpa','2026-08-03','2026-08-09',now);assert.equal(value.value,50);assert.equal(value.collectedAt,'2026-08-16T12:00:00Z');
});
test('net negative GA4 revenue is preserved but has no relative percentage baseline',()=>{
 const d=data();d.source.kind='traffic';d.rows.forEach(r=>r.totalRevenue=String(r.date)<'2026-08-10'?-10:20);
 const plan={...action(),source:d.source,metric:'totalRevenue' as const,direction:'increase' as const};const measured=checkResults(recordChange(plan,'2026-08-10','Changed offer.',[d],now),[d],now);
 assert.equal(measured.result?.baseline.value,-70);assert.equal(measured.result?.after.value,140);assert.equal(measured.result?.percent,null);assert.equal(measured.result?.outcome,'improved');validateActions([measured],'brand-test');
});
