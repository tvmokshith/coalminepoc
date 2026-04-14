@echo off
cd /d "%~dp0backend"

if exist "%~dp0.venv\Scripts\activate.bat" (
    call "%~dp0.venv\Scripts\activate.bat"
)

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
