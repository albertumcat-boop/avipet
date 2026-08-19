@echo off
echo ========================================
echo  AVIPET Bridge - Instalador
echo  Aclas CR2050 / The Factory HKA
echo ========================================
echo.
echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 ( echo ERROR: npm install fallo. & pause & exit /b 1 )

echo.
echo [2/3] Instalando servicio de Windows...
echo (Requiere permisos de Administrador)
node install-service.js
if errorlevel 1 ( echo ERROR: No se pudo instalar el servicio. Ejecuta como Administrador. & pause & exit /b 1 )

echo.
echo [3/3] Verificando bridge...
timeout /t 3 /nobreak >nul
curl -s http://localhost:3001/health
echo.
echo.
echo ========================================
echo  AVIPET Bridge instalado correctamente.
echo  Se inicia automaticamente con Windows.
echo ========================================
pause
