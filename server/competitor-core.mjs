// Shared validation only. No network or credentials are available in this module.
export function publicWebsite(value){
 if(typeof value!=='string'||value.length>2000)throw new Error('Enter a public website address.');
 let u;try{u=new URL(/^https?:\/\//i.test(value.trim())?value.trim():'https://'+value.trim());}catch{throw new Error('Enter a valid website address.');}
 const h=u.hostname.toLowerCase().replace(/\.$/,'');
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!h.includes('.')||h.includes(':')||/^\d+(\.\d+)*$/.test(h)||/\.(localhost|local|internal|test|invalid|example)$/.test(h)||h==='localhost'||h==='example.com'||h==='example.org'||h==='example.net')throw new Error('Use a public business website, without a login, IP address, or custom port.');
 u.hostname=h;u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['gclid','fbclid'].includes(k))u.searchParams.delete(k);
 return u.toString();
}
export function competitorDomain(value){return new URL(publicWebsite(value)).hostname.replace(/^www\./,'');}
export function manualCompetitor(input,brandWebsite=''){
 const name=typeof input?.name==='string'?input.name.trim():'';
 if(!name||name.length>100)throw new Error('Enter a competitor name of up to 100 characters.');
 const website=publicWebsite(input.website),domain=competitorDomain(website);
 let own='';try{own=competitorDomain(brandWebsite);}catch{}
 if(domain===own||domain.endsWith('.'+own)&&own)throw new Error('This is your own brand’s website. Add a different business.');
 return {name,website,domain};
}
export function mergeManual(entries,inputs,brandWebsite,at){
 if(!Array.isArray(inputs)||inputs.length>30)throw new Error('Add up to 30 competitors at a time.');
 const next=[...entries];
 for(const input of inputs){const clean=manualCompetitor(input,brandWebsite);if(next.some(e=>e.domain===clean.domain))continue;
  if(next.length>=100)throw new Error('This brand has reached its 100-entry competitor limit.');
  next.push({...clean,id:crypto.randomUUID(),status:'confirmed',source:'manual',reason:'Added by your team.',evidence:[],createdAt:at,reviewedAt:at});
 }
 return next;
}
export function emptyResearch(){return {revision:0,entries:[],lastScan:null,attempt:null,daily:{date:'',count:0}};}
