@echo off
title Security Dashboard Launcher

echo ===============================================
echo       SECURITY DASHBOARD LAUNCHER
echo ===============================================
echo.

:: Start Flask in a separate window
echo [1/2] Starting Flask server...
start "Flask Server" cmd /k "cd /d C:\Users\Server\Documents\GitHub\COMP3000-Repository\Security_Server && python app.py"

:: Wait a few seconds for Flask to fully start
echo     Waiting for Flask to start...
timeout /t 4 /nobreak > nul

:: Start ngrok and open its status page
echo [2/2] Starting ngrok tunnel...
start "ngrok Tunnel" cmd /k "C:\Users\Server\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe http 5000"

:: Wait for ngrok to establish the tunnel
echo     Waiting for tunnel to establish...
timeout /t 4 /nobreak > nul

:: Fetch the public URL from ngrok's local API and display it
echo.
echo ===============================================
echo  Fetching your public URL...
echo ===============================================
echo.

curl -s http://127.0.0.1:4040/api/tunnels > "%TEMP%\ngrok_info.json" 2>nul

:: Extract and display the URL using PowerShell
powershell -Command "$json = Get-Content '%TEMP%\ngrok_info.json' | ConvertFrom-Json; $url = $json.tunnels[0].public_url; Write-Host ''; Write-Host '  YOUR PUBLIC URL IS:' -ForegroundColor Green; Write-Host ''; Write-Host "  $url" -ForegroundColor Cyan; Write-Host ''; Write-Host '  Share this URL with anyone who needs access.' -ForegroundColor White; Write-Host '  It works in any browser with no installation needed.' -ForegroundColor White; Write-Host ''"

echo.
echo ===============================================
echo  Both Flask and ngrok are running.
echo  Close the Flask and ngrok windows to stop.
echo ===============================================
echo.
pause