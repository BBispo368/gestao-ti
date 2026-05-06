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

echo Instalando/Atualizando PyInstaller...
..\.venv\Scripts\pip install pyinstaller

echo.
echo Gerando .exe com PyInstaller...
echo (Isso pode levar alguns minutos...)

:: O comando agora usa o caminho relativo do ambiente virtual atual
..\.venv\Scripts\pyinstaller --noconfirm --onefile --windowed --name "AcessoTI_Lite" ^
--add-data "..\.venv\Lib\site-packages\customtkinter;customtkinter/" ^
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