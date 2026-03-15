/**
 * LSP 相关 Tauri 命令
 */

use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;

use crate::error::Result;
use crate::models::lsp::{
    LSPCheckResult, LSPCompletionItem, LSPHover, LSPInstallResult,
    LSPLocation, LSPServerType, LSPServerStatus,
};
use crate::services::lsp::LSPManager;

/// LSP 状态
pub struct LSPState {
    pub manager: Arc<Mutex<LSPManager>>,
}

impl Default for LSPState {
    fn default() -> Self {
        Self {
            manager: Arc::new(Mutex::new(LSPManager::new())),
        }
    }
}

/// 检查 LSP 服务器状态
#[tauri::command]
pub fn lsp_check_server(language: String, state: tauri::State<LSPState>) -> LSPCheckResult {
    let lang = parse_language(&language);
    let manager = state.manager.lock();

    let (status, path, version) = manager.check_server(lang);
    let error = if status == LSPServerStatus::Error || status == LSPServerStatus::NotInstalled {
        Some(format!("{} LSP not available", language))
    } else {
        None
    };

    LSPCheckResult {
        status,
        path,
        version,
        error,
    }
}

/// 安装 LSP 服务器
#[tauri::command]
pub fn lsp_install_server(language: String, state: tauri::State<LSPState>) -> LSPInstallResult {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.install_server(lang)
}

/// 卸载 LSP 服务器
#[tauri::command]
pub fn lsp_uninstall_server(language: String, state: tauri::State<LSPState>) -> LSPInstallResult {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.uninstall_server(lang)
}

/// 启动 LSP 服务器
#[tauri::command]
pub fn lsp_start_server(language: String, workspace_root: String, state: tauri::State<LSPState>) -> Result<()> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.start_server(lang, PathBuf::from(workspace_root))
}

/// 停止 LSP 服务器
#[tauri::command]
pub fn lsp_stop_server(language: String, state: tauri::State<LSPState>) {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.stop_server(lang);
}

/// 通知文件变化
#[tauri::command]
pub fn lsp_did_change(language: String, uri: String, content: String, state: tauri::State<LSPState>) -> Result<()> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.did_change(lang, &uri, &content)
}

/// 请求补全
#[tauri::command]
pub fn lsp_completion(
    language: String,
    uri: String,
    _content: String,
    line: u32,
    character: u32,
    state: tauri::State<LSPState>,
) -> Result<Vec<LSPCompletionItem>> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.completion(lang, &uri, line, character)
}

/// 请求诊断
#[tauri::command]
pub fn lsp_diagnostics(_language: String, _uri: String) -> Vec<crate::models::lsp::LSPDiagnostic> {
    // 诊断通常通过通知推送，这里返回空
    vec![]
}

/// 跳转到定义
#[tauri::command]
pub fn lsp_goto_definition(
    language: String,
    uri: String,
    line: u32,
    character: u32,
    state: tauri::State<LSPState>,
) -> Result<Option<LSPLocation>> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.goto_definition(lang, &uri, line, character)
}

/// 查找引用
#[tauri::command]
pub fn lsp_find_references(
    language: String,
    uri: String,
    line: u32,
    character: u32,
    state: tauri::State<LSPState>,
) -> Result<Vec<LSPLocation>> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.find_references(lang, &uri, line, character)
}

/// 悬停信息
#[tauri::command]
pub fn lsp_hover(
    language: String,
    uri: String,
    line: u32,
    character: u32,
    state: tauri::State<LSPState>,
) -> Result<Option<LSPHover>> {
    let lang = parse_language(&language);
    let manager = state.manager.lock();
    manager.hover(lang, &uri, line, character)
}

/// 解析语言类型
fn parse_language(language: &str) -> LSPServerType {
    match language.to_lowercase().as_str() {
        "typescript" | "tsx" => LSPServerType::TypeScript,
        "javascript" | "jsx" => LSPServerType::JavaScript,
        "rust" => LSPServerType::Rust,
        "python" => LSPServerType::Python,
        _ => LSPServerType::TypeScript, // 默认
    }
}
