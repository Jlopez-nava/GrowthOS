import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareImport,commitImport,guessMapping,parseCSV,reportMetadata} from '../lib/domain/imports';
import {emptyWorkspace} from '../lib/domain/types';
import {analyze} from '../lib/domain/analysis';
const cfg={source:'ga4' as const,account:'example.com',currency:'USD',timezone:'America/Los_Angeles',definition:'GA4 exported key events and session key event rate',dateFormat:'ISO' as const,grain:'date_entity' as const};
// Synthetic fixture: real customer exports remain outside the source repository.
const csv='\uFEFF# Landing page: Landing page\r\n# Property: example.com\r\n# Start date: 20260829\r\n# End date: 20260925\r\nLanding page,Sessions,Active users,New users,Average engagement time per session,Key events,Total revenue,Session key event rate\r\n/contact,5,4,3,30,8,0,0.8\r\n/,100,90,80,5,15,0,0.1\r\n(not set),2,2,0,0,0,0,0';
const prepare=(text=csv,state=emptyWorkspace())=>prepareImport(text,'summary.csv',guessMapping(parseCSV(text).headers,'ga4'),cfg,state);
test('GA4 native header notes, BOM and CRLF produce a date-range snapshot without fabricated daily metrics',async()=>{
 assert.deepEqual(reportMetadata(csv),{account:'example.com',start:'20260829',end:'20260925'});
 const p=await prepare();assert.equal(p.record.start,'2026-08-29');assert.equal(p.record.end,'2026-09-25');assert.equal(p.record.rowCount,3);assert.equal(p.record.grain,'range_entity');assert.equal(p.metrics.length,0);
 assert.equal(p.record.summaryRows![0].keyEvents,8);assert.equal(p.record.summaryRows![0].sessionKeyEventRate,.8);assert.equal(p.record.summaryRows![2].entity,'(not set)');
 const saved=JSON.parse(JSON.stringify(commitImport(emptyWorkspace(),p)));assert.equal(saved.imports[0].summaryRows.length,3);assert.equal(analyze(saved).recommendations.length,0);assert.match(analyze(saved).limitations[0],/date-range summary/);
});
test('summary duplicates are rejected both at preview and commit; independent periods stay separate',async()=>{
 const p=await prepare();const state=commitImport(emptyWorkspace(),p);
 await assert.rejects(prepare(csv,state),/already imported/);assert.throws(()=>commitImport(state,p),/already imported/);
 const next=await prepare(csv.replace('20260829','20260901'),state);assert.equal(commitImport(state,next).imports.length,2);assert.equal(commitImport(state,next).metrics.length,0);
});
test('missing values remain missing; explicit percentages normalize; impossible rates fail',async()=>{
 const p=await prepare(csv.replace(',8,0,0.8',',,0,80%'));assert.equal(p.record.summaryRows![0].keyEvents,null);assert.equal(p.record.summaryRows![0].sessionKeyEventRate,.8);
 await assert.rejects(prepare(csv.replace(',8,0,0.8',',8,0,80')),/decimal from 0 to 1/);
 await assert.rejects(prepare(csv.replace('/contact,5,','/contact,0,')),/requires sessions/);
});
test('missing/reversed period notes and duplicate pages are rejected',async()=>{
 await assert.rejects(prepare(csv.replace('# Start date: 20260829','')),/original # Start date/);
 await assert.rejects(prepare(csv.replace('20260829','20260926')),/before or equal/);
 await assert.rejects(prepare(csv.replace('(not set)','/contact')),/Duplicate landing page/);
});
test('key event counts cannot be mapped as daily converted sessions, even below session count',async()=>{
 const text='Date,Landing page,Sessions,Key events\n20260901,/,100,10';const mapping=guessMapping(parseCSV(text).headers,'ga4');assert.equal(mapping.conversions,'');
 await assert.rejects(prepareImport(text,'daily.csv',{...mapping,conversions:'Key events'},cfg,emptyWorkspace()),/not converted sessions/);
});
test('summaries and daily records for the same property coexist without changing daily analysis',async()=>{
 const p=await prepare();const state=commitImport(emptyWorkspace(),p);
 const text='Date,Page,Sessions,Conversions\n20260901,/,100,10';
 const daily=await prepareImport(text,'daily.csv',guessMapping(parseCSV(text).headers,'ga4'),{...cfg,definition:'Converted sessions'},state);
 assert.equal(commitImport(state,daily).metrics.length,1);
});
