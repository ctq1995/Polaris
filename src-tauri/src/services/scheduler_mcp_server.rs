//! Scheduler MCP Server
//!
//! MCP server for workspace-scoped scheduled task management.
//! Provides tools for CRUD operations on tasks and logs.

use crate::error::{AppError, Result};
use crate::models::scheduler::{LogRetentionConfig, TaskStatus, TriggerType};
use crate::services::scheduler_repository::{
    CreateLogParams, LogUpdateParams, SchedulerRepository, TaskUpdateParams,
};
use serde_json::Value;
use std::io::{self, BufRead, Write};

/// Run the scheduler MCP server
pub fn run_scheduler_mcp_server(workspace_path: &str) -> Result<()> {
    let repository = SchedulerRepository::new(workspace_path);

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();

    for line in stdin.lock().lines() {
        let line = line.map_err(|e| AppError::IoError(e))?;
        if line.is_empty() {
            continue;
        }

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let error_response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": "Parse error",
                        "data": e.to_string()
                    },
                    "id": null
                });
                writeln!(stdout_lock, "{}", serde_json::to_string(&error_response)?).ok();
                stdout_lock.flush().ok();
                continue;
            }
        };

        let response = handle_request(&repository, &request);
        if let Some(resp) = response {
            writeln!(stdout_lock, "{}", serde_json::to_string(&resp)?).ok();
            stdout_lock.flush().ok();
        }
    }

    Ok(())
}

fn handle_request(repository: &SchedulerRepository, request: &Value) -> Option<Value> {
    let method = request.get("method")?.as_str()?;
    let id = request.get("id").cloned();

    match method {
        "initialize" => Some(handle_initialize(id)),
        "notifications/initialized" => None,
        "ping" => Some(handle_ping(id)),
        "tools/list" => Some(handle_tools_list(id)),
        "tools/call" => Some(handle_tools_call(repository, request, id)),
        _ => Some(error_response(id, -32601, "Method not found")),
    }
}

fn handle_initialize(id: Option<Value>) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "polaris-scheduler",
                "version": "1.0.0"
            }
        },
        "id": id
    })
}

fn handle_ping(id: Option<Value>) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "result": {},
        "id": id
    })
}

