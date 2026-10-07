@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22 LTS or newer, then run this file again.
 pause
 exit /b 1
)
if not exist "node_modules\.bin\vite.cmd" (
 call npm ci
 if errorlevel 1 (
  echo Dependency installation failed. Copy the error shown above.
  pause
  exit /b 1
 )
)
call npm run setup:check
call npm run dev
pause
