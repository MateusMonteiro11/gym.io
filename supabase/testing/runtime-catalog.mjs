// Catalogs only, in the owned disposable lane. No row data or secret values.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const [contextFile,version,output]=process.argv.slice(2)
const context=JSON.parse(fs.readFileSync(contextFile,'utf8').replace(/^\uFEFF/,''))
assert.equal(context.project,'gymio-workout-push-local');assert.equal(context.port,'55441')
assert.ok(path.isAbsolute(context.root)&&/^gymio-workout-push-[a-f0-9]{32}$/.test(path.basename(context.root)))
assert.equal(fs.readFileSync(path.join(context.root,'.owner'),'utf8').trim(),context.project)
assert.ok(['17.6.1.113','17.11.0.004'].includes(version))
const container=`supabase_db_${context.project}`
const inspect=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0]
assert.equal(inspect.Config.Image,`public.ecr.aws/supabase/postgres:${version}`)
const image=JSON.parse(execFileSync('docker',['image','inspect',inspect.Image],{encoding:'utf8'}))[0]
const sql=(input)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',maxBuffer:16*1024*1024}).trim()
const acl=(expr,type,owner)=>`(select coalesce(jsonb_agg(jsonb_build_object('grantor',a.grantor::regrole::text,'grantee',case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type),'[]') from aclexplode(${type?`coalesce(${expr},acldefault('${type}',${owner}))`:expr}) a)`
const snapshot=JSON.parse(sql(`begin read only;select jsonb_build_object(
 'server',version(),
 'extensions',(select jsonb_agg(to_jsonb(x) order by name)from(select extname name,extversion version,extowner::regrole::text owner,extnamespace::regnamespace::text schema from pg_extension where extname in('pg_cron','pg_net','supabase_vault'))x),
 'schemas',(select jsonb_agg(to_jsonb(x) order by name)from(select nspname name,nspowner::regrole::text owner,${acl('nspacl','n','nspowner')} acl from pg_namespace where nspname in('cron','net','vault'))x),
 'relations',(select jsonb_agg(to_jsonb(x) order by name)from(select n.nspname||'.'||c.relname name,c.relkind kind,c.relowner::regrole::text owner,c.relpersistence persistence,c.relrowsecurity rls,c.relforcerowsecurity force_rls,e.extname extension,
 ${acl('c.relacl','r','c.relowner')} acl,
 (select jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'notnull',attnotnull,'identity',attidentity,'generated',attgenerated,'default',pg_get_expr(adbin,adrelid),'acl',${acl('attacl')})order by attnum) from pg_attribute left join pg_attrdef on adrelid=attrelid and adnum=attnum where attrelid=c.oid and attnum>0 and not attisdropped) columns,
 (select jsonb_agg(pg_get_constraintdef(oid) order by conname)from pg_constraint where conrelid=c.oid) constraints,
 (select jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid::regclass::text)from pg_index where indrelid=c.oid) indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.refclassid='pg_extension'::regclass and d.deptype='e' left join pg_extension e on e.oid=d.refobjid where n.nspname in('cron','net','vault') and c.relkind<>'S')x),
 'sequences',(select jsonb_agg(to_jsonb(x) order by name)from(select n.nspname||'.'||c.relname name,c.relowner::regrole::text owner,e.extname extension,${acl('c.relacl','S','c.relowner')} acl,format_type(seqtypid,null) type,seqstart,seqincrement,seqmin,seqmax,seqcache,seqcycle from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid left join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.refclassid='pg_extension'::regclass and d.deptype='e' left join pg_extension e on e.oid=d.refobjid where n.nspname in('cron','net','vault'))x),
 'functions',(select jsonb_agg(to_jsonb(x) order by name)from(select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,p.proowner::regrole::text owner,e.extname extension,l.lanname language,p.prosecdef definer,p.proconfig config,pg_get_function_arguments(p.oid) arguments,pg_get_function_result(p.oid) result,p.provolatile volatility,p.proparallel parallel,p.proisstrict strict,${acl('p.proacl','f','p.proowner')} acl,p.prosrc source,p.probin binary from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang left join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e' left join pg_extension e on e.oid=d.refobjid where n.nspname in('cron','net','vault'))x),
 'policies',(select jsonb_agg(to_jsonb(x) order by name)from(select n.nspname||'.'||c.relname||'.'||polname name,polcmd command,polpermissive permissive,(select array_agg(case when r=0 then 'PUBLIC' else r::regrole::text end order by r::regrole::text)from unnest(polroles)r) roles,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check from pg_policy join pg_class c on c.oid=polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('cron','net','vault'))x),
 'defaults',(select jsonb_agg(to_jsonb(x) order by name)from(select coalesce(n.nspname,'*')||':'||defaclrole::regrole::text||':'||defaclobjtype::text name,${acl('defaclacl')} acl from pg_default_acl left join pg_namespace n on n.oid=defaclnamespace where defaclnamespace=0 or n.nspname in('cron','net','vault'))x));commit;`))
assert.equal(snapshot.extensions.find(e=>e.name==='pg_net').version,version==='17.6.1.113'?'0.20.0':'0.20.4')
assert.equal(snapshot.extensions.find(e=>e.name==='pg_cron').version,'1.6.4')
assert.equal(snapshot.extensions.find(e=>e.name==='supabase_vault').version,'0.3.1')
assert.match(snapshot.server,new RegExp(`PostgreSQL ${version.startsWith('17.6')?'17\\.6':'17\\.11'} `))
const result={image:inspect.Config.Image,digests:image.RepoDigests,imageId:inspect.Image,snapshot}
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({passed:true,image:result.image,digests:result.digests,extensions:snapshot.extensions,pgNetCatalogSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}))
