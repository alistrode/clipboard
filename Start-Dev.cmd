@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  set ELECTRON_RUN_AS_NODE=1
  node_modules\electron\dist\electron.exe scripts\dev.cjs %*
) else (
  node scripts\dev.cjs %*
)
if errorlevel 1 pause
