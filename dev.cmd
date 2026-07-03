@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo Starting payMe dev server...
echo.

npm run dev

if errorlevel 1 (
  echo.
  echo Dev server failed. Press any key to exit.
  pause >nul
)
