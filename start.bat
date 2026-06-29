@echo off
REM ------------------------------------------------------------------
REM $BUILD.Store sandbox — one-click launcher (Windows).
REM
REM Double-click this file in Explorer. It will:
REM   1. Install dependencies on the first run (about 60 seconds)
REM   2. Start the local server
REM   3. Open your browser to the sandbox
REM
REM To stop the server later: close this window, or press Ctrl+C.
REM ------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   $BUILD.Store sandbox launcher
echo   -----------------------------
echo.

REM Sanity-check Node is installed.
where node >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Node.js is not installed.
  echo   Install it from https://nodejs.org ^(LTS version^), then try again.
  echo.
  pause
  exit /b 1
)

REM First-run install. Skip if node_modules already exists.
if not exist "node_modules" (
  echo   First-time setup. Installing dependencies ^(about 60 seconds^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. Scroll up for details.
    pause
    exit /b 1
  )
  echo.
  echo   Dependencies installed.
  echo.
)

REM Open the browser a few seconds after the server boots.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

echo   Starting server. Browser will open shortly.
echo   Close this window to stop the server.
echo.

REM Run the dev server in the foreground.
call npm run dev

pause
