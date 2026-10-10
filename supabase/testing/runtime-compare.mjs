import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const file=(version)=>path.join(os.tmpdir(),`gymio-runtime-compat-pg-net-${version}.json`)
const a=JSON.parse(fs.readFileSync(file('0.20.0'),'utf8')),b=JSON.parse(fs.readFileSync(file('0.20.4'),'utf8'))
assert.equal(a.image,'public.ecr.aws/supabase/postgres:17.6.1.113')
assert.equal(b.image,'public.ecr.aws/supabase/postgres:17.11.0.004')
const differences=[],counts={}
const relevant=(category,row)=>category==='extensions'?row.name==='pg_net':row.name.startsWith('net')||(category==='defaults'&&row.name.startsWith('*:'))
for(const category of ['extensions','schemas','relations','sequences','functions','policies','defaults']){
 const left=new Map((a.snapshot[category]??[]).filter(row=>relevant(category,row)).map(row=>[row.name,row]))
 const right=new Map((b.snapshot[category]??[]).filter(row=>relevant(category,row)).map(row=>[row.name,row]))
 counts[category]={v0200:left.size,v0204:right.size}
 for(const name of new Set([...left.keys(),...right.keys()])){
  if(!left.has(name)||!right.has(name)){differences.push({category,name,field:'object',classification:'security',v0200:left.get(name)??null,v0204:right.get(name)??null});continue}
  for(const field of new Set([...Object.keys(left.get(name)),...Object.keys(right.get(name))])){
   const av=left.get(name)[field],bv=right.get(name)[field]
   if(JSON.stringify(av)===JSON.stringify(bv))continue
   const classification=category==='extensions'&&field==='version'?'representation':
    /acl|owner|definer|config|rls|policy|roles/.test(field)||category==='policies'?'security':'functional'
   differences.push({category,name,field,classification,v0200:av,v0204:bv})
  }
 }
}
const ancillaryDifferences=[]
for(const category of ['extensions','schemas','relations','sequences','functions','policies','defaults']){
 const right=new Map((b.snapshot[category]??[]).map(row=>[row.name,row]))
 for(const row of a.snapshot[category]??[]){
  if(relevant(category,row))continue
  const old=right.get(row.name)
  assert.ok(old,`unmatched ancillary object ${row.name}`)
  for(const field of Object.keys(row))if(JSON.stringify(row[field])!==JSON.stringify(old[field])){
   let classification
   const entry=(grantee,privilege,grantable=false)=>({grantor:'supabase_admin',grantee,privilege,grantable})
   if(category==='sequences'&&['cron.jobid_seq','cron.runid_seq'].includes(row.name)&&field==='acl'){
    assert.deepEqual(row.acl,[entry('supabase_admin','USAGE')])
    assert.deepEqual(old.acl,[entry('PUBLIC','SELECT'),...['SELECT','UPDATE','USAGE'].map(privilege=>entry('supabase_admin',privilege))])
    classification='security (reduced PUBLIC privileges)'
   }else if(category==='relations'&&row.name==='cron.job_run_details'&&field==='acl'){
    const added=row.acl.filter(acl=>!old.acl.some(previous=>JSON.stringify(previous)===JSON.stringify(acl)))
    assert.deepEqual(added,[entry('postgres','TRIGGER',true)])
    assert.deepEqual(row.acl.filter(acl=>!added.includes(acl)),old.acl)
    classification='irrelevant (administrative postgres ACL)'
   }else{assert.fail(`STOP: unreviewed ancillary difference ${category} ${row.name} ${field}`)}
   ancillaryDifferences.push({category,name:row.name,field,classification,v0200:row[field],v0204:old[field]})
  }
 }
 assert.equal((a.snapshot[category]??[]).filter(row=>!relevant(category,row)).length,(b.snapshot[category]??[]).filter(row=>!relevant(category,row)).length,`ancillary catalog cardinality ${category}`)
}
const result={images:[a.image,b.image],digests:[a.digests,b.digests],counts,differences,ancillaryDifferences,sameRelevantSurface:differences.every(d=>d.category==='extensions'&&d.field==='version')}
fs.writeFileSync(path.join(os.tmpdir(),'gymio-runtime-compat-comparison.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
assert.equal(result.sameRelevantSurface,true,'STOP: distinct pg_net baseline requires explicit review, never broaden the assertion')
