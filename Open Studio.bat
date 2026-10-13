@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from nodejs.org, then open this launcher again.
  pause
  exit /b 1
)
node studio-workspace/open.mjs
if errorlevel 1 pause
