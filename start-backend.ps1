# Start the backend API server
# Accessible at http://192.168.0.219:8000 on the local network

Set-Location "$PSScriptRoot\backend"

# Activate virtual environment if it exists
if (Test-Path "$PSScriptRoot\.venv\Scripts\Activate.ps1") {
    & "$PSScriptRoot\.venv\Scripts\Activate.ps1"
}

uvicorn app.main:app --host 0.0.0.0 --port 3169 --reload
