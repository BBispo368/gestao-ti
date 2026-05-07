@echo off
echo ============================================================
echo GERANDO EXECUTAVEL - SISTEMA DE INVENTARIO
echo ============================================================
echo.

:: Verifica se o ambiente virtual existe
if not exist "..\.venv" (
    echo [ERRO] Ambiente virtual nao encontrado na raiz. Rode os comandos de limpeza primeiro.
    pause
    exit
)

echo Instalando dependencias no Python 3.8 (32-bits)...
py -3.8-32 -m pip install pyinstaller requests getmac

echo.
echo Gerando .exe com PyInstaller (Usando Python 3.8 - 32 bits)...
echo (Isso pode levar alguns minutos...)

:: O comando agora usa o Python 3.8 32-bits
py -3.8-32 -m PyInstaller --noconfirm --onefile --windowed --name "AcessoTI_Lite" ^
--icon="app_icon.ico" ^
login_screen_lite.py

echo.
if exist "dist\AcessoTI_Lite.exe" (
    echo ============================================================
    echo SUCESSO! O arquivo foi gerado em: python/dist/AcessoTI_Lite.exe
    echo ============================================================
) else (
    echo ============================================================
    echo [ERRO] Falha ao gerar o executavel. Verifique as mensagens acima.
    echo ============================================================
)
pause