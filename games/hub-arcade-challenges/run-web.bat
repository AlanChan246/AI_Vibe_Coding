@echo off
cd /d "%~dp0"
echo Starting web server at http://localhost:3000
echo Close this window to stop the server.
echo.

if exist "node_modules\.bin\serve.cmd" (
  call node_modules\.bin\serve.cmd . -l 3000
  exit /b 0
)

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  npx --yes serve@14 . -l 3000
  exit /b 0
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -m http.server 3000
  exit /b 0
)

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python -m http.server 3000
  exit /b 0
)

echo No Node.js ^(npx^) or Python found. Install Node from https://nodejs.org then run: npm install ^&^& npm start
pause
exit /b 1
