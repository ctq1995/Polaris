use std::io::{self, BufRead, BufReader, Write};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{AppError, Result};
use crate::models::requirement::{
    RequirementCreateParams, RequirementExecuteConfig, RequirementPriority, RequirementSource,
    RequirementStatus, RequirementUpdateParams,
};
use crate::services::requirement_repository::WorkspaceRequirementRepository;

const SERVER_NAME: &str = "polaris-requirements-mcp";
const SERVER_VERSION: &str = "0.1.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse<'a> {
    jsonrpc: &'a str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

pub fn run_requirements_mcp_server(workspace_path: &str) -> Result<()> {
    let workspace_path = normalize_workspace_path(workspace_path)?;
    let repository = WorkspaceRequirementRepository::new(workspace_path);

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut writer = stdout.lock();

    let mut line = String::new();
    loop {
        line.clear();
        let bytes_read = reader.read_line(&mut line)?;
        if bytes_read == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = match serde_json::from_str::<JsonRpcRequest>(trimmed) {
            Ok(request) => handle_request(request, &repository),
            Err(error) => JsonRpcResponse {
                jsonrpc: "2.0",
                id: Value::Null,
                result: None,
                error: Some(JsonRpcError {
                    code: -32700,
                    message: format!("Parse error: {}", error),
                }),
            },
        };

        serde_json::to_writer(&mut writer, &response)?;
        writer.write_all(b"\n")?;
        writer.flush()?;
    }

    Ok(())
}

fn handle_request(request: JsonRpcRequest, repository: &WorkspaceRequirementRepository) -> JsonRpcResponse<'static> {
    let id = request.id.unwrap_or(Value::Null);

    if request.jsonrpc != "2.0" {
        return error_response(id, -32600, "Invalid Request: jsonrpc must be 2.0".to_string());
    }

    let result = match request.method.as_str() {
        "initialize" => handle_initialize(),
        "notifications/initialized" => Ok(json!({})),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(handle_tools_list()),
        "tools/call" => handle_tools_call(request.params, repository),
        _ => Err(AppError::ValidationError(format!("Unsupported method: {}", request.method))),
    };

    match result {
        Ok(result) => JsonRpcResponse {
            jsonrpc: "2.0",
            id,
            result: Some(result),
            error: None,
        },
        Err(error) => error_response(id, -32000, error.to_message()),
    }
}

fn handle_initialize() -> Result<Value> {
    Ok(json!({
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {
            "tools": {}
        },
        "serverInfo": {
            "name": SERVER_NAME,
            "version": SERVER_VERSION
        }
    }))
}

fn handle_tools_list() -> Value {
    json!({
        "tools": [
            {
                "name": "list_requirements",
                "description": "列出当前工作区需求库中的需求。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "status": { "type": "string", "enum": ["draft", "pending", "approved", "rejected", "executing", "completed", "failed"] },
                        "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"] },
                        "limit": { "type": "integer", "minimum": 1, "maximum": 200 }
                    },
                    "additionalProperties": false
                }
            },
            {
                "name": "create_requirement",
                "description": "在当前工作区需求库中创建一条新需求。",
                "inputSchema": {
                    "type": "object",
                    "required": ["title", "description"],
                    "properties": {
                        "title": { "type": "string", "minLength": 1 },
                        "description": { "type": "string", "minLength": 1 },
                        "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"] },
                        "tags": { "type": "array", "items": { "type": "string", "minLength": 1 } },
                        "hasPrototype": { "type": "boolean" },
                        "generatedBy": { "type": "string", "enum": ["ai", "user"] },
                        "generatorTaskId": { "type": "string" }
                    },
                    "additionalProperties": false
                }
            },
            {
                "name": "update_requirement",
                "description": "更新当前工作区的一条需求。",
                "inputSchema": {
                    "type": "object",
                    "required": ["id"],
                    "properties": {
                        "id": { "type": "string", "minLength": 1 },
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                        "status": { "type": "string", "enum": ["draft", "pending", "approved", "rejected", "executing", "completed", "failed"] },
                        "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"] },
                        "tags": { "type": "array", "items": { "type": "string", "minLength": 1 } },
                        "prototypePath": { "type": "string" },
                        "hasPrototype": { "type": "boolean" },
                        "reviewNote": { "type": "string" },
                        "executeLog": { "type": "string" },
                        "executeError": { "type": "string" },
                        "generatedBy": { "type": "string", "enum": ["ai", "user"] },
                        "sessionId": { "type": "string" },
                        "executeConfig": {
                          "type": "object",
                          "properties": {
                            "scheduledAt": { "type": "integer" },
                            "engineId": { "type": "string" },
                            "workDir": { "type": "string" }
                          },
                          "additionalProperties": false
                        }
                    },
                    "additionalProperties": false
                }
            },
            {
                "name": "delete_requirement",
                "description": "删除当前工作区的一条需求。",
                "inputSchema": {
                    "type": "object",
                    "required": ["id"],
                    "properties": {
                        "id": { "type": "string", "minLength": 1 }
                    },
                    "additionalProperties": false
                }
            },
            {
                "name": "save_requirement_prototype",
                "description": "保存需求原型 HTML，并回写需求的 prototypePath / hasPrototype。",
                "inputSchema": {
                    "type": "object",
                    "required": ["id", "html"],
                    "properties": {
                        "id": { "type": "string", "minLength": 1 },
                        "html": { "type": "string", "minLength": 1 }
                    },
                    "additionalProperties": false
                }
            }
        ]
    })
}

