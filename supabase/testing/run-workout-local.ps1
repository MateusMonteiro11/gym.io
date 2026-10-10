param([switch]$KeepForManual)
$ErrorActionPreference='Stop'
$workoutProject='gymio-workout-push-local'
$workoutWorkspace=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $workoutWorkspace
$workoutRoot=$null; $workoutStarted=$false; $workoutServe=$null; $workoutPassed=$false
$workoutEnvironment=@{}
foreach($workoutName in @('SUPABASE_HOME','SUPABASE_TELEMETRY_DISABLED','DO_NOT_TRACK','SUPABASE_ACCESS_TOKEN')){
  $workoutEnvironment[$workoutName]=[Environment]::GetEnvironmentVariable($workoutName,'Process')
}
function Invoke-WorkoutCli([string[]]$Arguments,[string]$OutputPath){
  $ErrorActionPreference='Continue'
  & supabase @Arguments *> $OutputPath
  if($LASTEXITCODE -ne 0){throw "Local CLI failed: $($Arguments[0])"}
}
function Invoke-WorkoutTest([string]$Script,[string]$Stage){
  if($Stage){& node $Script $Stage (Join-Path $workoutRoot 'context.json')}
  else{& node $Script (Join-Path $workoutRoot 'context.json')}
  if($LASTEXITCODE -ne 0){throw "Local matrix failed: $Script $Stage"}
}
function Assert-WorkoutHistory{
  $workoutHashes=@{
    '20260725194232_auth_email_security.sql'='cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6'
    '20260821190134_workout_session_persistence_expand.sql'='6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db'
    '20260823003337_exercise_memory_read.sql'='7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02'
    '20261007215944_push_foundation.sql'='f1212ee8d19d7d8b0a362f1ffc65b403898be433b2d13712b6967b3490e45f04'
  }
  foreach($workoutPair in $workoutHashes.GetEnumerator()){
    if((Get-FileHash -LiteralPath ('supabase/migrations/'+$workoutPair.Key)).Hash.ToLower() -ne $workoutPair.Value){throw "STOP historical hash changed: $($workoutPair.Key); no automatic restoration"}
  }
}
try{
  Assert-WorkoutHistory
  & docker version --format '{{.Server.Version}}'
  if($LASTEXITCODE -ne 0){throw 'Docker unavailable; foundation remains incomplete'}
  $workoutExisting=@(& docker ps -a --filter "label=com.supabase.cli.project=$workoutProject" --format '{{.Names}}')
  if($LASTEXITCODE -ne 0 -or $workoutExisting.Count){throw 'Refusing to reuse any existing B stack'}
  $workoutRoot=Join-Path ([IO.Path]::GetTempPath()) ('gymio-workout-push-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path (Join-Path $workoutRoot 'supabase') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $workoutRoot '.owner') $workoutProject -Encoding ascii
  @{root=$workoutRoot;project=$workoutProject;port='55441'}|ConvertTo-Json|Set-Content (Join-Path $workoutRoot 'context.json') -Encoding utf8
  $workoutConfig=[IO.File]::ReadAllText((Join-Path $workoutWorkspace 'supabase/config.toml')).Replace('gymio-push-foundation-local',$workoutProject).Replace('55431','55441').Replace('55432','55442').Replace('55430','55440')
  [IO.File]::WriteAllText((Join-Path $workoutRoot 'supabase/config.toml'),$workoutConfig,[Text.UTF8Encoding]::new($false))
  Copy-Item -LiteralPath 'supabase/functions' -Destination (Join-Path $workoutRoot 'supabase/functions') -Recurse
  foreach($workoutPair in @(@('push-compat-spike','compat-spike'),@('push-integration','edge-integration'),@('workout-integration','workout-edge-integration'))){
    $workoutTarget=Join-Path $workoutRoot ('supabase/functions/'+$workoutPair[0]);New-Item -ItemType Directory -Path $workoutTarget|Out-Null
    Copy-Item -LiteralPath ('supabase/testing/'+$workoutPair[1]+'/index.ts') -Destination (Join-Path $workoutTarget 'index.ts')
  }
  $env:SUPABASE_HOME=Join-Path $workoutRoot 'cli-home';$env:SUPABASE_TELEMETRY_DISABLED='1';$env:DO_NOT_TRACK='1'
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  $workoutStarted=$true
  Invoke-WorkoutCli @('start','--workdir',$workoutRoot,'--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor') (Join-Path $workoutRoot 'start.log')
  $ErrorActionPreference='Continue'
  & supabase status --workdir $workoutRoot --output json 2>(Join-Path $workoutRoot 'status-error.log')|Set-Content (Join-Path $workoutRoot 'status.json') -Encoding utf8
  if($LASTEXITCODE -ne 0){throw 'Local status failed'}
  $ErrorActionPreference='Stop'
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'credentials'
  Assert-WorkoutHistory
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'bootstrap'
  'create extension pg_cron;create extension pg_net;'|& docker exec -i "supabase_db_$workoutProject" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
  if($LASTEXITCODE -ne 0){throw 'Official extensions failed; no ACL repair permitted'}
  Invoke-WorkoutTest 'supabase/testing/extension-gate.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/scheduler-spike.mjs' ''
  Assert-WorkoutHistory
  Invoke-WorkoutTest 'supabase/testing/workout-apply.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/workout-secrets.mjs' ''
  $workoutCli=Join-Path (Split-Path (Get-Command supabase).Source) 'node_modules\supabase\dist\supabase.js'
  $workoutServe=Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"'+$workoutCli+'"'),'functions','serve','--workdir',('"'+$workoutRoot+'"'),'--env-file',('"'+(Join-Path $workoutRoot 'edge.env')+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $workoutRoot 'serve.log') -RedirectStandardError (Join-Path $workoutRoot 'serve-error.log')
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'ready'
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'spike'
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'sql'
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'data-api'
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'edge'
  Invoke-WorkoutTest 'supabase/testing/workout-frontend-security.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/workout-edge-tests.mjs' ''
  # Entry injection occurs only in this disposable snapshot after testing the
  # actual production entrypoint with an empty queue. HTTP still accepts {} only.
  Copy-Item -LiteralPath 'supabase/testing/workout-sender-harness/index.ts' -Destination (Join-Path $workoutRoot 'supabase/functions/workout-push/index.ts') -Force
  Invoke-WorkoutTest 'supabase/testing/local-tests.mjs' 'ready'
  Invoke-WorkoutTest 'supabase/testing/workout-local-tests.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/workout-data-api.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/workout-dispatch.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/workout-performance.mjs' ''
  Invoke-WorkoutTest 'supabase/testing/extension-gate.mjs' ''
  & docker run --rm --name gymio-workout-idb-test --label com.gymio.validation=workout-push -v "${workoutWorkspace}:/workspace:ro" -w /workspace denoland/deno:2.1.4 deno run --no-config --no-lock --node-modules-dir=none --allow-read --allow-env --allow-sys supabase/testing/worker-indexeddb.mjs
  if($LASTEXITCODE -ne 0){throw 'IndexedDB matrix failed'}
  & docker run --rm --name gymio-workout-deno-check --label com.gymio.validation=workout-push -v "${workoutRoot}\supabase\functions:/work:ro" -w /work denoland/deno:2.1.4 deno check --quiet --frozen --config deno.json push-test/index.ts push-compat-spike/index.ts push-integration/index.ts workout-push/index.ts workout-integration/index.ts
  if($LASTEXITCODE -ne 0){throw 'Frozen Deno check failed'}
  & docker run --rm --name gymio-workout-prod-check --label com.gymio.validation=workout-push -v "${workoutWorkspace}\supabase\functions:/work:ro" -w /work denoland/deno:2.1.4 deno check --quiet --frozen --config deno.json workout-push/index.ts
  if($LASTEXITCODE -ne 0){throw 'Production Deno check failed'}
  Invoke-WorkoutCli @('db','lint','--local','--workdir',$workoutRoot,'--schema','public,gymio_private,gymio_push_private,gymio_workout_push_private','--level','warning','--fail-on','error') (Join-Path $workoutRoot 'lint.json')
  Assert-WorkoutHistory
  Write-Output ('B SHA-256: '+(Get-FileHash -LiteralPath 'supabase/migrations/20261010183821_workout_notifications.sql').Hash.ToLower())
  foreach($workoutReport in @('scheduler-spike-result.json','workout-sql-result.json','workout-api-result.json','workout-edge-result.json','workout-dispatch-result.json','workout-performance.json')){
    Write-Output ($workoutReport+': '+[IO.File]::ReadAllText((Join-Path $workoutRoot $workoutReport)))
  }
  Write-Output 'PASS fresh complete local A + extension gate + scheduler + B matrix; no remote operations'
  $workoutPassed=$true
  if($KeepForManual){
    Copy-Item -LiteralPath 'supabase/functions/workout-push/index.ts' -Destination (Join-Path $workoutRoot 'supabase/functions/workout-push/index.ts') -Force
    Set-Content (Join-Path $workoutRoot 'serve.pid') $workoutServe.Id -Encoding ascii
    Write-Output ('Manual local runtime retained: '+$workoutRoot+'; job remains inactive; see WORKOUT_NOTIFICATIONS.md')
  }
}catch{
 if($workoutRoot){
  foreach($workoutLog in @('serve.log','serve-error.log')){
   $workoutLogPath=Join-Path $workoutRoot $workoutLog
   if(Test-Path -LiteralPath $workoutLogPath){
    try{
      $workoutLogText=Get-Content -LiteralPath $workoutLogPath -Raw
      Write-Output ('Runtime diagnostics '+$workoutLog+': '+(@{bootError=($workoutLogText -match 'worker boot error');cpuLimit=($workoutLogText -match 'CPU time|cpu time|CPUTime');earlyTermination=($workoutLogText -match 'early termination');restarts=([regex]::Matches($workoutLogText,'Setting up Edge Functions runtime').Count)}|ConvertTo-Json -Compress))
    }catch{Write-Output 'Runtime diagnostics unavailable; preserve original matrix failure'}
   }
  }
 }
 throw
}finally{
 if(-not ($KeepForManual -and $workoutPassed)){
  if($workoutServe){$workoutServe.Refresh();if(-not $workoutServe.HasExited){Stop-Process -Id $workoutServe.Id}}
  if($workoutStarted){Invoke-WorkoutCli @('stop','--project-id',$workoutProject,'--no-backup') (Join-Path $workoutRoot 'stop.log')}
  if($workoutRoot -and (Test-Path (Join-Path $workoutRoot '.owner'))){
    $workoutResolved=[IO.Path]::GetFullPath($workoutRoot);$workoutTemp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if(-not $workoutResolved.StartsWith($workoutTemp,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $workoutResolved -Leaf) -notmatch '^gymio-workout-push-[a-f0-9]{32}$' -or (Get-Content (Join-Path $workoutResolved '.owner')).Trim() -ne $workoutProject){throw 'Unsafe cleanup target'}
    Remove-Item -LiteralPath $workoutResolved -Recurse -Force
  }
 }
  foreach($workoutName in $workoutEnvironment.Keys){[Environment]::SetEnvironmentVariable($workoutName,$workoutEnvironment[$workoutName],'Process')}
}
