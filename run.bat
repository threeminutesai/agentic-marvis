@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies, sir...
  call npm install
  if errorlevel 1 (
    echo Install failed. See errors above.
    pause
    exit /b 1
  )
)

echo Starting Marvis...
call npm start
pause
