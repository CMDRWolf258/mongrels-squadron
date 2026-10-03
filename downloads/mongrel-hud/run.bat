@echo off
cd /d "%~dp0"
pyw mongrel_hud.py 2>nul || py mongrel_hud.py
if errorlevel 1 (
  echo.
  echo Mongrel HUD could not start. Install Python 3 for Windows or run mongrel_hud.py with Python.
  pause
)
