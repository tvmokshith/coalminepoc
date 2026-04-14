@echo off
cd /d "%~dp0frontend"

npm run dev -- --hostname 0.0.0.0 --port 3170
