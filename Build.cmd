@echo off
cd /d "%~dp0"
node scripts\build.cjs
if errorlevel 1 pause
