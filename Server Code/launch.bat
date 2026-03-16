@echo off
title dashboard launcher


echo [1/2] starting flask server
start "Flask Server" cmd /k "cd /d C:\Users\Server\Documents\GitHub\COMP3000-Repository\Server Code && python app.py"

echo     waiting for flask to start
timeout /t 4 /nobreak > nul

echo [2/2] starting ngrok tunnel...
start "ngrok Tunnel" cmd /k "C:\Users\Server\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe http 5000"

echo     waiting for tunnel to establish
timeout /t 4 /nobreak > nul

echo url:

curl -s http://127.0.0.1:4040/api/tunnels > "%TEMP%\ngrok_info.json" 2>nul

powershell -Command "$json = Get-Content '%TEMP%\ngrok_info.json' | ConvertFrom-Json; $url = $json.tunnels[0].public_url; Write-Host ''; Write-Host '  YOUR PUBLIC URL IS:' -ForegroundColor Green; Write-Host ''; Write-Host "  $url" -ForegroundColor Cyan; Write-Host ''; Write-Host '  Share this URL with anyone who needs access.' -ForegroundColor White; Write-Host '  It works in any browser with no installation needed.' -ForegroundColor White; Write-Host ''"

pause