@echo off
title Projetor Duraes
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado. Vou tentar instalar agora...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo  Baixe e instale o Node.js, versao LTS, em https://nodejs.org e abra este arquivo de novo.
    pause
    exit /b 1
  )
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo  Pronto. FECHE esta janela e abra o Projetor de novo.
  pause
  exit /b 0
)

rem Instala os componentes na primeira vez, e de novo quando o programa for atualizado.
fc /b package.json node_modules\.instalado.json >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Preparando o programa. Pode demorar alguns minutos, aguarde...
  call npm install --omit=dev
  if errorlevel 1 (
    echo.
    echo  Nao foi possivel instalar. Confira a internet e abra de novo.
    pause
    exit /b 1
  )
  copy /y package.json node_modules\.instalado.json >nul
  call "%~dp0criar-atalho-windows.bat" silencioso
)

node server.js --abrir
echo.
echo  O programa foi fechado. Se foi sem querer, abra o Projetor de novo.
pause
