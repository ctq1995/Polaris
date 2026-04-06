/*! 工具执行器 trait 定义
 *
 * 定义所有工具执行器必须实现的接口。
 * 参考 claw-code 的 ToolExecutor trait 设计。
 */

use std::collections::HashMap;
use std::sync::Arc;
use async_trait::async_trait;
use serde_json::Value;

use crate::ai::adapters::ToolDefinition;
use crate::ai::tools::types::{ToolError, PermissionPolicy, PermissionMode, ToolSpec};

/// 工具执行器 trait
///
/// 所有工具执行器必须实现此 trait。
/// 支持异步执行和权限检查。
#[async_trait]
pub trait PolarisToolExecutor: Send + Sync {
    /// 执行工具
    ///
    /// # 参数
    /// - `tool_name`: 工具名称
    /// - `input`: 工具输入参数（JSON Value）
    ///
    /// # 返回
    /// - `Ok(String)`: 工具执行结果（JSON 字符串）
    /// - `Err(ToolError)`: 执行错误
    async fn execute(&self, tool_name: &str, input: &Value) -> Result<String, ToolError>;

    /// 获取可用工具列表
    ///
    /// 返回所有已注册工具的定义，用于发送给 API。
    fn available_tools(&self) -> Vec<ToolDefinition>;

    /// 获取工具规范列表
    ///
    /// 返回所有已注册工具的规范，包含权限信息。
    fn tool_specs(&self) -> Vec<crate::ai::tools::types::ToolSpec>;

    /// 检查工具是否可用
    fn has_tool(&self, name: &str) -> bool;

    /// 获取权限策略
    fn permission_policy(&self) -> &PermissionPolicy;

    /// 检查工具执行权限
    fn check_permission(&self, tool_name: &str) -> Result<(), ToolError> {
        let policy = self.permission_policy();
        let current_mode = policy.default_mode;
        policy.check(tool_name, &current_mode)
    }

    /// 设置权限策略（如果支持）
    fn set_permission_policy(&mut self, policy: PermissionPolicy);

    /// 获取工作目录
    fn work_dir(&self) -> Option<&std::path::Path>;

    /// 设置工作目录（如果支持）
    fn set_work_dir(&mut self, work_dir: std::path::PathBuf);
}

/// 工具执行回调
///
/// 用于在工具执行过程中发送进度更新。
pub type ToolProgressCallback = Arc<dyn Fn(String, Option<u32>) + Send + Sync>;

/// 工具执行上下文
///
/// 包含工具执行所需的所有上下文信息。
pub struct ToolExecutionContext {
    /// 工作目录
    pub work_dir: std::path::PathBuf,
    /// 权限策略
    pub permission_policy: PermissionPolicy,
    /// 进度回调（可选）
    pub progress_callback: Option<ToolProgressCallback>,
    /// 会话 ID（可选，用于事件路由）
    pub session_id: Option<String>,
}

impl ToolExecutionContext {
    /// 创建新的执行上下文
    pub fn new(work_dir: impl Into<std::path::PathBuf>) -> Self {
        Self {
            work_dir: work_dir.into(),
            permission_policy: PermissionPolicy::default(),
            progress_callback: None,
            session_id: None,
        }
    }

    /// 设置权限策略
    pub fn with_permission_policy(mut self, policy: PermissionPolicy) -> Self {
        self.permission_policy = policy;
        self
    }

    /// 设置进度回调
    pub fn with_progress_callback(mut self, callback: ToolProgressCallback) -> Self {
        self.progress_callback = Some(callback);
        self
    }

    /// 设置会话 ID
    pub fn with_session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    /// 发送进度更新
    pub fn send_progress(&self, message: String, percent: Option<u32>) {
        if let Some(callback) = &self.progress_callback {
            callback(message, percent);
        }
    }

