@echo off
title FlightFix - Cloud Tunnel Launcher
echo ===================================================
echo   FlightFix MRO - Launching Server and Cloud Tunnel
echo ===================================================
echo.

:: Check if Django is already running on port 8000
netstat -ano | findstr :8000 >nul
if %errorlevel% equ 0 (
    echo [INFO] Django backend is already active on port 8000.
) else (
    echo [INFO] Starting Django backend on http://127.0.0.1:8000...
    start /b python Backend\manage.py runserver 0.0.0.0:8000 >nul 2>&1
    timeout /t 3 /nobreak >nul
)

echo.
echo [INFO] Connecting to Cloudflare Tunnel...
echo [INFO] Your live public HTTPS link will appear below:
echo ===================================================
echo.

if exist "C:\Users\anany\AppData\Local\cloudflared\cloudflared.exe" (
    "C:\Users\anany\AppData\Local\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000
) else (
    echo [ERROR] cloudflared.exe not found at C:\Users\anany\AppData\Local\cloudflared\cloudflared.exe
    pause
)
