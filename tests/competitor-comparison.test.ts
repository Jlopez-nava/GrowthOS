import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseComparison,comparisonTargets,compareWebsites} from '../server/competitor-comparison.mjs';
const brand={name:'Acme',website:'https://acme.com/',products:'Team software',audience:'Small teams',geography:'United States'};
const entries=[{id:'beta',name:'Beta',website:'https://beta.com/',status:'confirmed'}];
const targets=comparisonTargets(brand,entries,['beta']);
const idea={title:'Test a clearer demo CTA',area:'Conversion',priority:'High',rationale:'The pages use different next steps.',change:'Test a demo button beside the product promise.',measurement:'Compare qualified demos per session over equal windows.',evidenceUrls:['https://acme.com/product','https://beta.com/product']};
function fixture(){return {status:'completed',usage:{input_tokens:300,output_tokens:200},output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{url:'https://acme.com/product',title:'Acme product'},{url:'https://beta.com/product',title:'Beta product'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({sites:[brand,...entries].map(s=>({website:s.website,findings:[{area:'Conversion',observation:'A product call to action is visible.',evidenceUrls:[s.website+'product']}],limitations:'Only the product page was available.'})),opportunities:[idea],limitations:'Limited page coverage.'})}]}]};}
function alter(change:(raw:any)=>void){const res=fixture();const text=res.output[1].content![0];const raw=JSON.parse(text.text);change(raw);text.text=JSON.stringify(raw);return res;}
test('comparisons only accept selected confirmed competitors, at most three, and public brand context',()=>{
 assert.throws(()=>comparisonTargets(brand,entries,[]));assert.throws(()=>comparisonTargets(brand,entries,['beta','beta']));assert.throws(()=>comparisonTargets(brand,[{...entries[0],status:'dismissed'}],['beta']));
 const result=comparisonTargets({...brand,budget:9999,privateNotes:'sensitive'},entries,['beta']);assert(!JSON.stringify(result).includes('9999'));assert(!JSON.stringify(result).includes('sensitive'));
});
test('website findings need exact evidence on the matching domain; unknowns never become claims of absence',()=>{
 const res=alter(raw=>{raw.sites[0].findings.push({area:'Trust',observation:'No testimonials exist.',evidenceUrls:['https://invented.com/']});raw.sites[1].findings.push({area:'Offers',observation:'Free trial.',evidenceUrls:['https://acme.com/product']});});
 const parsed=parseComparison(res,targets);assert.equal(parsed.opportunities.length,1);assert.equal(parsed.sites[0].findings.find(f=>f.area==='Trust')?.verified,false);assert.equal(parsed.sites[1].findings.find(f=>f.area==='Offers')?.verified,false);assert(!JSON.stringify(parsed).includes('No testimonials exist'));
});
test('recommendations need both brand and competitor sources used in findings; incomplete and one-sided reports fail',()=>{
 const res=alter(raw=>{raw.opportunities.push({...idea,evidenceUrls:['https://beta.com/product']});raw.opportunities.push({...idea,evidenceUrls:['https://acme.com/invented','https://beta.com/product']});});
 const parsed=parseComparison(res,targets);assert.equal(parsed.opportunities.length,1);assert.equal(parsed.filteredOpportunities,2);
 assert.throws(()=>parseComparison({...fixture(),status:'incomplete'},targets));
 assert.throws(()=>parseComparison(alter(raw=>raw.sites.shift()),targets),/Not enough website evidence/);
});
test('comparison researches each domain separately, then synthesizes only sourced findings without web tools',async()=>{
 const requests:any[]=[];const result=await compareWebsites({OPENAI_API_KEY:'fixture-token'},targets,async(url:any,init:any)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'manual');const request=JSON.parse(init.body);requests.push(request);
  const reply=fixture(),content=reply.output[1].content![0],raw=JSON.parse(content.text),input=JSON.parse(request.input);
  content.text=JSON.stringify(request.tools?raw.sites.find((s:any)=>s.website===input.website):{opportunities:[idea],limitations:'Limited sample'});
  return new Response(JSON.stringify(reply));
 });
 assert.equal(result.opportunities.length,1);assert.equal(requests.length,3);assert(requests.every(r=>r.store===false));
 assert.deepEqual(requests.slice(0,2).map(r=>r.tools[0].filters.allowed_domains),[['acme.com'],['beta.com']]);assert(requests.slice(0,2).every(r=>r.max_tool_calls===2));assert.equal(requests[2].tools,undefined);assert(JSON.parse(requests[2].input).sites.every((s:any)=>s.findings.some((f:any)=>f.verified)));
 await assert.rejects(compareWebsites({OPENAI_API_KEY:'fixture-token'},targets,async()=>new Response('upstream sensitive content',{status:500})),/research provider/);
});
