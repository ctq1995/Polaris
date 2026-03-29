# 阶段三：重构 MCP

> **执行次序**：第四步
> **依赖**：阶段一、二完成
> **产出**：重构后的 MCP 服务器

## 目标

重构 Scheduler MCP，使用统一仓库，参数格式与 Todo/Requirements MCP 一致。

## 参数格式统一

| MCP | 当前参数 | 目标参数 |
|-----|----------|----------|
| Todo | `[config_dir, workspace_path]` | ✅ 已正确 |
| Requirements | `[config_dir, workspace_path]` | ✅ 已正确 |
| Scheduler | `[workspace_path]` | `[config_dir, workspace_path]` |

## 文件变更

### 1. `src-tauri/src/bin/polaris_scheduler_mcp.rs`

**变更前**：
```rust
pub fn run_scheduler_mcp_server(workspace_path: &str) -> Result<()> {
    let repository = SchedulerRepository::new(workspace_path);
    // ...
}
```

**变更后**：
```rust
//! Scheduler MCP Binary Entry Point
//!
//! Usage: polaris-scheduler-mcp <config_dir> [workspace_path]

use polaris_lib::services::scheduler_mcp_server::run_scheduler_mcp_server;
use polaris_lib::{AppError, Result};
use std::path::PathBuf;

fn main() {
    if let Err(error) = main_impl() {
        eprintln!("{}", error.to_message());
        std::process::exit(1);
    }
}

fn main_impl() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        return Err(AppError::ValidationError(
            "缺少参数。用法：polaris-scheduler-mcp <config_dir> [workspace_path]".to_string(),
        ));
    }

    let (config_dir, workspace_path) = parse_args(&args)?;
    run_scheduler_mcp_server(&config_dir, workspace_path)
}

fn parse_args(args: &[String]) -> Result<(String, Option<&str>)> {
    match args.len() {
        2 => {
            let arg = &args[1];
            let path = PathBuf::from(arg);

            if path.exists() && path.is_dir() {
                let has_polaris = path.join(".polaris").exists();
                let is_app_config = path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.contains("polaris") && n.contains("."))
                    .unwrap_or(false);

                if has_polaris || !is_app_config {
                    let config_dir = get_default_config_dir()?;
                    return Ok((config_dir, Some(arg)));
                }
            }
            Ok((arg.clone(), None))
        }
        3 => Ok((args[1].clone(), Some(&args[2]))),
        _ => Err(AppError::ValidationError(
            "参数过多。用法：polaris-scheduler-mcp <config_dir> [workspace_path]".to_string(),
        ))
    }
}

fn get_default_config_dir() -> Result<String> {
    dirs::config_dir()
        .map(|p| p.join("com.polaris.app"))
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| AppError::ProcessError("无法确定配置目录".to_string()))
}
```

### 2. `src-tauri/src/services/scheduler_mcp_server.rs`

**变更前**：
```rust
use crate::services::scheduler_repository::SchedulerRepository;

pub fn run_scheduler_mcp_server(workspace_path: &str) -> Result<()> {
    let repository = SchedulerRepository::new(workspace_path);
    // ...
}
```

