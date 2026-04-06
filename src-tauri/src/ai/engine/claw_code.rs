/*! ClawCode 引擎实现
 *
 * 使用 claw-code 适配层实现的 AI 引擎。
 * 基于 OpenAiCompatClient 和 convert.rs 转换层。
 */

use std::collections::HashMap;

use tokio_util::sync::CancellationToken;

use crate::ai::adapters::{
    history_entries_to_input_messages, stream_event_to_ai_event,
    InputMessage, MessageRequest, OpenAiCompatClient, OpenAiCompatConfig,
};
use crate::ai::session::SessionManager;
use crate::ai::traits::{AIEngine, EngineId, SessionOptions};
use crate::error::{AppError, Result};
use crate::models::AIEvent;

/// ClawCode 引擎配置
#[derive(Debug, Clone)]
pub struct ClawCodeConfig {
    /// Provider 名称（用于日志）
    pub provider_name: String,
    /// API Key
    pub api_key: String,
    /// API Base URL
    pub base_url: String,
    /// 模型名称
    pub model: String,
    /// 最大输出 token 数
    pub max_tokens: u32,
    /// 温度参数
    pub temperature: f32,
}

impl Default for ClawCodeConfig {
    fn default() -> Self {
        Self {
            provider_name: "ClawCode".to_string(),
            api_key: String::new(),
            base_url: String::new(),
            model: String::new(),
            max_tokens: 4096,
            temperature: 0.7,
        }
    }
}

impl ClawCodeConfig {
    /// 创建配置
    pub fn new(
        provider_name: impl Into<String>,
        api_key: impl Into<String>,
        base_url: impl Into<String>,
        model: impl Into<String>,
    ) -> Self {
        Self {
            provider_name: provider_name.into(),
            api_key: api_key.into(),
            base_url: base_url.into(),
            model: model.into(),
            ..Default::default()
        }
    }

    /// 设置最大 token 数
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }

    /// 设置温度
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = temperature;
        self
    }

    /// 转换为 OpenAiCompatConfig
    fn to_compat_config(&self) -> OpenAiCompatConfig {
        OpenAiCompatConfig::custom(
            &self.provider_name,
            &self.api_key,
            &self.base_url,
            &self.model,
        )
        .with_max_tokens(self.max_tokens)
        .with_temperature(self.temperature)
    }
}

/// ClawCode 引擎
///
/// 使用 claw-code 适配层实现的 AI 引擎，
/// 支持 OpenAI 兼容 API 和流式响应。
pub struct ClawCodeEngine {
    /// 引擎配置
    config: Option<ClawCodeConfig>,
    /// OpenAI 兼容客户端
    client: Option<OpenAiCompatClient>,
    /// 会话管理器
    sessions: SessionManager,
    /// 取消令牌映射
    cancel_tokens: HashMap<String, CancellationToken>,
}

impl ClawCodeEngine {
    /// 创建新的 ClawCode 引擎
    pub fn new() -> Self {
        Self {
            config: None,
            client: None,
            sessions: SessionManager::new(),
            cancel_tokens: HashMap::new(),
        }
    }

    /// 使用配置创建引擎
    pub fn with_config(config: ClawCodeConfig) -> Self {
        let compat_config = config.to_compat_config();
        let client = OpenAiCompatClient::new(compat_config);

        Self {
            config: Some(config),
            client: Some(client),
            sessions: SessionManager::new(),
            cancel_tokens: HashMap::new(),
        }
    }

    /// 设置配置
    pub fn set_config(&mut self, config: ClawCodeConfig) {
        let compat_config = config.to_compat_config();
        self.client = Some(OpenAiCompatClient::new(compat_config));
        self.config = Some(config);
    }

    /// 构建消息请求
    fn build_request(
        &self,
        messages: Vec<InputMessage>,
        system_prompt: Option<&str>,
    ) -> MessageRequest {
        MessageRequest {
            model: self.config.as_ref().map(|c| c.model.clone()).unwrap_or_default(),
            max_tokens: self.config.as_ref().map(|c| c.max_tokens).unwrap_or(4096),
            messages,
            system: system_prompt.map(|s| s.to_string()),
            tools: None,
            tool_choice: None,
            stream: true,
        }
    }

