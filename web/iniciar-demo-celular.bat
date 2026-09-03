@echo off
title Yanti - Demo accesible desde el celular
cd /d "%~dp0"

echo ============================================
echo   Yanti - Demo para celular / red local
echo ============================================

rem Detectar la IP local de la red (Wi-Fi/Ethernet)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "172."') do set "IP=%%a"
set IP=%IP: =%
if "%IP%"=="" (
  echo  No se pudo detectar la IP. Configurala a mano:
  echo  set YANTI_APP_URL=http://TU-IP:3100 ^& node start-demo.mjs
  pause
  exit /b
)

echo.
echo  IP detectada: %IP%
echo  En el celular (misma red Wi-Fi) abri:
echo     http://%IP%:3100
echo.
echo  Preparando magic links para esa IP...
echo.
set "YANTI_APP_URL=http://%IP%:3100"
node start-demo.mjs
echo.
echo  El servidor se detuvo. Cerra esta ventana.
pause
