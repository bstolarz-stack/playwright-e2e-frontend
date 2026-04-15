@echo off
REM Healer Agent - Ejecutar con Windows Task Scheduler
REM Configurar: "Stop if runs longer than 2 hours"

cd /d C:\Users\dosca\Proyectos\frontend-tests

echo [%date% %time%] Starting healer agent >> reports\healer-run.log 2>&1
npx tsx scripts/healer-agent.ts >> reports\healer-run.log 2>&1
echo [%date% %time%] Finished with exit code %ERRORLEVEL% >> reports\healer-run.log 2>&1
