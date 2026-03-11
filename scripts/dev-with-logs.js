#!/usr/bin/env node

/**
 * 北极星项目开发启动脚本（带日志保存）
 * 自动保存所有输出到 logs/debug-[timestamp].log
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 logs 目录
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 使用固定日志文件名（每次启动覆盖）
const logFile = path.join(logsDir, 'debug.log');

console.log(`📝 日志将保存到: ${logFile}`);
console.log(`💡 按 Ctrl+C 停止应用\n`);

// 创建日志文件写入流
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 直接启动 Tauri（它会自动运行 beforeDevCommand 启动 Vite）
console.log('🚀 启动 Tauri 开发环境...');
const tauriChild = spawn('npx', ['tauri', 'dev'], {
  shell: true,
  stdio: 'pipe',
  env: { ...process.env }
});

// 处理输出
tauriChild.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  logStream.write(text);
});

tauriChild.stderr.on('data', (data) => {
  const text = data.toString();
  process.stderr.write(text);
  logStream.write(text);
});

tauriChild.on('close', (code) => {
  console.log(`\n\n✅ 进程退出，代码: ${code}`);
  console.log(`📄 日志已保存到: ${logFile}`);
  logStream.end();
  process.exit(code);
});

// Ctrl+C 处理
process.on('SIGINT', () => {
  console.log('\n\n⏸️  正在停止...');
  tauriChild.kill('SIGINT');
});