    /// 解析路径（相对于工作目录）
    pub fn resolve_path(&self, path: &str) -> std::path::PathBuf {
        let p = std::path::Path::new(path);
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            self.work_dir.join(p)
        }
    }

    /// 检查路径是否在工作区内
    pub fn check_path_in_workspace(&self, path: &std::path::Path) -> bool {
        self.permission_policy.check_path_in_workspace(path)
    }
}

/// 工具处理器函数类型
///
/// 定义工具的具体执行逻辑。
pub type ToolHandler = fn(&ToolExecutionContext, &Value) -> Result<String, ToolError>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_tool_execution_context_new() {
        let ctx = ToolExecutionContext::new("/tmp/test");
        assert_eq!(ctx.work_dir, PathBuf::from("/tmp/test"));
        assert!(ctx.session_id.is_none());
        assert!(ctx.progress_callback.is_none());
    }

    #[test]
    fn test_tool_execution_context_with_options() {
        let ctx = ToolExecutionContext::new("/tmp/test")
            .with_session_id("test-session")
            .with_permission_policy(PermissionPolicy::new(crate::ai::tools::types::PermissionMode::WorkspaceWrite));

        assert_eq!(ctx.session_id, Some("test-session".to_string()));
        assert_eq!(ctx.permission_policy.default_mode, crate::ai::tools::types::PermissionMode::WorkspaceWrite);
    }

    #[test]
    fn test_resolve_path() {
        let ctx = ToolExecutionContext::new("/tmp/test");

        // 绝对路径保持不变
        let abs = ctx.resolve_path("/absolute/path");
        assert_eq!(abs, PathBuf::from("/absolute/path"));

        // 相对路径添加工作目录前缀
        let rel = ctx.resolve_path("relative/path");
        assert_eq!(rel, PathBuf::from("/tmp/test/relative/path"));
    }
}

/// 基础工具执行器
///
/// 提供简单的工具注册和执行机制。
/// 支持：
/// - 工具注册（register_tool）
/// - 权限检查（permission_policy）
/// - 异步执行（execute）
pub struct BasicToolExecutor {
    /// 工具注册表
    tools: HashMap<String, ToolHandler>,
    /// 工具规范注册表
    tool_specs: HashMap<String, ToolSpec>,
    /// 权限策略
    permission_policy: PermissionPolicy,
    /// 工作目录
    work_dir: std::path::PathBuf,
}

impl BasicToolExecutor {
    /// 创建新的基础工具执行器
    ///
    /// 默认使用 ReadOnly 权限模式。
    pub fn new(work_dir: impl Into<std::path::PathBuf>) -> Self {
        let work_dir = work_dir.into();
        Self {
            tools: HashMap::new(),
            tool_specs: HashMap::new(),
            permission_policy: PermissionPolicy::new(PermissionMode::ReadOnly)
                .with_work_dir(&work_dir),
            work_dir,
        }
    }

    /// 注册工具
    ///
    /// # 参数
    /// - `spec`: 工具规范（名称、描述、schema）
    /// - `handler`: 工具执行处理器函数
    pub fn register_tool(&mut self, spec: ToolSpec, handler: ToolHandler) {
        let name = spec.name.clone();
        self.tools.insert(name.clone(), handler);
        self.tool_specs.insert(name, spec);
    }

    /// 注册内置工具
    ///
    /// 注册 core_tool_specs() 中定义的核心工具。
    pub fn register_builtin_tools(&mut self) {
        for spec in crate::ai::tools::types::core_tool_specs() {
            let name = spec.name.clone();
            let handler = match name.as_str() {
                "read_file" => Self::handle_read_file,
                "write_file" => Self::handle_write_file,
                "edit_file" => Self::handle_edit_file,
                "glob_search" => Self::handle_glob_search,
                "grep_search" => Self::handle_grep_search,
                _ => continue,
            };
            self.register_tool(spec, handler);
        }
    }

