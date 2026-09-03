@echo off
title Yanti - Demo local
cd /d "%~dp0"

echo ============================================
echo   Yanti - Demo local
echo ============================================

rem Verifica que el puerto 3100 no este ocupado
netstat -ano | findstr ":3100" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo  [AVISO] Ya hay un servidor corriendo en http://localhost:3100
  echo  Abrilo en tu navegador. Si no responde, cerra el proceso
  echo  de Node que ocupa el puerto y volve a ejecutar este archivo.
  echo.
  pause
  exit /b
)

echo.
echo  Sembrando la demo y los magic links...
echo  (la primera vez puede tardar ~30s)
echo.
node start-demo.mjs
echo.
echo  El servidor se detuvo. Cerra esta ventana.
pause