fn handle_tools_call(params: Value, repository: &WorkspaceRequirementRepository) -> Result<Value> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::ValidationError("tools/call 缺少 name".to_string()))?;
    let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
    let workspace_path = repository.workspace_path().to_string_lossy().to_string();

    match name {
        "list_requirements" => {
            let args = parse_list_requirements_args(arguments)?;
            let mut requirements = repository.list_requirements()?;
            if let Some(status) = args.status {
                requirements.retain(|item| item.status == status);
            }
            if let Some(priority) = args.priority {
                requirements.retain(|item| item.priority == priority);
            }
            if let Some(limit) = args.limit {
                requirements.truncate(limit as usize);
            }

            Ok(tool_success(
                format!("已返回 {} 条需求", requirements.len()),
                &workspace_path,
                json!({
                    "workspacePath": workspace_path,
                    "count": requirements.len(),
                    "requirements": requirements,
                }),
            ))
        }
        "create_requirement" => {
            let args = parse_create_requirement_args(arguments)?;
            let requirement = repository.create_requirement(args)?;
            Ok(tool_success(
                format!("已创建需求：{}", requirement.title),
                &workspace_path,
                json!({
                    "workspacePath": workspace_path,
                    "requirement": requirement,
                }),
            ))
        }
        "update_requirement" => {
            let args = parse_update_requirement_args(arguments)?;
            let requirement = repository.update_requirement(&args.id, args.updates)?;
            Ok(tool_success(
                format!("已更新需求：{}", requirement.title),
                &workspace_path,
                json!({
                    "workspacePath": workspace_path,
                    "requirement": requirement,
                }),
            ))
        }
        "delete_requirement" => {
            let id = parse_id_arg(&arguments)?;
            let requirement = repository.delete_requirement(&id)?;
            Ok(tool_success(
                format!("已删除需求：{}", requirement.title),
                &workspace_path,
                json!({
                    "workspacePath": workspace_path,
                    "requirement": requirement,
                }),
            ))
        }
        "save_requirement_prototype" => {
            let id = parse_id_arg(&arguments)?;
            let html = arguments
                .get("html")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::ValidationError("html 不能为空".to_string()))?;
            let prototype_path = repository.save_prototype(&id, html)?;
            let requirement = repository
                .get_requirement(&id)?
                .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", id)))?;
            Ok(tool_success(
                format!("已保存需求原型：{}", requirement.title),
                &workspace_path,
                json!({
                    "workspacePath": workspace_path,
                    "prototypePath": prototype_path,
                    "requirement": requirement,
                }),
            ))
        }
        _ => Err(AppError::ValidationError(format!("未知工具: {}", name))),
    }
}

fn tool_success(summary: String, workspace_path: &str, structured_content: Value) -> Value {
    json!({
        "structuredContent": structured_content,
        "content": [
            {
                "type": "text",
                "text": build_summary_text(&summary, workspace_path),
            }
        ]
    })
}

fn build_summary_text(action: &str, workspace_path: &str) -> String {
    format!("{}，工作区：{}", action, workspace_path)
}

fn normalize_workspace_path(workspace_path: &str) -> Result<&str> {
    let normalized = workspace_path.trim();
    if normalized.is_empty() {
        return Err(AppError::ValidationError("workspacePath 不能为空".to_string()));
    }
    Ok(normalized)
}

fn error_response(id: Value, code: i32, message: String) -> JsonRpcResponse<'static> {
    JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(JsonRpcError { code, message }),
    }
}

fn parse_id_arg(arguments: &Value) -> Result<String> {
    let id = arguments
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::ValidationError("id 不能为空".to_string()))?;
    Ok(id.to_string())
}

struct ListRequirementsArgs {
    status: Option<RequirementStatus>,
    priority: Option<RequirementPriority>,
    limit: Option<u64>,
}

fn parse_list_requirements_args(arguments: Value) -> Result<ListRequirementsArgs> {
    let status = arguments.get("status").map(parse_status_value).transpose()?;
    let priority = arguments.get("priority").map(parse_priority_value).transpose()?;
    let limit = arguments.get("limit").map(parse_limit_value).transpose()?;
    Ok(ListRequirementsArgs { status, priority, limit })
}