fn handle_tools_list(id: Option<Value>) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "result": {
            "tools": [
                {
                    "name": "list_tasks",
                    "description": "列出当前工作区的所有定时任务。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "get_task",
                    "description": "获取单个定时任务的详细信息。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "任务 ID"
                            }
                        },
                        "required": ["id"]
                    }
                },
                {
                    "name": "create_task",
                    "description": "创建一个新的定时任务。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "enabled": {
                                "type": "boolean",
                                "description": "是否启用，默认 true"
                            },
                            "triggerType": {
                                "type": "string",
                                "enum": ["once", "cron", "interval"],
                                "description": "触发类型"
                            },
                            "triggerValue": {
                                "type": "string",
                                "description": "触发值（ISO 时间戳/Cron 表达式/间隔如 30s, 5m, 2h）"
                            },
                            "engineId": {
                                "type": "string",
                                "description": "使用的引擎 ID"
                            },
                            "prompt": {
                                "type": "string",
                                "description": "提示词内容"
                            },
                            "workDir": {
                                "type": "string",
                                "description": "工作目录（可选）"
                            },
                            "mode": {
                                "type": "string",
                                "enum": ["simple", "protocol"],
                                "description": "任务模式，默认 simple"
                            },
                            "group": {
                                "type": "string",
                                "description": "分组名称（可选）"
                            },
                            "description": {
                                "type": "string",
                                "description": "任务描述（可选）"
                            },
                            "mission": {
                                "type": "string",
                                "description": "任务目标（protocol 模式）"
                            },
                            "maxRuns": {
                                "type": "integer",
                                "description": "最大执行次数（可选）"
                            },
                            "runInTerminal": {
                                "type": "boolean",
                                "description": "是否在终端执行"
                            },
                            "templateId": {
                                "type": "string",
                                "description": "协议模板 ID（可选）"
                            },
                            "maxRetries": {
                                "type": "integer",
                                "description": "最大重试次数（可选）"
                            },
                            "retryInterval": {
                                "type": "string",
                                "description": "重试间隔如 30s, 5m（可选）"
                            },
                            "notifyOnComplete": {
                                "type": "boolean",
                                "description": "完成后是否通知，默认 true"
                            },
                            "timeoutMinutes": {
                                "type": "integer",
                                "description": "超时时间（分钟）"
                            },
                            "userSupplement": {
                                "type": "string",
                                "description": "用户补充内容（可选）"
                            }
                        },
                        "required": ["name", "triggerType", "triggerValue", "engineId", "prompt"]
                    }
                },
                {
                    "name": "update_task",
                    "description": "更新现有的定时任务。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "任务 ID"
                            },
                            "name": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "enabled": {
                                "type": "boolean",
                                "description": "是否启用"
                            },
                            "triggerType": {
                                "type": "string",
                                "enum": ["once", "cron", "interval"],
                                "description": "触发类型"
                            },
                            "triggerValue": {
                                "type": "string",
                                "description": "触发值"
                            },
                            "engineId": {
                                "type": "string",
                                "description": "引擎 ID"
                            },
                            "prompt": {
                                "type": "string",
                                "description": "提示词"
                            },
                            "workDir": {
                                "type": "string",
                                "description": "工作目录"
                            },
                            "mode": {
                                "type": "string",
                                "enum": ["simple", "protocol"],
                                "description": "任务模式"
                            },
                            "group": {
                                "type": "string",
                                "description": "分组名称"
                            },
                            "description": {
                                "type": "string",
                                "description": "任务描述"
                            },
                            "mission": {
                                "type": "string",
                                "description": "任务目标"
                            },
                            "maxRuns": {
                                "type": "integer",
                                "description": "最大执行次数"
                            },
                            "runInTerminal": {
                                "type": "boolean",
                                "description": "是否在终端执行"
                            },
                            "maxRetries": {
                                "type": "integer",
                                "description": "最大重试次数"
                            },
                            "retryInterval": {
                                "type": "string",
                                "description": "重试间隔"
                            },
                            "notifyOnComplete": {
                                "type": "boolean",
                                "description": "完成后是否通知"
                            },
                            "timeoutMinutes": {
                                "type": "integer",
                                "description": "超时时间"
                            },
                            "userSupplement": {
                                "type": "string",
                                "description": "用户补充内容"
                            }
                        },
                        "required": ["id"]
                    }
                },
                {
                    "name": "delete_task",
                    "description": "删除定时任务。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "任务 ID"
                            }
                        },
                        "required": ["id"]
                    }
                },
                {
                    "name": "list_logs",
                    "description": "分页列出执行日志。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "page": {
                                "type": "integer",
                                "description": "页码（从 1 开始），默认 1"
                            },
                            "pageSize": {
                                "type": "integer",
                                "description": "每页大小，默认 20"
                            }
                        },
                        "required": []
                    }
                },
                {
                    "name": "get_task_logs",
                    "description": "获取特定任务的执行日志。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "taskId": {
                                "type": "string",
                                "description": "任务 ID"
                            }
                        },
                        "required": ["taskId"]
                    }
                },
                {
                    "name": "create_log",
                    "description": "创建执行日志条目。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "taskId": {
                                "type": "string",
                                "description": "任务 ID"
                            },
                            "taskName": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "engineId": {
                                "type": "string",
                                "description": "引擎 ID"
                            },
                            "prompt": {
                                "type": "string",
                                "description": "执行的提示词"
                            }
                        },
                        "required": ["taskId", "taskName", "engineId", "prompt"]
                    }
                },
                {
                    "name": "update_log",
                    "description": "更新执行日志。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "logId": {
                                "type": "string",
                                "description": "日志 ID"
                            },
                            "finishedAt": {
                                "type": "integer",
                                "description": "结束时间戳"
                            },
                            "durationMs": {
                                "type": "integer",
                                "description": "执行耗时（毫秒）"
                            },
                            "status": {
                                "type": "string",
                                "enum": ["running", "success", "failed"],
                                "description": "执行状态"
                            },
                            "sessionId": {
                                "type": "string",
                                "description": "会话 ID"
                            },
                            "output": {
                                "type": "string",
                                "description": "输出内容"
                            },
                            "error": {
                                "type": "string",
                                "description": "错误信息"
                            },
                            "thinkingSummary": {
                                "type": "string",
                                "description": "思考过程摘要"
                            },
                            "toolCallCount": {
                                "type": "integer",
                                "description": "工具调用次数"
                            },
                            "tokenCount": {
                                "type": "integer",
                                "description": "Token 消耗"
                            }
                        },
                        "required": ["logId"]
                    }
                },
                {
                    "name": "delete_task_logs",
                    "description": "删除任务的所有日志。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "taskId": {
                                "type": "string",
                                "description": "任务 ID"
                            }
                        },
                        "required": ["taskId"]
                    }
                },
                {
                    "name": "get_retention_config",
                    "description": "获取日志保留配置。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "update_retention_config",
                    "description": "更新日志保留配置。",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "retentionDays": {
                                "type": "integer",
                                "description": "保留天数（0 表示不限）"
                            },
                            "maxLogsPerTask": {
                                "type": "integer",
                                "description": "每任务最大日志数（0 表示不限）"
                            },
                            "autoCleanupEnabled": {
                                "type": "boolean",
                                "description": "是否启用自动清理"
                            },
                            "autoCleanupIntervalHours": {
                                "type": "integer",
                                "description": "自动清理间隔（小时）"
                            }
                        },
                        "required": []
                    }
                }
            ]
        },
        "id": id
    })
}

