param(
  [string]$StackRoot = (Join-Path $env:TEMP 'gymio-v2-frontend-stack')
)

Push-Location $StackRoot
try {
  $taskStatusLines = & npx supabase status -o env
  if ($LASTEXITCODE -ne 0) {
    throw 'Não foi possível consultar a stack Supabase local.'
  }
} finally {
  Pop-Location
}

$taskValues = @{}
foreach ($taskLine in $taskStatusLines) {
  if ($taskLine -match '^([A-Z_]+)="?(.*?)"?$') {
    $taskValues[$matches[1]] = $matches[2]
  }
}

$env:TEST_SUPABASE_URL = $taskValues['API_URL']
$env:TEST_SUPABASE_ANON_KEY = $taskValues['ANON_KEY']
$env:TEST_SUPABASE_SERVICE_KEY = $taskValues['SERVICE_ROLE_KEY']

& node "$PSScriptRoot\workoutSessionDataApi.integration.mjs"
exit $LASTEXITCODE
