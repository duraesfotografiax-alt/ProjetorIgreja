@echo off
rem Cria o icone "Projetor Duraes" na Area de Trabalho.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $n='Projetor Dur'+[char]0xE3+'es.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d $n)); $s.TargetPath='%~dp0iniciar-windows.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\icones\projetor.ico'; $s.WindowStyle=7; $s.Description='Projetor Duraes'; $s.Save()" >nul 2>nul
if "%1"=="" (
  echo.
  echo  Pronto! O icone "Projetor Duraes" esta na Area de Trabalho.
  echo  Dois cliques nele abrem o programa e o telao.
  pause
)
