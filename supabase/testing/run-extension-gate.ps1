param()
$ErrorActionPreference = 'Stop'
$gateProject = 'gymio-extension-security-local'
$gateWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $gateWorkspace
$gateRoot = $null
$gateStarted = $false
$gateServe = $null
$gateResult = $null
$gateOriginalEnvironment = @{}
foreach ($gateName in @('SUPABASE_HOME','SUPABASE_TELEMETRY_DISABLED','DO_NOT_TRACK','SUPABASE_ACCESS_TOKEN')) {
  $gateOriginalEnvironment[$gateName] = [Environment]::GetEnvironmentVariable($gateName,'Process')
}
function Invoke-GateCli([string[]]$Arguments, [string]$OutputPath) {
  $ErrorActionPreference = 'Continue'
  & supabase @Arguments *> $OutputPath
  if ($LASTEXITCODE -ne 0) { throw "Supabase local command failed: $($Arguments[0]); log retained only during this run." }
}
function Invoke-GateStage([string]$Stage) {
  & node 'supabase/testing/local-tests.mjs' $Stage (Join-Path $gateRoot 'context.json')
  if ($LASTEXITCODE -ne 0) { throw "Push matrix failed: $Stage" }
}
function Assert-HistoricalHashes {
  $gateExpected = @{
    '20260725194232_auth_email_security.sql' = 'cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6'
    '20260821190134_workout_session_persistence_expand.sql' = '6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db'
    '20260823003337_exercise_memory_read.sql' = '7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02'
  }
  foreach ($gateEntry in $gateExpected.GetEnumerator()) {
    if ((Get-FileHash -LiteralPath (Join-Path $gateWorkspace ('supabase/migrations/'+$gateEntry.Key)) -Algorithm SHA256).Hash.ToLower() -ne $gateEntry.Value) {
      throw "Historical hash changed: $($gateEntry.Key). No automatic restoration."
    }
  }
}
try {
  Assert-HistoricalHashes
  & docker version --format '{{.Server.Version}}'
  if ($LASTEXITCODE -ne 0) { throw 'Docker unavailable' }
  $gateExisting = @(& docker ps -a --filter "label=com.supabase.cli.project=$gateProject" --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0 -or $gateExisting.Count) { throw 'Refusing to reuse an existing extension-gate stack' }
  $gateRoot = Join-Path ([IO.Path]::GetTempPath()) ('gymio-extension-gate-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path (Join-Path $gateRoot 'supabase') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $gateRoot '.owner') -Value $gateProject -Encoding ascii
  @{root=$gateRoot;project=$gateProject;port='55441'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $gateRoot 'context.json') -Encoding utf8
  $gateConfig = [IO.File]::ReadAllText((Join-Path $gateWorkspace 'supabase/config.toml')).Replace('gymio-push-foundation-local',$gateProject).Replace('55431','55441').Replace('55432','55442').Replace('55430','55440')
  [IO.File]::WriteAllText((Join-Path $gateRoot 'supabase/config.toml'),$gateConfig,[Text.UTF8Encoding]::new($false))
  Copy-Item -LiteralPath 'supabase/functions' -Destination (Join-Path $gateRoot 'supabase/functions') -Recurse
  foreach ($gatePair in @(@('push-compat-spike','compat-spike'),@('push-integration','edge-integration'))) {
    $gateTarget = Join-Path $gateRoot ('supabase/functions/'+$gatePair[0])
    New-Item -ItemType Directory -Path $gateTarget | Out-Null
    Copy-Item -LiteralPath ('supabase/testing/'+$gatePair[1]+'/index.ts') -Destination (Join-Path $gateTarget 'index.ts')
  }
  $env:SUPABASE_HOME = Join-Path $gateRoot 'cli-home'
  $env:SUPABASE_TELEMETRY_DISABLED = '1'
  $env:DO_NOT_TRACK = '1'
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Invoke-GateCli @('start','--help') (Join-Path $gateRoot 'start-help.log')
  $gateStarted = $true
  Invoke-GateCli @('start','--workdir',$gateRoot,'--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor') (Join-Path $gateRoot 'start.log')
  $ErrorActionPreference = 'Continue'
  & supabase status --workdir $gateRoot --output json 2> (Join-Path $gateRoot 'status-error.log') | Set-Content -LiteralPath (Join-Path $gateRoot 'status.json') -Encoding utf8 -ErrorAction Stop
  if ($LASTEXITCODE -ne 0) { throw 'Local status failed' }
  $ErrorActionPreference = 'Stop'
  Invoke-GateStage 'credentials'
  Assert-HistoricalHashes
  Invoke-GateStage 'bootstrap'
  'create extension pg_cron; create extension pg_net;' | & docker exec -i "supabase_db_$gateProject" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Extension installation failed; no ACL repair permitted' }
  $gateCli = Join-Path (Split-Path (Get-Command supabase).Source) 'node_modules\supabase\dist\supabase.js'
  Invoke-GateCli @('functions','serve','--help') (Join-Path $gateRoot 'serve-help.log')
  $gateServe = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"'+$gateCli+'"'),'functions','serve','--workdir',('"'+$gateRoot+'"'),'--env-file',('"'+(Join-Path $gateRoot 'edge.env')+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $gateRoot 'serve.log') -RedirectStandardError (Join-Path $gateRoot 'serve-error.log')
  Invoke-GateStage 'ready'
  Invoke-GateStage 'spike'
  Invoke-GateStage 'sql'
  Invoke-GateStage 'data-api'
  Invoke-GateStage 'edge'
  & node 'supabase/testing/extension-gate.mjs' (Join-Path $gateRoot 'context.json')
  if ($LASTEXITCODE -ne 0) { throw 'Extension boundary gate failed' }
  & docker run --rm --name gymio-extension-deno-check --label com.gymio.validation=extension-security -v "${gateRoot}\supabase\functions:/work:ro" -w /work denoland/deno:2.1.4 deno check --quiet --frozen --config deno.json push-test/index.ts push-compat-spike/index.ts push-integration/index.ts
  if ($LASTEXITCODE -ne 0) { throw 'Deno check failed' }
  Write-Output 'PASS Deno check (frozen lockfile; production + test functions)'
  Invoke-GateCli @('db','lint','--help') (Join-Path $gateRoot 'lint-help.log')
  Invoke-GateCli @('db','lint','--local','--workdir',$gateRoot,'--schema','public,gymio_private,gymio_push_private','--level','warning','--fail-on','error') (Join-Path $gateRoot 'lint.json')
  Write-Output 'PASS local db lint (public/private application schemas)'
  Assert-HistoricalHashes
  $gateResult = Get-Content -LiteralPath (Join-Path $gateRoot 'extension-result.json') -Raw | ConvertFrom-Json
  Write-Output ('PASS fresh complete matrix; '+$gateResult.http.Count+' HTTP profile rejections; '+$gateResult.wrapperAudit.Count+' reviewed function bodies; '+$gateResult.negatives.Count+' new negative fixtures')
  Write-Output ('Push SHA-256: '+(Get-FileHash -LiteralPath 'supabase/migrations/20261007215944_push_foundation.sql' -Algorithm SHA256).Hash.ToLower())
} finally {
  if ($gateServe -and -not $gateServe.HasExited) { Stop-Process -Id $gateServe.Id -ErrorAction SilentlyContinue }
  if ($gateStarted) {
    Invoke-GateCli @('stop','--project-id',$gateProject,'--no-backup') (Join-Path $gateRoot 'stop.log')
    $gateRemaining = @(& docker ps -a --filter "label=com.supabase.cli.project=$gateProject" --format '{{.Names}}')
    if ($gateRemaining.Count) { throw 'Disposable containers remain; preserve temp evidence for analysis' }
  }
  if ($gateRoot) {
    $gateResolved = [IO.Path]::GetFullPath($gateRoot)
    $gateTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if (-not $gateResolved.StartsWith($gateTemp,[StringComparison]::OrdinalIgnoreCase) -or
      -not (Split-Path $gateResolved -Leaf).StartsWith('gymio-extension-gate-') -or
      (Get-Content -LiteralPath (Join-Path $gateResolved '.owner')).Trim() -ne $gateProject) { throw 'Unsafe cleanup target' }
    Remove-Item -LiteralPath $gateResolved -Recurse -Force
  }
  foreach ($gateName in $gateOriginalEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($gateName,$gateOriginalEnvironment[$gateName],'Process')
  }
}