**变更后**：
```rust
//! Scheduler MCP Server
//!
//! MCP server for unified scheduler management.

use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use serde_json::{json, Value};

use crate::error::{AppError, Result};
use crate::models::scheduler::{CreateTaskParams, TaskStatus, TriggerType};
use crate::services::unified_scheduler_repository::UnifiedSchedulerRepository;

const SERVER_NAME: &str = "polaris-scheduler-mcp";
const SERVER_VERSION: &str = "0.2.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

/// Run the scheduler MCP server with unified repository
pub fn run_scheduler_mcp_server(config_dir: &str, workspace_path: Option<&str>) -> Result<()> {
    let config_dir = normalize_path(config_dir)?;
    let workspace_path = workspace_path.and_then(|p| {
        let normalized = p.trim();
        if normalized.is_empty() { None } else { Some(PathBuf::from(normalized)) }
    });

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.register_workspace()?;

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = io::BufReader::new(stdin.lock());
    let mut writer = stdout.lock();

    let mut line = String::new();
    loop {
        line.clear();
        let bytes_read = reader.read_line(&mut line)?;
        if bytes_read == 0 { break; }

        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }

        let response = handle_request(trimmed, &repository);
        serde_json::to_writer(&mut writer, &response)?;
        writer.write_all(b"\n")?;
        writer.flush()?;
    }

    Ok(())
}

fn handle_request(line: &str, repository: &UnifiedSchedulerRepository) -> Value {
    // ... JSON-RPC handling similar to todo/requirements MCP
}

fn handle_tools_list() -> Value {
    json!({
        "tools": [
            {
                "name": "list_tasks",
                "description": "列出定时任务",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "create_task",
                "description": "创建定时任务",
                "inputSchema": {
                    "type": "object",
                    "required": ["name", "triggerType", "triggerValue", "engineId", "prompt"],
                    "properties": {
                        "name": { "type": "string" },
                        "enabled": { "type": "boolean" },
                        "triggerType": { "type": "string", "enum": ["once", "cron", "interval"] },
                        "triggerValue": { "type": "string" },
                        "engineId": { "type": "string" },
                        "prompt": { "type": "string" },
                        "workDir": { "type": "string" },
                        "description": { "type": "string" }
                    }
                }
            },
            {
                "name": "update_task",
                "description": "更新定时任务",
                "inputSchema": {
                    "type": "object",
                    "required": ["id"],
                    "properties": {
                        "id": { "type": "string" },
                        "name": { "type": "string" },
                        "enabled": { "type": "boolean" },
                        "triggerType": { "type": "string" },
                        "triggerValue": { "type": "string" },
                        "engineId": { "type": "string" },
                        "prompt": { "type": "string" },
                        "workDir": { "type": "string" },
                        "description": { "type": "string" }
                    }
                }
            },
            {
                "name": "delete_task",
                "description": "删除定时任务",
                "inputSchema": {
                    "type": "object",
                    "required": ["id"],
                    "properties": {
                        "id": { "type": "string" }
                    }
                }
            },
            {
                "name": "toggle_task",
                "description": "切换任务启用状态",
                "inputSchema": {
                    "type": "object",
                    "required": ["id", "enabled"],
                    "properties": {
                        "id": { "type": "string" },
                        "enabled": { "type": "boolean" }
                    }
                }
            }
        ]
    })
}
```

### 3. `src-tauri/src/services/mcp_config_service.rs`

**变更**：确保 Scheduler MCP 使用双参数格式

```rust
// 第 144-151 行
let args = if binary.server_name == TODO_MCP_SERVER_NAME
           || binary.server_name == REQUIREMENTS_MCP_SERVER_NAME
           || binary.server_name == SCHEDULER_MCP_SERVER_NAME {  // 新增
    vec![
        self.config_dir.to_string_lossy().to_string(),
        normalized_workspace.to_string(),
    ]
} else {
    vec![normalized_workspace.to_string()]
};
```

### 4. 删除旧仓库

```bash
rm src-tauri/src/services/scheduler_repository.rs
```

更新 `src-tauri/src/services/mod.rs`：
```rust
// 删除这行
pub mod scheduler_repository;
```

## MCP 工具清单

| 工具 | 功能 | 状态 |
|------|------|------|
| `list_tasks` | 列出任务 | 保留 |
| `create_task` | 创建任务 | 简化参数 |
| `update_task` | 更新任务 | 简化参数 |
| `delete_task` | 删除任务 | 保留 |
| `toggle_task` | 切换启用 | 保留 |
| `get_task_logs` | 获取日志 | 移除 |
| `cleanup_logs` | 清理日志 | 移除 |
| `get_log_retention_config` | 日志配置 | 移除 |

## 验证检查

- [ ] MCP 启动正常
- [ ] `list_tasks` 返回正确
- [ ] `create_task` 写入正确路径
- [ ] `update_task` 更新成功
- [ ] `delete_task` 删除成功
- [ ] 参数格式与 Todo/Requirements MCP 一致
- [ ] 测试用例通过

## 后续步骤

完成本阶段后，进入 [05-phase4-frontend.md](./05-phase4-frontend.md) 简化前端。
