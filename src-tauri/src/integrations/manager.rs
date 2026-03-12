/**
 * 集成管理器
 *
 * 统一管理所有平台集成，提供消息路由和状态管理。
 */

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tauri::{AppHandle, Emitter};

use super::common::SessionManager;
use super::qqbot::QQBotAdapter;
use super::traits::PlatformIntegration;
use super::types::*;
use crate::error::Result;
use crate::models::config::QQBotConfig;

/// 集成管理器
pub struct IntegrationManager {
    /// 消息接收通道
    message_rx: Option<mpsc::Receiver<IntegrationMessage>>,
    /// 消息发送通道
    message_tx: Option<mpsc::Sender<IntegrationMessage>>,
    /// 平台适配器
    adapters: HashMap<Platform, Box<dyn PlatformIntegration>>,
    /// 会话管理
    sessions: SessionManager,
    /// App Handle (用于发送事件到前端)
    app_handle: Option<AppHandle>,
    /// 运行状态
    running: bool,
}

impl IntegrationManager {
    /// 创建新的集成管理器
    pub fn new() -> Self {
        Self {
            message_rx: None,
            message_tx: None,
            adapters: HashMap::new(),
            sessions: SessionManager::new(),
            app_handle: None,
            running: false,
        }
    }

    /// 初始化
    pub fn init(&mut self, qqbot_config: Option<QQBotConfig>, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);

        // 创建消息通道
        let (tx, rx) = mpsc::channel(100);
        self.message_tx = Some(tx);
        self.message_rx = Some(rx);

        // 初始化 QQ Bot
        if let Some(config) = qqbot_config {
            if config.enabled && !config.app_id.is_empty() && !config.client_secret.is_empty() {
                let adapter = QQBotAdapter::new(config);
                self.adapters.insert(Platform::QQBot, Box::new(adapter));
                tracing::info!("[IntegrationManager] QQBot adapter registered");
            }
        }
    }

    /// 启动指定平台
    pub async fn start(&mut self, platform: Platform) -> Result<()> {
        let tx = self.message_tx.as_ref()
            .ok_or_else(|| crate::error::AppError::StateError("消息通道未初始化".to_string()))?
            .clone();

        if let Some(adapter) = self.adapters.get_mut(&platform) {
            adapter.connect(tx).await?;
            tracing::info!("[IntegrationManager] {} started", platform);
        } else {
            return Err(crate::error::AppError::ValidationError(format!(
                "平台 {} 未注册",
                platform
            )));
        }

        Ok(())
    }

    /// 停止指定平台
    pub async fn stop(&mut self, platform: Platform) -> Result<()> {
        if let Some(adapter) = self.adapters.get_mut(&platform) {
            adapter.disconnect().await?;
            tracing::info!("[IntegrationManager] {} stopped", platform);
        }
        Ok(())
    }

    /// 启动所有平台
    pub async fn start_all(&mut self) -> Result<()> {
        let platforms: Vec<Platform> = self.adapters.keys().copied().collect();

        for platform in platforms {
            if let Err(e) = self.start(platform).await {
                tracing::error!("[IntegrationManager] Failed to start {}: {:?}", platform, e);
            }
        }

        self.running = true;
        Ok(())
    }

    /// 停止所有平台
    pub async fn stop_all(&mut self) -> Result<()> {
        let platforms: Vec<Platform> = self.adapters.keys().copied().collect();

        for platform in platforms {
            let _ = self.stop(platform).await;
        }

        self.running = false;
        Ok(())
    }

    /// 发送消息
    pub async fn send(
        &self,
        platform: Platform,
        target: SendTarget,
        content: MessageContent,
    ) -> Result<()> {
        if let Some(adapter) = self.adapters.get(&platform) {
            adapter.send(target, content).await
        } else {
            Err(crate::error::AppError::ValidationError(format!(
                "平台 {} 未注册",
                platform
            )))
        }
    }

    /// 获取平台状态
    pub fn status(&self, platform: Platform) -> Option<IntegrationStatus> {
        self.adapters.get(&platform).map(|a| a.status())
    }

    /// 获取所有状态
    pub fn all_status(&self) -> HashMap<Platform, IntegrationStatus> {
        self.adapters
            .iter()
            .map(|(p, a)| (*p, a.status()))
            .collect()
    }

    /// 处理消息 (从通道读取并转发到前端)
    ///
    /// 此方法应该在单独的任务中运行
    pub async fn process_messages(&mut self) {
        if let Some(rx) = &mut self.message_rx {
            while let Some(msg) = rx.recv().await {
                // 更新会话
                self.sessions.update(&msg.conversation_id);

                // 发送到前端
                if let Some(ref app_handle) = self.app_handle {
                    if let Err(e) = app_handle.emit("integration:message", &msg) {
                        tracing::error!("[IntegrationManager] Failed to emit message: {}", e);
                    }
                }

                tracing::debug!(
                    "[IntegrationManager] Message received: {} from {}",
                    msg.id,
                    msg.platform
                );
            }
        }
    }

    /// 是否正在运行
    pub fn is_running(&self) -> bool {
        self.running
    }

    /// 获取会话列表
    pub fn sessions(&self) -> Vec<&IntegrationSession> {
        self.sessions.all()
    }

    /// 注册平台
    pub fn register(&mut self, platform: Platform, adapter: Box<dyn PlatformIntegration>) {
        self.adapters.insert(platform, adapter);
    }
}

impl Default for IntegrationManager {
    fn default() -> Self {
        Self::new()
    }
}