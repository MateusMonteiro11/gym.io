param([switch]$KeepForManual)
$ErrorActionPreference = 'Stop'
$pushRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $pushRoot
$pushRuntime = Join-Path $pushRoot 'supabase\.runtime'
$pushServe = $null
$pushStarted = $false
$pushOwnRuntime = $false
$pushPassed = $false
$pushServeRoot = $null
$pushHadCliTemp = Test-Path -LiteralPath 'supabase/.temp'
$pushHadBranches = Test-Path -LiteralPath 'supabase/.branches'
$pushHadStartSecrets = Test-Path -LiteralPath 'supabase/.temp/start-secrets'
function Invoke-PushStage([string]$Stage) {
  & node 'supabase/testing/local-tests.mjs' $Stage
  if ($LASTEXITCODE -ne 0) { throw "Local stage failed: $Stage" }
}
function Invoke-LocalSupabase([string[]]$Arguments, [string]$LogPath, [string]$JsonPath) {
  # Windows PowerShell 5.1 turns normal CLI stderr progress into ErrorRecords.
  # Judge the native process by its exit code; retain Stop for filesystem work.
  $ErrorActionPreference = 'Continue'
  if ($JsonPath) { & supabase @Arguments | Set-Content -LiteralPath $JsonPath -Encoding utf8 -ErrorAction Stop }
  elseif ($LogPath) { & supabase @Arguments *> $LogPath }
  else { & supabase @Arguments }
  if ($LASTEXITCODE -ne 0) { throw "Supabase CLI failed: $($Arguments[0])" }
}
try {
  if (Test-Path -LiteralPath $pushRuntime) { throw 'Existing runtime found; preserve it and stop its stack explicitly before a fresh run.' }
  if ((Test-Path -LiteralPath '.env.push.local') -or (Test-Path -LiteralPath 'supabase/functions/push-compat-spike') -or (Test-Path -LiteralPath 'supabase/functions/push-integration')) { throw 'Existing local env or scratch function found; preserve it before a fresh run.' }
  New-Item -ItemType Directory -Path $pushRuntime | Out-Null
  $pushOwnRuntime = $true
  Set-Content -LiteralPath (Join-Path $pushRuntime '.owner') -Value 'gymio-push-foundation-local' -Encoding ascii
  & docker version --format '{{.Server.Version}}'
  if ($LASTEXITCODE -ne 0) { throw 'Docker unavailable: mandatory local matrix cannot run.' }
  $pushExisting = @(& docker ps -a --filter 'label=com.supabase.cli.project=gymio-push-foundation-local' --format '{{.Names}}')
  if ($pushExisting.Count) { throw 'Existing local stack found; refusing to reuse resources.' }
  $pushStarted = $true
  Invoke-LocalSupabase @('start','--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor') -LogPath (Join-Path $pushRuntime 'start.log')
  Invoke-LocalSupabase @('status','--output','json') -JsonPath (Join-Path $pushRuntime 'status.json')
  Invoke-PushStage 'credentials'
  # Serve immutable snapshots outside OneDrive: sync metadata writes must not
  # restart the CLI file watcher in the middle of a security test.
  $pushServeRoot = Join-Path ([IO.Path]::GetTempPath()) ('gymio-push-serve-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path (Join-Path $pushServeRoot 'supabase') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $pushServeRoot '.owner') -Value 'gymio-push-foundation-local' -Encoding ascii
  Copy-Item -LiteralPath 'supabase/config.toml' -Destination (Join-Path $pushServeRoot 'supabase/config.toml')
  Copy-Item -LiteralPath 'supabase/functions' -Destination (Join-Path $pushServeRoot 'supabase/functions') -Recurse
  Set-Content -LiteralPath (Join-Path $pushRuntime 'serve-workdir.txt') -Value $pushServeRoot -Encoding utf8
  foreach ($pushFunction in @('push-compat-spike','push-integration')) {
    $pushScratch = Join-Path $pushServeRoot "supabase/functions/$pushFunction"
    New-Item -ItemType Directory -Path $pushScratch -Force | Out-Null
    $pushSource = if ($pushFunction -eq 'push-compat-spike') { 'compat-spike' } else { 'edge-integration' }
    Copy-Item -LiteralPath "supabase/testing/$pushSource/index.ts" -Destination (Join-Path $pushScratch 'index.ts')
  }
  $pushCli = Join-Path (Split-Path (Get-Command supabase).Source) 'node_modules\supabase\dist\supabase.js'
  $pushServe = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"' + $pushCli + '"'),'functions','serve','--workdir',('"' + $pushServeRoot + '"'),'--env-file',('"' + (Join-Path $pushRuntime 'edge.env') + '"')) -WorkingDirectory $pushRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $pushRuntime 'serve.log') -RedirectStandardError (Join-Path $pushRuntime 'serve-error.log')
  Set-Content -LiteralPath (Join-Path $pushRuntime 'serve.pid') -Value $pushServe.Id -Encoding ascii
  Invoke-PushStage 'ready'
  Invoke-PushStage 'spike' # Fail closed: no fallback library or homemade cryptography.
  Invoke-PushStage 'bootstrap'
  Invoke-PushStage 'sql'
  Invoke-PushStage 'data-api'
  Invoke-PushStage 'edge'
  Invoke-LocalSupabase @('db','lint','--local','--schema','public,gymio_private,gymio_push_private','--level','warning','--fail-on','error')
  $pushPassed = $true
  if ($KeepForManual) {
    Write-Output 'Automated matrix passed. Manual browser test pending. Use npm run dev:push; credentials remain only in ignored runtime/users.json.'
  }
} catch {
  # Sanitized Docker diagnostics survive automatic resource cleanup.
  if ($pushStarted) {
    $pushSavedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $pushDockerLog = @(& docker logs --tail 60 supabase_edge_runtime_gymio-push-foundation-local 2>&1)
    $ErrorActionPreference = $pushSavedPreference
    foreach ($pushEntry in $pushDockerLog) {
      $pushDiagnostic = [string]$pushEntry
      if ($pushDiagnostic -match 'Error|worker|File change|Setting up|Serving functions|CPU time|termination') {
        $pushDiagnostic = $pushDiagnostic -replace 'https?://\S+', '[URL redacted]' -replace '[A-Za-z0-9_.-]{22,}', '[token redacted]'
        Write-Output $pushDiagnostic
      }
    }
  }
  foreach ($pushLog in @('serve.log','serve-error.log')) {
    $pushLogPath = Join-Path $pushRuntime $pushLog
    if (Test-Path -LiteralPath $pushLogPath) {
      foreach ($pushLine in Get-Content -LiteralPath $pushLogPath) {
        if ($pushLine -match 'CPU time soft limit reached') { Write-Output 'Runtime diagnostic: CPU time soft limit reached.' }
        elseif ($pushLine -match 'early termination has been triggered') { Write-Output 'Runtime diagnostic: worker terminated.' }
        elseif ($pushLine -match 'worker boot error') { Write-Output 'Runtime diagnostic: worker boot error.' }
        elseif ($pushLine -match 'File change detected') { Write-Output 'Runtime diagnostic: watched function file changed.' }
        elseif ($pushLine -match 'Setting up Edge Functions runtime') { Write-Output 'Runtime diagnostic: Functions runtime restarting.' }
        elseif ($pushLine -match 'Serving functions on') { Write-Output 'Runtime diagnostic: Functions runtime serving.' }
      }
    }
  }
  throw
} finally {
  if (-not ($KeepForManual -and $pushPassed)) {
    if ($pushServe) {
      $pushServe.Refresh()
      if (-not $pushServe.HasExited) {
        & taskkill.exe /PID $pushServe.Id /T /F | Out-Null
      }
    }
    if ($pushStarted) { Invoke-LocalSupabase @('stop','--project-id','gymio-push-foundation-local','--no-backup') -LogPath (Join-Path $pushRuntime 'stop.log') }
    if ($pushStarted) {
      foreach ($pushCache in @(@{ Path='supabase/.temp'; Existed=$pushHadCliTemp }, @{ Path='supabase/.branches'; Existed=$pushHadBranches })) {
        $pushCachePath = [IO.Path]::GetFullPath((Join-Path $pushRoot $pushCache.Path))
        if (-not $pushCachePath.StartsWith($pushRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe CLI cache cleanup path' }
        if (-not $pushCache.Existed -and (Test-Path -LiteralPath $pushCachePath)) { Remove-Item -LiteralPath $pushCachePath -Recurse -Force }
      }
      if ($pushHadCliTemp -and -not $pushHadStartSecrets -and (Test-Path -LiteralPath 'supabase/.temp/start-secrets')) {
        # CLI 2.120 creates a directory here, not a single file.
        $pushSecretCache = (Resolve-Path -LiteralPath (Join-Path $pushRoot 'supabase/.temp/start-secrets')).Path
        $pushExpectedTemp = [IO.Path]::GetFullPath((Join-Path $pushRoot 'supabase/.temp')) + [IO.Path]::DirectorySeparatorChar
        if (-not $pushSecretCache.StartsWith($pushExpectedTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe start-secrets cleanup path' }
        Remove-Item -LiteralPath $pushSecretCache -Recurse -Force
      }
    }
    if ($pushServeRoot -and (Test-Path -LiteralPath (Join-Path $pushServeRoot '.owner'))) {
      $pushTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      $pushResolvedServeRoot = [IO.Path]::GetFullPath($pushServeRoot)
      if (-not $pushResolvedServeRoot.StartsWith($pushTempRoot, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path $pushResolvedServeRoot -Leaf) -notmatch '^gymio-push-serve-[a-f0-9]{32}$') { throw 'Unsafe temporary cleanup path' }
      Remove-Item -LiteralPath $pushResolvedServeRoot -Recurse -Force
    }
    $pushExpected = Join-Path $pushRoot 'supabase\.runtime'
    if ($pushOwnRuntime -and (Test-Path -LiteralPath (Join-Path $pushRuntime '.owner')) -and
      [IO.Path]::GetFullPath($pushRuntime) -eq [IO.Path]::GetFullPath($pushExpected)) {
      Remove-Item -LiteralPath $pushRuntime -Recurse -Force
      if (Test-Path -LiteralPath '.env.push.local') { Remove-Item -LiteralPath '.env.push.local' }
      foreach ($pushFunction in @('push-compat-spike','push-integration')) {
        $pushFunctionPath = [IO.Path]::GetFullPath((Join-Path $pushRoot "supabase\functions\$pushFunction"))
        if (-not $pushFunctionPath.StartsWith($pushRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe cleanup path' }
        if (Test-Path -LiteralPath $pushFunctionPath) { Remove-Item -LiteralPath $pushFunctionPath -Recurse -Force }
      }
    }
  }
}
