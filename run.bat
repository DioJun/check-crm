@echo off
cd /d "%~dp0"
rmdir /s /q "%APPDATA%\Local\Checkmate-CRM" >nul 2>&1
echo Iniciando Checkmate CRM...
start "" "dist\Checkmate CRM-2.0.0.exe"
echo Aguardando app iniciah...
timeout /t 20 /nobreak
if exist "%APPDATA%\Local\Checkmate-CRM\checkmate.db" (
    echo.
    echo ========================
    echo SUCESSO! Banco criado!
    echo ========================
    echo DB: %APPDATA%\Local\Checkmate-CRM\checkmate.db
) else (
    echo.
    echo Banco nao foi criado ainda
)
pause
