# Gera o instalador do The Editor para Windows.
# Uso (PowerShell, na pasta the-editor):  .\branding\build-windows.ps1
# Saída: apps\desktop\release\TheEditor-Setup-<versão>.exe  (+ win-unpacked\TheEditor.exe)
# "Continue": no PowerShell 5.1, texto em stderr de ferramentas (npm, vite) vira erro fatal
# com "Stop". Cada etapa é checada pelo $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> 1/6 Marca e ícones"
python branding/make_icons.py
node branding/rebrand.mjs

Write-Host "==> 2/6 WebAssembly do núcleo (áudio/FFT/batidas)"
pnpm --filter @openreel/core build:wasm
if ($LASTEXITCODE -ne 0) { throw "build:wasm falhou" }

Write-Host "==> 3/6 Interface (renderer) em modo desktop"
$env:OPENREEL_DESKTOP = "1"
pnpm --filter @openreel/web exec vite build
if ($LASTEXITCODE -ne 0) { throw "build da interface falhou" }
Remove-Item Env:OPENREEL_DESKTOP

Set-Location apps/desktop
Write-Host "==> 4/6 FFmpeg embutido"
node scripts/fetch-ffmpeg.mjs
if ($LASTEXITCODE -ne 0) { throw "fetch-ffmpeg falhou" }

Write-Host "==> 5/6 Processo principal do Electron"
node scripts/prepare-aurora-native.mjs
pnpm exec tsup
if ($LASTEXITCODE -ne 0) { throw "tsup falhou" }
# Extensão do Claude Desktop (The Editor.mcpb) a partir do shim recém-compilado.
node ..\..\branding\build-mcpb.mjs
if ($LASTEXITCODE -ne 0) { throw "build-mcpb falhou" }

Write-Host "==> 6/6 Instalador (.exe)"
pnpm exec electron-builder --win nsis --x64
if ($LASTEXITCODE -ne 0) { throw "electron-builder falhou" }

Write-Host ""
Write-Host "Pronto: $(Resolve-Path release)"
