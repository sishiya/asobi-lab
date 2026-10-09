@echo off
rem Start the local server (if needed) and open "Asobi Lab" in the browser.
rem   start.bat             -> entrance page (all games)
rem   start.bat dino-race   -> one game (folder name)
rem Games split into css/js files (and Web Workers) do not run from file://, so open them through this.
rem Keep this file ASCII only (cmd.exe reads .bat in the ANSI code page, so UTF-8 Japanese turns into garbage).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File tools\start.ps1 %1
if errorlevel 1 pause
