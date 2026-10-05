@echo off
title Projetor Igreja
cd /d "%~dp0"
where node >nul 2>nul || (
  echo O Node.js nao esta instalado. Baixe em https://nodejs.org e instale a versao LTS.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando pela primeira vez, aguarde...
  call npm install --omit=dev
)
node server.js --abrir
pause
