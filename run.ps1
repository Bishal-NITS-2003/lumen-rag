Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting LUMEN NOTEBOOK: AI Research Assistant (DeepSeek-R1)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start FastAPI backend
Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "d:\Repositories\product-reviewer\backend\venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory "d:\Repositories\product-reviewer\backend" -PassThru

# 2. Start Vite frontend
Write-Host "Starting Vite React Frontend on http://localhost:5173..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "d:\Repositories\product-reviewer\frontend" -PassThru

Write-Host "`nLumen Notebook platform running successfully!" -ForegroundColor Green
Write-Host "Open your browser at: http://localhost:5173" -ForegroundColor White
Write-Host "Backend API docs at:  http://127.0.0.1:8000/docs`n" -ForegroundColor White
Write-Host "Press Ctrl+C to terminate both servers..." -ForegroundColor Cyan

try {
    Wait-Process -Id $backendJob.Id, $frontendJob.Id
} finally {
    Stop-Process -Id $backendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendJob.Id -ErrorAction SilentlyContinue
}
