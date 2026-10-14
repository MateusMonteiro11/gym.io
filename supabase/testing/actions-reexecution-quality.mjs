// C matrix quality/evidence only. No environment files are loaded or changed.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assertActionsHistory} from './actions-context.mjs'
const digest=b=>createHash('sha256').update(b).digest('hex')
export function inventory(){
 const files=execFileSync('rg',['--files','--hidden','--no-ignore','-g','!.git','-g','!node_modules','-g','!dist'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).sort()
 return Object.fromEntries(files.map(f=>[f.replaceAll('\\','/'),{bytes:fs.statSync(f).size,sha256:digest(fs.readFileSync(f))}]))
}
const stage=process.argv[2],root=process.argv[3]
assertActionsHistory()
if(stage==='inventory'){
 const files=inventory(),self=path.relative(process.cwd(),path.resolve(root)).replaceAll('\\','/');delete files[self]
 fs.writeFileSync(root,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),selfExcluded:self,files},null,2)+'\n')
 console.log('PASS inventory recorded, including ignored environment/artifacts; contents not printed')
}else if(stage==='npm'){
 assert.ok(root&&path.isAbsolute(root));execFileSync('npm.cmd',['test'],{shell:true,stdio:['ignore',fs.openSync(path.join(root,'npm-test.log'),'w'),fs.openSync(path.join(root,'npm-test-error.log'),'w')]});console.log('PASS npm test')
}else if(stage==='build'){
 assert.ok(root&&path.isAbsolute(root));process.env.VITE_SUPABASE_URL='http://localhost:55451';process.env.VITE_SUPABASE_ANON_KEY='local-public-build-fixture'
 const {build}=await import('vite');await build({envDir:root,build:{outDir:path.join(root,'build'),emptyOutDir:true}});console.log('PASS build with isolated public local configuration')
}else throw Error('Unknown quality stage')
