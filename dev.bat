@echo off
REM dev.bat — single-click launcher for the BootCamp dev stack.
REM Wraps dev.ps1 and bypasses any local PowerShell execution policy.
REM
REM Usage:
REM   dev.bat                    — web on :3001, API on :3000 (defaults)
REM   dev.bat -WebPort 7000      — override web port
REM   dev.bat -ApiPort 4000      — override api port
REM
REM What it does:
REM   1. Verifies Docker Desktop is running.
REM   2. Brings up Postgres + Swift/Kotlin runners via docker compose.
REM   3. Waits for Postgres to accept connections.
REM   4. Seeds the Hello BootCamp demo track.
REM   5. Publishes the Swift Fundamentals curriculum (12 lessons / 125 exercises).
REM   6. Spawns the Nest API in its own window.
REM   7. Spawns the Next.js web app in its own window.
REM
REM Stop:
REM   Close the two spawned windows. Postgres stays up until you run
REM   `docker compose down` in platform\.

setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
set EXITCODE=%ERRORLEVEL%

endlocal & exit /b %EXITCODE%
