@echo off
REM stop.bat — bring the BootCamp dev stack down cleanly.
REM
REM What it does:
REM   1. Stops Postgres + the Swift/Kotlin runner containers.
REM   2. Reminds you to close the two spawned PowerShell windows (Nest API, Next web)
REM      since those run as separate processes.

setlocal
cd /d "%~dp0\platform"

echo ^>^> Stopping Postgres + runner containers
docker compose down

echo.
echo ^>^> If the Nest API or Next.js web windows are still open, close them manually
echo    (Ctrl-C, then close the window).

endlocal
