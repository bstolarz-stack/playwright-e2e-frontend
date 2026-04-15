@echo off
REM Casino Daily Test - Ejecutar con Windows Task Scheduler
REM Configurar: diario, "Stop if runs longer than 2 hours"

cd /d C:\Users\dosca\Proyectos\frontend-tests

echo [%date% %time%] Starting casino daily test >> reports\daily-run.log 2>&1
npx tsx scripts/daily-casino-agent.ts >> reports\daily-run.log 2>&1
echo [%date% %time%] Finished with exit code %ERRORLEVEL% >> reports\daily-run.log 2>&1
