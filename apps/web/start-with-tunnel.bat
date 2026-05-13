@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "PORT=5173"
set "REF_SUFFIX=/?ref=1"
set "NGROK_CMD=%~dp0node_modules\.bin\ngrok.cmd"
set "NGROK_EXE=%~dp0node_modules\ngrok\bin\ngrok.exe"

echo ==========================================
echo MetaGuildX Web + ngrok Tunnel
echo ==========================================
echo Project: %CD%
echo Port   : %PORT%
echo.

if not exist "%NGROK_CMD%" if not exist "%NGROK_EXE%" (
  echo ngrok not found locally. Installing...
  call npm install -D ngrok
  if errorlevel 1 (
    echo.
    echo ngrok install failed.
    echo If ngrok download is temporarily unavailable, rerun this file later.
    exit /b 1
  )
)

echo Starting Vite dev server...
start "MetaGuildX Vite" cmd /k "cd /d ""%~dp0"" && set VITE_NETWORK=testnet && npm run dev"

echo Waiting for http://127.0.0.1:%PORT% to become ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddMinutes(2);" ^
  "do {" ^
  "  try {" ^
  "    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%' -UseBasicParsing -TimeoutSec 2;" ^
  "    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 1" ^
  "} while ((Get-Date) -lt $deadline);" ^
  "exit 1"

if errorlevel 1 (
  echo.
  echo Vite did not become ready on port %PORT%.
  exit /b 1
)

if exist "%NGROK_CMD%" (
  set "NGROK_RUN=""%NGROK_CMD%"""
) else (
  set "NGROK_RUN=""%NGROK_EXE%"""
)

echo Starting ngrok tunnel...
start "MetaGuildX ngrok" cmd /k "cd /d ""%~dp0"" && %NGROK_RUN% http %PORT%"

echo Waiting for ngrok public URL...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddMinutes(2);" ^
  "do {" ^
  "  try {" ^
  "    $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2;" ^
  "    $tunnel = $resp.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1;" ^
  "    if ($tunnel) { Write-Output ($tunnel.public_url + '%REF_SUFFIX%'); exit 0 }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 1" ^
  "} while ((Get-Date) -lt $deadline);" ^
  "exit 1"`) do (
  set "PUBLIC_REF_URL=%%I"
)

if not defined PUBLIC_REF_URL (
  echo.
  echo ngrok started, but the public URL could not be detected from the local API.
  echo Check the "MetaGuildX ngrok" window for the public URL.
  exit /b 1
)

echo.
echo ==========================================
echo Public mobile URL:
echo !PUBLIC_REF_URL!
echo ==========================================
echo.
echo Keep both the Vite and ngrok windows open while testing.
exit /b 0