    /// 执行流式聊天请求
    async fn execute_stream_chat(
        &mut self,
        messages: Vec<InputMessage>,
        options: SessionOptions,
        session_id: String,
    ) -> Result<()> {
        let client = self.client.as_ref()
            .ok_or_else(|| AppError::ValidationError("ClawCode 配置未设置".to_string()))?;

        let cancel_token = CancellationToken::new();
        self.cancel_tokens.insert(session_id.clone(), cancel_token.clone());

        let event_callback = options.event_callback.clone();

        // 构建请求
        let request = self.build_request(messages, options.system_prompt.as_deref());

        tracing::info!("[ClawCodeEngine] 开始流式请求 (session: {})", session_id);

        // 发送流式请求
        let mut stream = client.stream_message(&request).await?;

        // 处理流事件
        while !cancel_token.is_cancelled() {
            match stream.next_event().await {
                Ok(Some(event)) => {
                    // 转换事件并发送
                    if let Some(ai_event) = stream_event_to_ai_event(&event, &session_id) {
                        event_callback(ai_event);
                    }
                }
                Ok(None) => {
                    // 流结束
                    tracing::info!("[ClawCodeEngine] 流结束 (session: {})", session_id);
                    break;
                }
                Err(e) => {
                    tracing::error!("[ClawCodeEngine] 流错误: {}", e);
                    event_callback(AIEvent::Error(crate::models::ErrorEvent::new(
                        &session_id,
                        e.to_string(),
                    )));
                    break;
                }
            }
        }

        // 清理
        self.cancel_tokens.remove(&session_id);

        if cancel_token.is_cancelled() {
            tracing::info!("[ClawCodeEngine] 会话已取消: {}", session_id);
        }

        Ok(())
    }
}

impl AIEngine for ClawCodeEngine {
    fn id(&self) -> EngineId {
        EngineId::OpenAI {
            provider_id: Some("claw-code".to_string()),
        }
    }

    fn name(&self) -> &'static str {
        "ClawCode"
    }

    fn description(&self) -> &'static str {
        "使用 claw-code 适配层的 AI 引擎"
    }

    fn is_available(&self) -> bool {
        self.config.is_some() && self.client.is_some()
    }

    fn unavailable_reason(&self) -> Option<String> {
        if self.config.is_none() {
            Some("未配置 ClawCode Provider".to_string())
        } else {
            None
        }
    }

    fn start_session(
        &mut self,
        message: &str,
        options: SessionOptions,
    ) -> Result<String> {
        tracing::info!("[ClawCodeEngine] 启动会话");

        if !self.is_available() {
            return Err(AppError::ValidationError(
                self.unavailable_reason().unwrap_or_else(|| "引擎不可用".to_string()),
            ));
        }

        let session_id = uuid::Uuid::new_v4().to_string();

        // 注册会话
        self.sessions.register(
            session_id.clone(),
            0, // 无 PID
            "claw-code".to_string(),
        )?;

        // 构建消息
        let messages = vec![InputMessage::user_text(message)];

        // 克隆必要数据用于异步任务
        let mut engine_clone = ClawCodeEngine {
            config: self.config.clone(),
            client: self.client.clone(),
            sessions: SessionManager::new(),
            cancel_tokens: HashMap::new(),
        };

        let sid = session_id.clone();

        // 异步执行
        tokio::spawn(async move {
            if let Err(e) = engine_clone.execute_stream_chat(messages, options, sid.clone()).await {
                tracing::error!("[ClawCodeEngine] 执行失败: {}", e);
            }
        });

        Ok(session_id)
    }

    fn continue_session(
        &mut self,
        _session_id: &str,
        message: &str,
        options: SessionOptions,
    ) -> Result<()> {
        tracing::info!("[ClawCodeEngine] 继续会话 (history_len: {})", options.message_history.len());

        if !self.is_available() {
            return Err(AppError::ValidationError(
                self.unavailable_reason().unwrap_or_else(|| "引擎不可用".to_string()),
            ));
        }

        let session_id = uuid::Uuid::new_v4().to_string();

        // 注册会话
        self.sessions.register(
            session_id.clone(),
            0,
            "claw-code".to_string(),
        )?;

        // 转换历史消息
        let mut messages = history_entries_to_input_messages(&options.message_history);

        // 添加新消息
        messages.push(InputMessage::user_text(message));

        // 克隆必要数据用于异步任务
        let mut engine_clone = ClawCodeEngine {
            config: self.config.clone(),
            client: self.client.clone(),
            sessions: SessionManager::new(),
            cancel_tokens: HashMap::new(),
        };

        let sid = session_id.clone();

        // 异步执行
        tokio::spawn(async move {
            if let Err(e) = engine_clone.execute_stream_chat(messages, options, sid.clone()).await {
                tracing::error!("[ClawCodeEngine] 继续会话执行失败: {}", e);
            }
        });

        Ok(())
    }

    fn interrupt(&mut self, session_id: &str) -> Result<()> {
        tracing::info!("[ClawCodeEngine] 中断会话: {}", session_id);

        if let Some(token) = self.cancel_tokens.remove(session_id) {
            token.cancel();
            tracing::info!("[ClawCodeEngine] 会话已取消: {}", session_id);
        }

        self.sessions.remove(session_id);
        Ok(())
    }

    fn active_session_count(&self) -> usize {
        self.cancel_tokens.len()
    }
}