    /// 设置权限模式
    pub fn with_permission_mode(mut self, mode: PermissionMode) -> Self {
        self.permission_policy = PermissionPolicy::new(mode)
            .with_work_dir(&self.work_dir);
        self
    }

    /// 设置工作目录
    pub fn with_work_dir(mut self, work_dir: impl Into<std::path::PathBuf>) -> Self {
        self.work_dir = work_dir.into();
        self.permission_policy = self.permission_policy.clone().with_work_dir(&self.work_dir);
        self
    }

    /// 内置工具处理器：read_file
    ///
    /// 真实实现：读取文件内容，支持 offset/limit 分页。
    /// 参考 claw-code file_ops.rs 的实现逻辑。
    fn handle_read_file(ctx: &ToolExecutionContext, input: &Value) -> Result<String, ToolError> {
        use std::fs;
        use std::io::Read;

        /// 最大文件读取大小（10 MB）
        const MAX_READ_SIZE: u64 = 10 * 1024 * 1024;

        let path = input["path"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 path 参数".to_string()))?;

        // 可选参数
        let offset: Option<usize> = input["offset"].as_u64().map(|v| v as usize);
        let limit: Option<usize> = input["limit"].as_u64().map(|v| v as usize);

        let resolved_path = ctx.resolve_path(path);

        // 检查路径在工作区内
        if !ctx.check_path_in_workspace(&resolved_path) {
            return Err(ToolError::PermissionDenied {
                tool: "read_file".to_string(),
                required: PermissionMode::ReadOnly,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 检查文件是否存在
        if !resolved_path.exists() {
            return Err(ToolError::ExecutionError(format!(
                "文件不存在: {}",
                resolved_path.display()
            )));
        }

        // 检查文件大小
        let metadata = fs::metadata(&resolved_path)
            .map_err(|e| ToolError::ExecutionError(format!("无法获取文件元数据: {}", e)))?;

        if metadata.len() > MAX_READ_SIZE {
            return Err(ToolError::ExecutionError(format!(
                "文件过大 ({} bytes, 最大 {} bytes)",
                metadata.len(),
                MAX_READ_SIZE
            )));
        }

        // 检查是否为二进制文件（检查前 8KB 是否包含 NUL 字节）
        let mut file = fs::File::open(&resolved_path)
            .map_err(|e| ToolError::ExecutionError(format!("无法打开文件: {}", e)))?;

        let mut buffer = [0u8; 8192];
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| ToolError::ExecutionError(format!("无法读取文件: {}", e)))?;

        if buffer[..bytes_read].contains(&0) {
            return Err(ToolError::ExecutionError("文件似乎是二进制文件".to_string()));
        }

        // 重新读取完整内容（因为是文本文件）
        let content = fs::read_to_string(&resolved_path)
            .map_err(|e| ToolError::ExecutionError(format!("无法读取文件内容: {}", e)))?;

        // 按行处理分页
        let lines: Vec<&str> = content.lines().collect();
        let start_index = offset.unwrap_or(0).min(lines.len());
        let end_index = limit.map_or(lines.len(), |lim| {
            start_index.saturating_add(lim).min(lines.len())
        });

        let selected_content = lines[start_index..end_index].join("\n");

        // 构建输出（JSON 格式，与 claw-code 兼容）
        let output = serde_json::json!({
            "type": "text",
            "file": {
                "filePath": resolved_path.to_string_lossy(),
                "content": selected_content,
                "numLines": end_index.saturating_sub(start_index),
                "startLine": start_index.saturating_add(1),
                "totalLines": lines.len()
            }
        });

        Ok(output.to_string())
    }

    /// 内置工具处理器：write_file
    ///
    /// 真实实现：写入文件内容，支持创建新文件和更新现有文件。
    /// 返回结构化输出包含文件路径和操作类型。
    fn handle_write_file(ctx: &ToolExecutionContext, input: &Value) -> Result<String, ToolError> {
        use std::fs;

        /// 最大写入大小（10 MB）
        const MAX_WRITE_SIZE: usize = 10 * 1024 * 1024;

        let path = input["path"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 path 参数".to_string()))?;
        let content = input["content"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 content 参数".to_string()))?;

        // 检查内容大小
        if content.len() > MAX_WRITE_SIZE {
            return Err(ToolError::ExecutionError(format!(
                "内容过大 ({} bytes, 最大 {} bytes)",
                content.len(),
                MAX_WRITE_SIZE
            )));
        }

        let resolved_path = ctx.resolve_path(path);

        // 检查路径在工作区内
        if !ctx.check_path_in_workspace(&resolved_path) {
            return Err(ToolError::PermissionDenied {
                tool: "write_file".to_string(),
                required: PermissionMode::WorkspaceWrite,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 检查是否有写入权限
        if !ctx.permission_policy.default_mode.satisfies(&PermissionMode::WorkspaceWrite) {
            return Err(ToolError::PermissionDenied {
                tool: "write_file".to_string(),
                required: PermissionMode::WorkspaceWrite,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 读取原文件（如果存在）
        let original_file = fs::read_to_string(&resolved_path).ok();

        // 创建父目录（如果不存在）
        if let Some(parent) = resolved_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ToolError::ExecutionError(format!("无法创建目录: {}", e)))?;
        }

        // 写入文件
        fs::write(&resolved_path, content)
            .map_err(|e| ToolError::ExecutionError(format!("无法写入文件: {}", e)))?;

        // 构建输出
        let output = serde_json::json!({
            "type": if original_file.is_some() { "update" } else { "create" },
            "filePath": resolved_path.to_string_lossy(),
            "content": content,
            "originalFile": original_file
        });

        Ok(output.to_string())
    }

    /// 内置工具处理器：edit_file
    ///
    /// 真实实现：在文件中替换指定字符串。
    /// 支持 replace_all 参数进行全局替换。
    fn handle_edit_file(ctx: &ToolExecutionContext, input: &Value) -> Result<String, ToolError> {
        use std::fs;

        let path = input["path"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 path 参数".to_string()))?;
        let old_string = input["old_string"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 old_string 参数".to_string()))?;
        let new_string = input["new_string"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 new_string 参数".to_string()))?;
        let replace_all = input["replace_all"].as_bool().unwrap_or(false);

        // 检查 old_string 和 new_string 是否不同
        if old_string == new_string {
            return Err(ToolError::ExecutionError("old_string 和 new_string 必须不同".to_string()));
        }

        let resolved_path = ctx.resolve_path(path);

        // 检查路径在工作区内
        if !ctx.check_path_in_workspace(&resolved_path) {
            return Err(ToolError::PermissionDenied {
                tool: "edit_file".to_string(),
                required: PermissionMode::WorkspaceWrite,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 检查是否有写入权限
        if !ctx.permission_policy.default_mode.satisfies(&PermissionMode::WorkspaceWrite) {
            return Err(ToolError::PermissionDenied {
                tool: "edit_file".to_string(),
                required: PermissionMode::WorkspaceWrite,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 检查文件是否存在
        if !resolved_path.exists() {
            return Err(ToolError::ExecutionError(format!(
                "文件不存在: {}",
                resolved_path.display()
            )));
        }

        // 读取原文件
        let original_file = fs::read_to_string(&resolved_path)
            .map_err(|e| ToolError::ExecutionError(format!("无法读取文件: {}", e)))?;

        // 检查 old_string 是否存在于文件中
        if !original_file.contains(old_string) {
            return Err(ToolError::ExecutionError("old_string 未在文件中找到".to_string()));
        }

        // 执行替换
        let updated = if replace_all {
            original_file.replace(old_string, new_string)
        } else {
            // 只替换第一次出现
            original_file.replacen(old_string, new_string, 1)
        };

        // 写入更新后的内容
        fs::write(&resolved_path, &updated)
            .map_err(|e| ToolError::ExecutionError(format!("无法写入文件: {}", e)))?;

        // 构建输出
        let output = serde_json::json!({
            "filePath": resolved_path.to_string_lossy(),
            "oldString": old_string,
            "newString": new_string,
            "originalFile": original_file,
            "replaceAll": replace_all
        });

        Ok(output.to_string())
    }

    /// 内置工具处理器：glob_search
    ///
    /// 真实实现：使用 glob 模式搜索文件。
    /// 参考 claw-code glob_search 实现。
    fn handle_glob_search(ctx: &ToolExecutionContext, input: &Value) -> Result<String, ToolError> {
        use std::time::Instant;
        use glob::glob;
        use std::path::PathBuf;

        let pattern = input["pattern"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 pattern 参数".to_string()))?;
        let search_path = input["path"].as_str();

        // 确定搜索基础目录
        let base_dir = if let Some(p) = search_path {
            ctx.resolve_path(p)
        } else {
            ctx.work_dir.clone()
        };

        // 检查基础目录在工作区内
        if !ctx.check_path_in_workspace(&base_dir) {
            return Err(ToolError::PermissionDenied {
                tool: "glob_search".to_string(),
                required: PermissionMode::ReadOnly,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 构建完整 glob 模式
        let full_pattern = if std::path::Path::new(pattern).is_absolute() {
            pattern.to_string()
        } else {
            base_dir.join(pattern).to_string_lossy().into_owned()
        };

        let started = Instant::now();
        let mut matches: Vec<PathBuf> = Vec::new();

        // 执行 glob 搜索
        let glob_result = glob(&full_pattern)
            .map_err(|e| ToolError::ExecutionError(format!("无效的 glob 模式: {}", e)))?;

        for entry in glob_result.flatten() {
            if entry.is_file() {
                matches.push(entry);
            }
        }

        // 按修改时间排序（最新的优先）
        matches.sort_by_key(|path: &PathBuf| {
            std::fs::metadata(path)
                .and_then(|m| m.modified())
                .ok()
                .map(std::cmp::Reverse)
        });

        // 限制结果数量（最多 100 个）
        let truncated = matches.len() > 100;
        let filenames: Vec<String> = matches
            .into_iter()
            .take(100)
            .map(|p: PathBuf| p.to_string_lossy().into_owned())
            .collect();

        // 构建输出
        let output = serde_json::json!({
            "durationMs": started.elapsed().as_millis(),
            "numFiles": filenames.len(),
            "filenames": filenames,
            "truncated": truncated
        });

        Ok(output.to_string())
    }

    /// 内置工具处理器：grep_search
    ///
    /// 真实实现：使用正则表达式搜索文件内容。
    /// 参考 claw-code grep_search 实现。
    fn handle_grep_search(ctx: &ToolExecutionContext, input: &Value) -> Result<String, ToolError> {
        use regex::RegexBuilder;
        use walkdir::WalkDir;
        use glob::Pattern;

        let pattern = input["pattern"].as_str()
            .ok_or_else(|| ToolError::InvalidInput("缺少 pattern 参数".to_string()))?;
        let search_path = input["path"].as_str();
        let glob_filter = input["glob"].as_str();
        let case_insensitive = input["-i"].as_bool().unwrap_or(false);
        let output_mode = input["output_mode"].as_str().unwrap_or("files_with_matches");
        let head_limit: Option<usize> = input["head_limit"].as_u64().map(|v| v as usize);
        let line_numbers = input["-n"].as_bool().unwrap_or(true);

        // 确定搜索基础目录
        let base_dir = if let Some(p) = search_path {
            ctx.resolve_path(p)
        } else {
            ctx.work_dir.clone()
        };

        // 检查基础目录在工作区内
        if !ctx.check_path_in_workspace(&base_dir) {
            return Err(ToolError::PermissionDenied {
                tool: "grep_search".to_string(),
                required: PermissionMode::ReadOnly,
                current: ctx.permission_policy.default_mode,
            });
        }

        // 构建正则表达式
        let regex = RegexBuilder::new(pattern)
            .case_insensitive(case_insensitive)
            .build()
            .map_err(|e| ToolError::ExecutionError(format!("无效的正则表达式: {}", e)))?;

        // 构建 glob 过滤器
        let glob_pattern = glob_filter
            .map(|g| Pattern::new(g))
            .transpose()
            .map_err(|e| ToolError::ExecutionError(format!("无效的 glob 模式: {}", e)))?;

        let mut filenames = Vec::new();
        let mut content_lines = Vec::new();
        let mut total_matches = 0usize;

        // 遍历文件
        for entry in WalkDir::new(&base_dir).into_iter().flatten() {
            let file_path = entry.path();

            // 只处理文件
            if !file_path.is_file() {
                continue;
            }

            // 应用 glob 过滤
            if let Some(ref gp) = glob_pattern {
                if !gp.matches_path(file_path) {
                    continue;
                }
            }

            // 读取文件内容
            let Ok(file_contents) = std::fs::read_to_string(file_path) else {
                continue;
            };

            if output_mode == "count" {
                let count = regex.find_iter(&file_contents).count();
                if count > 0 {
                    filenames.push(file_path.to_string_lossy().into_owned());
                    total_matches += count;
                }
                continue;
            }

            // 收集匹配行
            let lines: Vec<&str> = file_contents.lines().collect();
            let mut matched_indices = Vec::new();

            for (index, line) in lines.iter().enumerate() {
                if regex.is_match(line) {
                    total_matches += 1;
                    matched_indices.push(index);
                }
            }

            if matched_indices.is_empty() {
                continue;
            }

            filenames.push(file_path.to_string_lossy().into_owned());

            // 如果需要输出内容
            if output_mode == "content" {
                for index in matched_indices {
                    let line = lines[index];
                    let prefix = if line_numbers {
                        format!("{}:{}:", file_path.to_string_lossy(), index + 1)
                    } else {
                        format!("{}:", file_path.to_string_lossy())
                    };
                    content_lines.push(format!("{prefix}{line}"));
                }
            }
        }

        // 应用限制
        let (filenames, applied_limit) = apply_limit(filenames, head_limit);
        let content_output = if output_mode == "content" {
            let (lines, _) = apply_limit(content_lines, head_limit);
            Some(lines.join("\n"))
        } else {
            None
        };

        // 构建输出
        let output = serde_json::json!({
            "mode": output_mode,
            "numFiles": filenames.len(),
            "filenames": filenames,
            "content": content_output,
            "numMatches": if output_mode == "count" { Some(total_matches) } else { None },
            "appliedLimit": applied_limit
        });

        Ok(output.to_string())
    }
}

/// 辅助函数：应用限制
fn apply_limit<T>(items: Vec<T>, limit: Option<usize>) -> (Vec<T>, Option<usize>) {
    if let Some(lim) = limit {
        let truncated = items.len() > lim;
        (items.into_iter().take(lim).collect(), if truncated { Some(lim) } else { None })
    } else {
        (items, None)
    }
}

#[async_trait]
impl PolarisToolExecutor for BasicToolExecutor {
    async fn execute(&self, tool_name: &str, input: &Value) -> Result<String, ToolError> {
        // 检查工具是否存在
        let handler = self.tools.get(tool_name)
            .ok_or_else(|| ToolError::NotFound(tool_name.to_string()))?;

        // 检查权限
        self.check_permission(tool_name)?;

        // 创建执行上下文
        let ctx = ToolExecutionContext::new(&self.work_dir)
            .with_permission_policy(self.permission_policy.clone());

        // 执行工具（同步调用，包装为异步）
        let result = handler(&ctx, input);
        async move { result }.await
    }

    fn available_tools(&self) -> Vec<ToolDefinition> {
        self.tool_specs.values()
            .map(|spec| spec.to_tool_definition())
            .collect()
    }

    fn tool_specs(&self) -> Vec<ToolSpec> {
        self.tool_specs.values().cloned().collect()
    }

    fn has_tool(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }

    fn permission_policy(&self) -> &PermissionPolicy {
        &self.permission_policy
    }

    fn set_permission_policy(&mut self, policy: PermissionPolicy) {
        self.permission_policy = policy;
    }

    fn work_dir(&self) -> Option<&std::path::Path> {
        Some(&self.work_dir)
    }

    fn set_work_dir(&mut self, work_dir: std::path::PathBuf) {
        self.work_dir = work_dir.clone();
        self.permission_policy = self.permission_policy.clone().with_work_dir(&work_dir);
    }
}

#[cfg(test)]
mod basic_executor_tests {
    use super::*;

    #[test]
    fn test_basic_executor_new() {
        let executor = BasicToolExecutor::new("/tmp/test");
        assert!(executor.work_dir().is_some());
        assert_eq!(executor.permission_policy().default_mode, PermissionMode::ReadOnly);
        assert!(!executor.has_tool("read_file"));
    }

    #[test]
    fn test_basic_executor_register_builtin_tools() {
        let mut executor = BasicToolExecutor::new("/tmp/test");
        executor.register_builtin_tools();

        assert!(executor.has_tool("read_file"));
        assert!(executor.has_tool("write_file"));
        assert!(executor.has_tool("edit_file"));
        assert!(executor.has_tool("glob_search"));
        assert!(executor.has_tool("grep_search"));
    }

    #[test]
    fn test_basic_executor_available_tools() {
        let mut executor = BasicToolExecutor::new("/tmp/test");
        executor.register_builtin_tools();

        let tools = executor.available_tools();
        assert_eq!(tools.len(), 5);

        // 检查 read_file 定义
        let read_def = tools.iter().find(|t| t.name == "read_file").unwrap();
        assert!(read_def.description.is_some());
    }

    #[test]
    fn test_basic_executor_with_permission_mode() {
        let executor = BasicToolExecutor::new("/tmp/test")
            .with_permission_mode(PermissionMode::WorkspaceWrite);

        assert_eq!(executor.permission_policy().default_mode, PermissionMode::WorkspaceWrite);
    }

    #[tokio::test]
    async fn test_basic_executor_execute_not_found() {
        let executor = BasicToolExecutor::new("/tmp/test");

        let result = executor.execute("unknown_tool", &serde_json::json!({})).await;
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert!(matches!(err, ToolError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_basic_executor_execute_read_file() {
        use std::fs;
        use tempfile::tempdir;

        // 创建临时目录和测试文件
        let temp_dir = tempdir().expect("无法创建临时目录");
        let test_file = temp_dir.path().join("test.txt");
        fs::write(&test_file, "Hello, World!\nSecond line\nThird line").expect("无法写入测试文件");

        let mut executor = BasicToolExecutor::new(temp_dir.path());
        executor.register_builtin_tools();

        let input = serde_json::json!({
            "path": test_file.to_string_lossy()
        });

        let result = executor.execute("read_file", &input).await;
        // 真实实现应该成功并返回 JSON 格式
        assert!(result.is_ok());
        let output = result.unwrap();
        // 解析 JSON 输出
        let json: serde_json::Value = serde_json::from_str(&output).expect("输出应该是有效 JSON");
        assert_eq!(json["type"], "text");
        assert!(json["file"]["content"].as_str().unwrap().contains("Hello, World"));
    }

    #[tokio::test]
    async fn test_basic_executor_execute_read_file_with_limit() {
        use std::fs;
        use tempfile::tempdir;

        // 创建临时目录和测试文件
        let temp_dir = tempdir().expect("无法创建临时目录");
        let test_file = temp_dir.path().join("multi.txt");
        fs::write(&test_file, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5").expect("无法写入测试文件");

        let mut executor = BasicToolExecutor::new(temp_dir.path());
        executor.register_builtin_tools();

        let input = serde_json::json!({
            "path": test_file.to_string_lossy(),
            "offset": 1,
            "limit": 2
        });

        let result = executor.execute("read_file", &input).await;
        assert!(result.is_ok());
        let output = result.unwrap();
        let json: serde_json::Value = serde_json::from_str(&output).expect("输出应该是有效 JSON");
        // 应该只包含 Line 2 和 Line 3
        assert_eq!(json["file"]["numLines"], 2);
    }

    #[tokio::test]
    async fn test_basic_executor_execute_write_file_permission_denied() {
        // ReadOnly 模式下，write_file 需要 WorkspaceWrite 权限
        let mut executor = BasicToolExecutor::new("/tmp/test");
        executor.register_builtin_tools();

        let input = serde_json::json!({
            "path": "test.txt",
            "content": "hello"
        });

        let result = executor.execute("write_file", &input).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_basic_executor_execute_write_file_with_permission() {
        use std::fs;
        use tempfile::tempdir;

        // WorkspaceWrite 模式下，write_file 应成功
        let temp_dir = tempdir().expect("无法创建临时目录");

        let mut executor = BasicToolExecutor::new(temp_dir.path())
            .with_permission_mode(PermissionMode::WorkspaceWrite);
        executor.register_builtin_tools();

        let input = serde_json::json!({
            "path": "test.txt",
            "content": "hello world"
        });

        let result = executor.execute("write_file", &input).await;
        assert!(result.is_ok());
        let output = result.unwrap();
        // 验证 JSON 输出
        let json: serde_json::Value = serde_json::from_str(&output).expect("输出应该是有效 JSON");
        assert_eq!(json["type"], "create");
        assert!(json["filePath"].as_str().unwrap().contains("test.txt"));
    }

    #[tokio::test]
    async fn test_basic_executor_execute_edit_file_with_permission() {
        use std::fs;
        use tempfile::tempdir;

        let temp_dir = tempdir().expect("无法创建临时目录");
        let test_file = temp_dir.path().join("edit.txt");
        fs::write(&test_file, "Hello, World!").expect("无法写入测试文件");

        let mut executor = BasicToolExecutor::new(temp_dir.path())
            .with_permission_mode(PermissionMode::WorkspaceWrite);
        executor.register_builtin_tools();

        let input = serde_json::json!({
            "path": test_file.to_string_lossy(),
            "old_string": "Hello",
            "new_string": "Goodbye"
        });

        let result = executor.execute("edit_file", &input).await;
        assert!(result.is_ok());
        let output = result.unwrap();
        let json: serde_json::Value = serde_json::from_str(&output).expect("输出应该是有效 JSON");
        assert_eq!(json["oldString"], "Hello");
        assert_eq!(json["newString"], "Goodbye");

        // 验证文件内容已更新
        let updated = fs::read_to_string(&test_file).expect("无法读取文件");
        assert!(updated.contains("Goodbye"));
    }

    #[test]
    fn test_basic_executor_set_permission_policy() {
        let mut executor = BasicToolExecutor::new("/tmp/test");
        executor.register_builtin_tools();

        let new_policy = PermissionPolicy::new(PermissionMode::DangerFullAccess);
        executor.set_permission_policy(new_policy);

        assert_eq!(executor.permission_policy().default_mode, PermissionMode::DangerFullAccess);
    }

    #[test]
    fn test_basic_executor_set_work_dir() {
        let mut executor = BasicToolExecutor::new("/tmp/test");
        executor.set_work_dir(std::path::PathBuf::from("/new/work/dir"));

        assert_eq!(executor.work_dir(), Some(std::path::Path::new("/new/work/dir")));
    }
}