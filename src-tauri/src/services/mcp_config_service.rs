use std::path::{Path, PathBuf};

use crate::error::{AppError, Result};

const MCP_SERVER_NAME: &str = "polaris-todo";
const MCP_CONFIG_RELATIVE_PATH: &str = ".polaris/claude/mcp.json";
const TODO_MCP_CLI_RELATIVE_PATH: &str = "dist/mcp/todoMcpServerCli.js";

#[derive(Debug, Clone, serde::Serialize)]
struct ClaudeMcpServerConfig {
    command: String,
    args: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeMcpConfig {
    mcp_servers: std::collections::BTreeMap<String, ClaudeMcpServerConfig>,
}

pub struct WorkspaceMcpConfigService {
    app_root: PathBuf,
}

impl WorkspaceMcpConfigService {
    pub fn new(app_root: PathBuf) -> Self {
        Self { app_root }
    }

    pub fn prepare_todo_config(&self, workspace_path: &str) -> Result<PathBuf> {
        let normalized_workspace = workspace_path.trim();
        if normalized_workspace.is_empty() {
            return Err(AppError::ValidationError("workspace_path 不能为空".to_string()));
        }

        let workspace_dir = PathBuf::from(normalized_workspace);
        let config_path = workspace_dir.join(Path::new(MCP_CONFIG_RELATIVE_PATH));

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::ProcessError(format!("创建 MCP 配置目录失败: {}", e))
            })?;
        }

        let cli_script_path = self.app_root.join(Path::new(TODO_MCP_CLI_RELATIVE_PATH));
        let command = resolve_node_command()?;
        let args = vec![
            cli_script_path.to_string_lossy().to_string(),
            normalized_workspace.to_string(),
        ];

        let mut servers = std::collections::BTreeMap::new();
        servers.insert(
            MCP_SERVER_NAME.to_string(),
            ClaudeMcpServerConfig { command, args },
        );

        let config = ClaudeMcpConfig {
            mcp_servers: servers,
        };

        write_json_atomically(&config_path, &config)?;
        Ok(config_path)
    }
}

fn resolve_node_command() -> Result<String> {
    if let Ok(path) = std::env::var("POLARIS_NODE_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    Ok("node".to_string())
}

fn write_json_atomically<T: serde::Serialize>(path: &Path, value: &T) -> Result<()> {
    let temp_path = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(value)?;
    std::fs::write(&temp_path, format!("{}\n", content))?;
    std::fs::rename(&temp_path, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepares_workspace_scoped_mcp_config() {
        let temp_root = std::env::temp_dir().join(format!("polaris-mcp-test-{}", uuid::Uuid::new_v4()));
        let workspace = temp_root.join("workspace-a");
        let app_root = temp_root.join("app-root");

        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(app_root.join("dist/mcp")).unwrap();
        std::fs::write(app_root.join("dist/mcp/todoMcpServerCli.js"), "// cli").unwrap();

        let service = WorkspaceMcpConfigService::new(app_root.clone());
        let config_path = service.prepare_todo_config(workspace.to_string_lossy().as_ref()).unwrap();

        assert_eq!(config_path, workspace.join(".polaris/claude/mcp.json"));

        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        let server = &json["mcpServers"][MCP_SERVER_NAME];
        assert_eq!(server["command"], serde_json::Value::String("node".to_string()));
        assert_eq!(
            server["args"][0],
            serde_json::Value::String(app_root.join("dist/mcp/todoMcpServerCli.js").to_string_lossy().to_string())
        );
        assert_eq!(
            server["args"][1],
            serde_json::Value::String(workspace.to_string_lossy().to_string())
        );

        let _ = std::fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn rewrites_existing_config_idempotently() {
        let temp_root = std::env::temp_dir().join(format!("polaris-mcp-test-{}", uuid::Uuid::new_v4()));
        let workspace = temp_root.join("workspace-b");
        let app_root = temp_root.join("app-root");

        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(app_root.join("dist/mcp")).unwrap();
        std::fs::write(app_root.join("dist/mcp/todoMcpServerCli.js"), "// cli").unwrap();

        let service = WorkspaceMcpConfigService::new(app_root.clone());
        let first = service.prepare_todo_config(workspace.to_string_lossy().as_ref()).unwrap();
        let first_content = std::fs::read_to_string(&first).unwrap();
        let second = service.prepare_todo_config(workspace.to_string_lossy().as_ref()).unwrap();
        let second_content = std::fs::read_to_string(&second).unwrap();

        assert_eq!(first, second);
        assert_eq!(first_content, second_content);

        let _ = std::fs::remove_dir_all(&temp_root);
    }
}
