@echo off
setlocal
cd /d "%~dp0frontend"

if not exist package.json (
  echo ERROR: frontend/package.json was not found.
  pause
  exit /b 1
)

where node >nul 2>&1 || (echo ERROR: Node.js is not installed. Install Node.js 20 or newer first. & pause & exit /b 1)
where npm >nul 2>&1 || (echo ERROR: npm is not installed. & pause & exit /b 1)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing frontend dependencies. This requires internet access.
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Check network access and folder permissions, then run this script again.
    pause
    exit /b 1
  )
)

call npm run dev -- --host 127.0.0.1 --port 5173
