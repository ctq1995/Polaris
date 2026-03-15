/**
 * LSP 相关模型定义
 */

use serde::{Deserialize, Serialize};

/// LSP 服务器状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LSPServerStatus {
    NotInstalled,
    Installing,
    Installed,
    Starting,
    Running,
    Error,
}

/// LSP 服务器类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum LSPServerType {
    TypeScript,
    JavaScript,
    Rust,
    Python,
}

/// LSP 服务器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPServerInfo {
    /// 服务器类型
    pub language: LSPServerType,
    /// 是否启用
    pub enabled: bool,
    /// 当前状态
    pub status: LSPServerStatus,
    /// 版本号
    pub version: Option<String>,
    /// 可执行路径
    pub path: Option<String>,
    /// 错误信息
    pub error: Option<String>,
}

/// LSP 位置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPLocation {
    /// 文件 URI
    pub uri: String,
    /// 范围
    pub range: LSPRange,
}

/// LSP 范围
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPRange {
    pub start: LSPPosition,
    pub end: LSPPosition,
}

/// LSP 位置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPPosition {
    pub line: u32,
    pub character: u32,
}

/// LSP 补全项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPCompletionItem {
    /// 标签
    pub label: String,
    /// 类型
    pub kind: u32,
    /// 详情
    pub detail: Option<String>,
    /// 文档
    pub documentation: Option<String>,
    /// 插入文本
    pub insert_text: Option<String>,
}

/// LSP 诊断信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPDiagnostic {
    /// 范围
    pub range: LSPRange,
    /// 严重程度
    pub severity: u32,
    /// 消息
    pub message: String,
    /// 来源
    pub source: Option<String>,
}

/// LSP 悬停信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPHover {
    /// 内容
    pub contents: String,
}

/// LSP 检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPCheckResult {
    pub status: LSPServerStatus,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// LSP 安装结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LSPInstallResult {
    pub success: bool,
    pub error: Option<String>,
}
