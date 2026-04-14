# Start the frontend (dev mode - works on private network via IP)
# Accessible at http://192.168.0.219:3000 on the local network

Set-Location "$PSScriptRoot\frontend"

npm run dev -- --hostname 0.0.0.0