impl Default for ClawCodeEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = ClawCodeConfig::default();
        assert_eq!(config.provider_name, "ClawCode");
        assert_eq!(config.max_tokens, 4096);
        assert_eq!(config.temperature, 0.7);
    }

    #[test]
    fn test_config_new() {
        let config = ClawCodeConfig::new(
            "TestProvider",
            "test-key",
            "https://api.test.com/v1",
            "test-model",
        );
        assert_eq!(config.provider_name, "TestProvider");
        assert_eq!(config.api_key, "test-key");
        assert_eq!(config.base_url, "https://api.test.com/v1");
        assert_eq!(config.model, "test-model");
    }

    #[test]
    fn test_config_with_options() {
        let config = ClawCodeConfig::new("Test", "key", "url", "model")
            .with_max_tokens(8192)
            .with_temperature(0.5);
        assert_eq!(config.max_tokens, 8192);
        assert_eq!(config.temperature, 0.5);
    }

    #[test]
    fn test_engine_new() {
        let engine = ClawCodeEngine::new();
        assert!(!engine.is_available());
        assert_eq!(engine.name(), "ClawCode");
    }

    #[test]
    fn test_engine_with_config() {
        let config = ClawCodeConfig::new("Test", "key", "url", "model");
        let engine = ClawCodeEngine::with_config(config);
        assert!(engine.is_available());
        assert_eq!(engine.name(), "ClawCode");
    }

    #[test]
    fn test_engine_set_config() {
        let mut engine = ClawCodeEngine::new();
        assert!(!engine.is_available());

        let config = ClawCodeConfig::new("Test", "key", "url", "model");
        engine.set_config(config);
        assert!(engine.is_available());
    }

    #[test]
    fn test_engine_id() {
        let engine = ClawCodeEngine::new();
        let id = engine.id();
        assert!(matches!(id, EngineId::OpenAI { provider_id: Some(p) } if p == "claw-code"));
    }

    #[test]
    fn test_build_request() {
        let config = ClawCodeConfig::new("Test", "key", "url", "gpt-4")
            .with_max_tokens(1000);
        let engine = ClawCodeEngine::with_config(config);

        let messages = vec![InputMessage::user_text("Hello")];
        let request = engine.build_request(messages, Some("Be helpful"));

        assert_eq!(request.model, "gpt-4");
        assert_eq!(request.max_tokens, 1000);
        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.system, Some("Be helpful".to_string()));
        assert!(request.stream);
    }
}