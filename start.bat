@echo off
echo ==========================================================
echo  Starting CARDDEAL AI: Product Review & Bank Offers Bot
echo ==========================================================

start "FastAPI Backend" cmd /k "cd /d d:\Repositories\product-reviewer\backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

start "React Frontend" cmd /k "cd /d d:\Repositories\product-reviewer\frontend && npm run dev"

echo.
echo Servers launched in separate windows!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://127.0.0.1:8000/docs
echo.
pause
