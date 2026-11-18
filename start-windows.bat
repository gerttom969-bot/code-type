@echo off
setlocal
cd /d "%~dp0"

echo.
echo  CodeType - local development server
echo  Keep this window open while using CodeType.
echo.

where py >nul 2>nul
if not errorlevel 1 goto use_py

where python >nul 2>nul
if not errorlevel 1 goto use_python

echo Python 3 was not found.
echo Install Python 3 from https://www.python.org/downloads/
echo Then run this file again.
pause
exit /b 1

:use_py
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8000/"
py -3 -m http.server 8000 --bind 127.0.0.1
goto finished

:use_python
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8000/"
python -m http.server 8000 --bind 127.0.0.1

:finished
echo.
echo CodeType server stopped.
pause
