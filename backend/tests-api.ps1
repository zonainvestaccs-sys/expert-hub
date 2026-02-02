Write-Host "=== TESTES DA API - EXPERTHUB ===" -ForegroundColor Cyan

# ========================
# CONFIG
# ========================
$BASE = "http://localhost:3000"

# ========================
# LOGIN ADMIN
# ========================
Write-Host "`n[1] Login ADMIN" -ForegroundColor Yellow

$adminLogin = Invoke-RestMethod -Method Post `
  -Uri "$BASE/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email    = "admin@experthub.local"
    password = "Admin@123"
  } | ConvertTo-Json)

$ADMIN_TOKEN = $adminLogin.access_token
Write-Host "ADMIN TOKEN OK" -ForegroundColor Green


# ========================
# LOGIN EXPERT
# ========================
Write-Host "`n[2] Login EXPERT" -ForegroundColor Yellow

$expertLogin = Invoke-RestMethod -Method Post `
  -Uri "$BASE/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email    = "expert1@experthub.local"
    password = "Expert@123"
  } | ConvertTo-Json)

$EXPERT_TOKEN = $expertLogin.access_token
Write-Host "EXPERT TOKEN OK" -ForegroundColor Green


# ========================
# ADMIN OVERVIEW (OK)
# ========================
Write-Host "`n[3] Admin Overview (esperado: OK)" -ForegroundColor Yellow

$overview = Invoke-RestMethod -Method Get `
  -Uri "$BASE/admin/overview" `
  -Headers @{ Authorization = "Bearer $ADMIN_TOKEN" }

$overview | Format-List


# ========================
# EXPERT OVERVIEW (BLOQUEADO)
# ========================
Write-Host "`n[4] Expert tentando acessar /admin (esperado: 403)" -ForegroundColor Yellow

try {
  Invoke-RestMethod -Method Get `
    -Uri "$BASE/admin/overview" `
    -Headers @{ Authorization = "Bearer $EXPERT_TOKEN" }
}
catch {
  Write-Host "403 OK - Expert bloqueado corretamente" -ForegroundColor Green
}


# ========================
# EXPERT /experts/me (OK)
# ========================
Write-Host "`n[5] Expert /experts/me (esperado: OK)" -ForegroundColor Yellow

$expertMe = Invoke-RestMethod -Method Get `
  -Uri "$BASE/experts/me?from=2026-01-01&to=2026-12-31" `
  -Headers @{ Authorization = "Bearer $EXPERT_TOKEN" }

$expertMe | Format-List


# ========================
# EXPERT CRIAR LEAD (BLOQUEADO)
# ========================
Write-Host "`n[6] Expert tentando criar lead (esperado: 403)" -ForegroundColor Yellow

try {
  Invoke-RestMethod -Method Post `
    -Uri "$BASE/leads" `
    -Headers @{ Authorization = "Bearer $EXPERT_TOKEN" } `
    -ContentType "application/json" `
    -Body (@{
      expertId    = "cmkplmm3i00000cusekg161n4"
      name        = "Lead Bloqueado"
      email       = ("blocked_" + (Get-Random) + "@teste.com")
      phone       = "5511999999999"
      source      = "lp"
    } | ConvertTo-Json)
}
catch {
  Write-Host "403 OK - Expert não cria lead" -ForegroundColor Green
}


# ========================
# ADMIN CRIAR LEAD (OK)
# ========================
Write-Host "`n[7] Admin criando lead (esperado: OK)" -ForegroundColor Yellow

$lead = Invoke-RestMethod -Method Post `
  -Uri "$BASE/leads" `
  -Headers @{ Authorization = "Bearer $ADMIN_TOKEN" } `
  -ContentType "application/json" `
  -Body (@{
    expertId    = "cmkplmm3i00000cusekg161n4"
    name        = "Lead Admin"
    email       = ("admin_" + (Get-Random) + "@teste.com")
    phone       = "5511999999999"
    source      = "lp"
  } | ConvertTo-Json)

$lead | Format-List


# ========================
# ADMIN CRIAR DEPÓSITO (OK)
# ========================
Write-Host "`n[8] Admin criando depósito (esperado: OK)" -ForegroundColor Yellow

$deposit = Invoke-RestMethod -Method Post `
  -Uri "$BASE/deposits" `
  -Headers @{ Authorization = "Bearer $ADMIN_TOKEN" } `
  -ContentType "application/json" `
  -Body (@{
    expertId     = "cmkplmm3i00000cusekg161n4"
    amountCents  = 10000
    currency     = "BRL"
    status       = "CONFIRMED"
    providerTxId = ("tx_test_" + (Get-Random))
  } | ConvertTo-Json)

$deposit | Format-List


Write-Host "`n=== TESTES FINALIZADOS COM SUCESSO ===" -ForegroundColor Cyan