fn parse_create_requirement_args(arguments: Value) -> Result<RequirementCreateParams> {
    let title = arguments
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::ValidationError("title 不能为空".to_string()))?
        .to_string();
    let description = arguments
        .get("description")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::ValidationError("description 不能为空".to_string()))?
        .to_string();

    Ok(RequirementCreateParams {
        title,
        description,
        priority: arguments.get("priority").map(parse_priority_value).transpose()?,
        tags: optional_string_array(arguments.get("tags"))?,
        has_prototype: arguments.get("hasPrototype").and_then(Value::as_bool),
        generated_by: arguments.get("generatedBy").map(parse_source_value).transpose()?,
        generator_task_id: optional_trimmed_string(arguments.get("generatorTaskId")),
    })
}

struct UpdateRequirementArgs {
    id: String,
    updates: RequirementUpdateParams,
}

fn parse_update_requirement_args(arguments: Value) -> Result<UpdateRequirementArgs> {
    let id = parse_id_arg(&arguments)?;

    Ok(UpdateRequirementArgs {
        id,
        updates: RequirementUpdateParams {
            title: optional_trimmed_string(arguments.get("title")),
            description: optional_trimmed_string(arguments.get("description")),
            status: arguments.get("status").map(parse_status_value).transpose()?,
            priority: arguments.get("priority").map(parse_priority_value).transpose()?,
            tags: optional_string_array(arguments.get("tags"))?,
            prototype_path: optional_trimmed_string(arguments.get("prototypePath")),
            has_prototype: arguments.get("hasPrototype").and_then(Value::as_bool),
            review_note: optional_trimmed_string(arguments.get("reviewNote")),
            execute_config: arguments.get("executeConfig").map(parse_execute_config).transpose()?,
            execute_log: optional_trimmed_string(arguments.get("executeLog")),
            execute_error: optional_trimmed_string(arguments.get("executeError")),
            generated_by: arguments.get("generatedBy").map(parse_source_value).transpose()?,
            session_id: optional_trimmed_string(arguments.get("sessionId")),
        },
    })
}

fn parse_execute_config(value: &Value) -> Result<RequirementExecuteConfig> {
    let object = value
        .as_object()
        .ok_or_else(|| AppError::ValidationError("executeConfig 必须是对象".to_string()))?;

    Ok(RequirementExecuteConfig {
        scheduled_at: object.get("scheduledAt").and_then(Value::as_i64),
        engine_id: optional_trimmed_string(object.get("engineId")),
        work_dir: optional_trimmed_string(object.get("workDir")),
    })
}

fn parse_limit_value(value: &Value) -> Result<u64> {
    let limit = value
        .as_u64()
        .ok_or_else(|| AppError::ValidationError("limit 必须是正整数".to_string()))?;
    if limit == 0 || limit > 200 {
        return Err(AppError::ValidationError("limit 必须在 1 到 200 之间".to_string()));
    }
    Ok(limit)
}

fn parse_status_value(value: &Value) -> Result<RequirementStatus> {
    let raw = value
        .as_str()
        .ok_or_else(|| AppError::ValidationError("status 必须是字符串".to_string()))?;
    match raw {
        "draft" => Ok(RequirementStatus::Draft),
        "pending" => Ok(RequirementStatus::Pending),
        "approved" => Ok(RequirementStatus::Approved),
        "rejected" => Ok(RequirementStatus::Rejected),
        "executing" => Ok(RequirementStatus::Executing),
        "completed" => Ok(RequirementStatus::Completed),
        "failed" => Ok(RequirementStatus::Failed),
        _ => Err(AppError::ValidationError(format!("不支持的 status: {}", raw))),
    }
}

fn parse_priority_value(value: &Value) -> Result<RequirementPriority> {
    let raw = value
        .as_str()
        .ok_or_else(|| AppError::ValidationError("priority 必须是字符串".to_string()))?;
    match raw {
        "low" => Ok(RequirementPriority::Low),
        "normal" => Ok(RequirementPriority::Normal),
        "high" => Ok(RequirementPriority::High),
        "urgent" => Ok(RequirementPriority::Urgent),
        _ => Err(AppError::ValidationError(format!("不支持的 priority: {}", raw))),
    }
}

fn parse_source_value(value: &Value) -> Result<RequirementSource> {
    let raw = value
        .as_str()
        .ok_or_else(|| AppError::ValidationError("generatedBy 必须是字符串".to_string()))?;
    match raw {
        "ai" => Ok(RequirementSource::Ai),
        "user" => Ok(RequirementSource::User),
        _ => Err(AppError::ValidationError(format!("不支持的 generatedBy: {}", raw))),
    }
}

fn optional_trimmed_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn optional_string_array(value: Option<&Value>) -> Result<Option<Vec<String>>> {
    let Some(value) = value else {
        return Ok(None);
    };

    let array = value
        .as_array()
        .ok_or_else(|| AppError::ValidationError("数组字段必须是数组".to_string()))?;

    let mut items = Vec::new();
    for item in array {
        let value = item
            .as_str()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| AppError::ValidationError("数组元素必须是非空字符串".to_string()))?;
        items.push(value.to_string());
    }

    Ok(Some(items))
}