fn handle_tools_call(repository: &SchedulerRepository, request: &Value, id: Option<Value>) -> Value {
    let params = request.get("params");
    let arguments = params.and_then(|p| p.get("arguments")).and_then(|a| a.as_object());
    let tool_name = params.and_then(|p| p.get("name")).and_then(|n| n.as_str());

    match tool_name {
        Some("list_tasks") => execute_list_tasks(repository, id),
        Some("get_task") => execute_get_task(repository, arguments, id),
        Some("create_task") => execute_create_task(repository, arguments, id),
        Some("update_task") => execute_update_task(repository, arguments, id),
        Some("delete_task") => execute_delete_task(repository, arguments, id),
        Some("list_logs") => execute_list_logs(repository, arguments, id),
        Some("get_task_logs") => execute_get_task_logs(repository, arguments, id),
        Some("create_log") => execute_create_log(repository, arguments, id),
        Some("update_log") => execute_update_log(repository, arguments, id),
        Some("delete_task_logs") => execute_delete_task_logs(repository, arguments, id),
        Some("get_retention_config") => execute_get_retention_config(repository, id),
        Some("update_retention_config") => execute_update_retention_config(repository, arguments, id),
        Some(name) => error_response(id, -32602, &format!("Unknown tool: {}", name)),
        None => error_response(id, -32602, "Missing tool name"),
    }
}

// ============================================================================
// Tool Implementations
// ============================================================================

