@echo off
echo 正在启动北极星项目，日志将保存到 debug.log ...
echo.

REM 杀死占用 1420 端口的进程
echo 正在清理端口 1420...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :1420 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

REM 等待 2 秒
timeout /t 2 /nobreak >nul

REM 启动应用并重定向日志
echo 开始启动，日志输出到 debug.log ...
npm run tauri dev > debug.log 2>&1

echo.
echo 应用已关闭
