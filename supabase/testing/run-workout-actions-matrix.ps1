param([Parameter(Mandatory=$true)][string]$ContextFile,[switch]$RunPreparedMatrix,[switch]$ApplyC)
$ErrorActionPreference='Stop'
if(-not $RunPreparedMatrix){throw 'Prepared only. Running the Docker matrix requires the next explicitly authorized stage.'}
$actionsWorkspace=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $actionsWorkspace
# actionsContext rejects the preserved B runtime, remote URLs, foreign ownership,
# incorrect ports/images and any historical hash change before issuing SQL.
& node --input-type=module -e "import {actionsContext} from './supabase/testing/actions-context.mjs';actionsContext(process.argv[1]);" $ContextFile
if($LASTEXITCODE -ne 0){throw 'Isolated C context rejected; no automatic repair'}
if($ApplyC){
  & node supabase/testing/actions-apply.mjs $ContextFile
  if($LASTEXITCODE -ne 0){throw 'C application failed; stop without repair'}
}
& node --input-type=module -e "import fs from 'node:fs';import {actionsContext} from './supabase/testing/actions-context.mjs';actionsContext(process.argv[1]).sql(fs.readFileSync('supabase/testing/actions-edge-fixture.sql','utf8'));" $ContextFile
if($LASTEXITCODE -ne 0){throw 'Test-only Edge fixture failed'}
foreach($actionsTest in @('actions-local-tests.mjs','actions-data-api.mjs','actions-edge-tests.mjs')){
  & node (Join-Path $PSScriptRoot $actionsTest) $ContextFile
  if($LASTEXITCODE -ne 0){throw "Matrix failed: $actionsTest"}
}
# No stack creation, cron activation, Vite, secrets provisioning or provider I/O
# occurs here. Provision the future disposable runtime under separate approval.
Write-Output 'Prepared C matrix scripts passed; audit remaining manual/platform and runtime checks before rollout.'