fn execute_list_tasks(repository: &SchedulerRepository, id: Option<Value>) -> Value {
    match repository.list_tasks() {
        Ok(tasks) => success_response(id, tasks),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_get_task(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let task_id = match args.and_then(|a| a.get("id")).and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: id"),
    };

    match repository.get_task(task_id) {
        Ok(Some(task)) => success_response(id, task),
        Ok(None) => error_response(id, -32001, &format!("任务不存在: {}", task_id)),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_create_task(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let args = match args {
        Some(a) => a,
        None => return error_response(id, -32602, "Missing arguments"),
    };

    let name = match args.get("name").and_then(|v| v.as_str()) {
        Some(n) => n.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: name"),
    };

    let trigger_type_str = match args.get("triggerType").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return error_response(id, -32602, "Missing required parameter: triggerType"),
    };

    let trigger_type = match trigger_type_str {
        "once" => TriggerType::Once,
        "cron" => TriggerType::Cron,
        "interval" => TriggerType::Interval,
        _ => return error_response(id, -32602, &format!("Invalid triggerType: {}", trigger_type_str)),
    };

    let trigger_value = match args.get("triggerValue").and_then(|v| v.as_str()) {
        Some(v) => v.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: triggerValue"),
    };

    let engine_id = match args.get("engineId").and_then(|v| v.as_str()) {
        Some(e) => e.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: engineId"),
    };

    let prompt = match args.get("prompt").and_then(|v| v.as_str()) {
        Some(p) => p.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: prompt"),
    };

    let params = crate::models::scheduler::CreateTaskParams {
        name,
        enabled: args.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
        trigger_type,
        trigger_value,
        engine_id,
        prompt,
        work_dir: args.get("workDir").and_then(|v| v.as_str()).map(String::from),
        mode: args.get("mode").and_then(|v| v.as_str()).map(|m| {
            match m {
                "protocol" => crate::models::scheduler::TaskMode::Protocol,
                _ => crate::models::scheduler::TaskMode::Simple,
            }
        }).unwrap_or_default(),
        group: args.get("group").and_then(|v| v.as_str()).map(String::from),
        description: args.get("description").and_then(|v| v.as_str()).map(String::from),
        mission: args.get("mission").and_then(|v| v.as_str()).map(String::from),
        max_runs: args.get("maxRuns").and_then(|v| v.as_u64()).map(|n| n as u32),
        run_in_terminal: args.get("runInTerminal").and_then(|v| v.as_bool()).unwrap_or(false),
        template_id: args.get("templateId").and_then(|v| v.as_str()).map(String::from),
        template_param_values: args.get("templateParamValues").and_then(|v| v.as_object()).map(|obj| {
            obj.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect()
        }),
        max_retries: args.get("maxRetries").and_then(|v| v.as_u64()).map(|n| n as u32),
        retry_interval: args.get("retryInterval").and_then(|v| v.as_str()).map(String::from),
        notify_on_complete: args.get("notifyOnComplete").and_then(|v| v.as_bool()).unwrap_or(true),
        timeout_minutes: args.get("timeoutMinutes").and_then(|v| v.as_u64()).map(|n| n as u32),
        user_supplement: args.get("userSupplement").and_then(|v| v.as_str()).map(String::from),
    };

    match repository.create_task(params) {
        Ok(task) => success_response(id, task),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_update_task(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let args = match args {
        Some(a) => a,
        None => return error_response(id, -32602, "Missing arguments"),
    };

    let task_id = match args.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: id"),
    };

    let trigger_type = args.get("triggerType").and_then(|v| v.as_str()).map(|t| {
        match t {
            "once" => TriggerType::Once,
            "cron" => TriggerType::Cron,
            "interval" => TriggerType::Interval,
            _ => TriggerType::Interval,
        }
    });

    let mode = args.get("mode").and_then(|v| v.as_str()).map(|m| {
        match m {
            "protocol" => crate::models::scheduler::TaskMode::Protocol,
            _ => crate::models::scheduler::TaskMode::Simple,
        }
    });

    let params = TaskUpdateParams {
        name: args.get("name").and_then(|v| v.as_str()).map(String::from),
        enabled: args.get("enabled").and_then(|v| v.as_bool()),
        trigger_type,
        trigger_value: args.get("triggerValue").and_then(|v| v.as_str()).map(String::from),
        engine_id: args.get("engineId").and_then(|v| v.as_str()).map(String::from),
        prompt: args.get("prompt").and_then(|v| v.as_str()).map(String::from),
        work_dir: args.get("workDir").and_then(|v| v.as_str()).map(String::from),
        mode,
        group: args.get("group").and_then(|v| v.as_str()).map(String::from),
        description: args.get("description").and_then(|v| v.as_str()).map(String::from),
        mission: args.get("mission").and_then(|v| v.as_str()).map(String::from),
        max_runs: args.get("maxRuns").and_then(|v| v.as_u64()).map(|n| n as u32),
        run_in_terminal: args.get("runInTerminal").and_then(|v| v.as_bool()),
        template_id: args.get("templateId").and_then(|v| v.as_str()).map(String::from),
        template_param_values: args.get("templateParamValues").and_then(|v| v.as_object()).map(|obj| {
            obj.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect()
        }),
        max_retries: args.get("maxRetries").and_then(|v| v.as_u64()).map(|n| n as u32),
        retry_interval: args.get("retryInterval").and_then(|v| v.as_str()).map(String::from),
        notify_on_complete: args.get("notifyOnComplete").and_then(|v| v.as_bool()),
        timeout_minutes: args.get("timeoutMinutes").and_then(|v| v.as_u64()).map(|n| n as u32),
        user_supplement: args.get("userSupplement").and_then(|v| v.as_str()).map(String::from),
    };

    match repository.update_task(task_id, params) {
        Ok(task) => success_response(id, task),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_delete_task(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let task_id = match args.and_then(|a| a.get("id")).and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: id"),
    };

    match repository.delete_task(task_id) {
        Ok(task) => success_response(id, task),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_list_logs(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let page = args.and_then(|a| a.get("page")).and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(1);
    let page_size = args.and_then(|a| a.get("pageSize")).and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(20);

    match repository.list_logs(page.max(1), page_size.max(1)) {
        Ok(logs) => success_response(id, logs),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_get_task_logs(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let task_id = match args.and_then(|a| a.get("taskId")).and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: taskId"),
    };

    match repository.get_task_logs(task_id) {
        Ok(logs) => success_response(id, logs),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_create_log(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let args = match args {
        Some(a) => a,
        None => return error_response(id, -32602, "Missing arguments"),
    };

    let task_id = match args.get("taskId").and_then(|v| v.as_str()) {
        Some(id) => id.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: taskId"),
    };

    let task_name = match args.get("taskName").and_then(|v| v.as_str()) {
        Some(n) => n.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: taskName"),
    };

    let engine_id = match args.get("engineId").and_then(|v| v.as_str()) {
        Some(e) => e.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: engineId"),
    };

    let prompt = match args.get("prompt").and_then(|v| v.as_str()) {
        Some(p) => p.to_string(),
        None => return error_response(id, -32602, "Missing required parameter: prompt"),
    };

    let params = CreateLogParams {
        task_id,
        task_name,
        engine_id,
        prompt,
    };

    match repository.create_log(params.into()) {
        Ok(log) => success_response(id, log),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_update_log(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let args = match args {
        Some(a) => a,
        None => return error_response(id, -32602, "Missing arguments"),
    };

    let log_id = match args.get("logId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: logId"),
    };

    let status = args.get("status").and_then(|v| v.as_str()).map(|s| {
        match s {
            "running" => TaskStatus::Running,
            "success" => TaskStatus::Success,
            "failed" => TaskStatus::Failed,
            _ => TaskStatus::Running,
        }
    });

    let params = LogUpdateParams {
        finished_at: args.get("finishedAt").and_then(|v| v.as_i64()),
        duration_ms: args.get("durationMs").and_then(|v| v.as_i64()),
        status,
        session_id: args.get("sessionId").and_then(|v| v.as_str()).map(String::from),
        output: args.get("output").and_then(|v| v.as_str()).map(String::from),
        error: args.get("error").and_then(|v| v.as_str()).map(String::from),
        thinking_summary: args.get("thinkingSummary").and_then(|v| v.as_str()).map(String::from),
        tool_call_count: args.get("toolCallCount").and_then(|v| v.as_u64()).map(|n| n as u32),
        token_count: args.get("tokenCount").and_then(|v| v.as_u64()).map(|n| n as u32),
    };

    match repository.update_log(log_id, params) {
        Ok(log) => success_response(id, log),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_delete_task_logs(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let task_id = match args.and_then(|a| a.get("taskId")).and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return error_response(id, -32602, "Missing required parameter: taskId"),
    };

    match repository.delete_task_logs(task_id) {
        Ok(count) => success_response(id, serde_json::json!({ "deletedCount": count })),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_get_retention_config(repository: &SchedulerRepository, id: Option<Value>) -> Value {
    match repository.get_retention_config() {
        Ok(config) => success_response(id, config),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

fn execute_update_retention_config(repository: &SchedulerRepository, args: Option<&serde_json::Map<String, Value>>, id: Option<Value>) -> Value {
    let args = match args {
        Some(a) => a,
        None => return error_response(id, -32602, "Missing arguments"),
    };

    let config = LogRetentionConfig {
        retention_days: args.get("retentionDays").and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(30),
        max_logs_per_task: args.get("maxLogsPerTask").and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(100),
        auto_cleanup_enabled: args.get("autoCleanupEnabled").and_then(|v| v.as_bool()).unwrap_or(true),
        auto_cleanup_interval_hours: args.get("autoCleanupIntervalHours").and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(24),
    };

    match repository.update_retention_config(config) {
        Ok(updated) => success_response(id, updated),
        Err(e) => error_response(id, -32000, &e.to_message()),
    }
}

// ============================================================================
// Response Helpers
// ============================================================================

fn success_response(id: Option<Value>, result: impl serde::Serialize) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "result": result,
        "id": id
    })
}

fn error_response(id: Option<Value>, code: i32, message: &str) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "error": {
            "code": code,
            "message": message
        },
        "id": id
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tools_list_count() {
        let response = handle_tools_list(Some(serde_json::json!(1)));
        let tools = response.get("result").unwrap().get("tools").unwrap().as_array().unwrap();
        assert_eq!(tools.len(), 12);
    }
}
