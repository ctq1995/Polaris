# 北极星项目日志保存启动脚本

Write-Host "正在启动北极星项目，日志将保存到 debug.log ..." -ForegroundColor Green
Write-Host ""

# 清理 1420 端口
Write-Host "正在清理端口 1420..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }

if ($port) {
    $pid = $port.OwningProcess
    Write-Host "  终止进程 PID: $pid"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 启动应用并保存日志
Write-Host "开始启动，日志输出到 debug.log ..." -ForegroundColor Green
Write-Host "按 Ctrl+C 停止应用" -ForegroundColor Cyan
Write-Host ""

npm run tauri dev 2>&1 | Tee-Object -FilePath debug.log

Write-Host ""
Write-Host "应用已关闭" -ForegroundColor Green
