# AI 引擎架构交接文档

> 创建时间: 2026-03-13
> 作者: Claude Opus 4.6

## 一、已完成工作

### 1. 统一 AI 引擎架构

在 `src-tauri/src/ai/` 目录下创建了统一引擎架构：

```
src-tauri/src/ai/
├── mod.rs           # 模块入口，导出所有公共接口
├── traits.rs        # AIEngine trait 和 EngineId 定义
├── types.rs         # 公共类型 (EngineStatus, EngineDescriptor, extract_text_from_event)
├── session.rs       # SessionManager 会话管理器
├── registry.rs      # EngineRegistry 引擎注册表
└── engine/
    ├── mod.rs
    ├── claude.rs    # Claude Code CLI 引擎
    ├── iflow.rs     # IFlow CLI 引擎
    └── codex.rs     # Codex CLI 引擎
```

### 2. 核心接口设计

#### AIEngine Trait (`traits.rs`)

```rust
pub trait AIEngine: Send + Sync {
    fn id(&self) -> EngineId;
    fn name(&self) -> &'static str;
    fn is_available(&self) -> bool;

    fn start_session(&mut self, message: &str, options: SessionOptions) -> Result<String>;
    fn continue_session(&mut self, session_id: &str, message: &str, options: SessionOptions) -> Result<()>;
    fn interrupt(&mut self, session_id: &str) -> Result<()>;
}
```

#### SessionOptions (关键：使用回调替代 Window)

```rust
pub struct SessionOptions {
    pub work_dir: Option<String>,
    pub system_prompt: Option<String>,
    pub event_callback: Arc<dyn Fn(StreamEvent) + Send + Sync>,  // 核心设计
    pub on_complete: Option<Arc<dyn Fn(i32) + Send + Sync>>,
    pub on_error: Option<Arc<dyn Fn(String) + Send + Sync>>,
}
```

### 3. 已实现的引擎

| 引擎 | 文件 | 特点 |
|------|------|------|
| ClaudeEngine | `engine/claude.rs` | Windows 下通过 Node.js 调用 cli.js |
| IFlowEngine | `engine/iflow.rs` | 通过监控 JSONL 文件获取事件 |
| CodexEngine | `engine/codex.rs` | 直接调用 CLI，解析 JSONL 输出 |

### 4. AppState 集成

```rust
pub struct AppState {
    // ... 其他字段 ...
    pub engine_registry: AsyncMutex<EngineRegistry>,  // 新增
}
```

应用启动时自动注册所有引擎：

```rust
let mut engine_registry = EngineRegistry::new();
engine_registry.register(ai::ClaudeEngine::new(config.clone()));
engine_registry.register(ai::IFlowEngine::new(config.clone()));
engine_registry.register(ai::CodexEngine::new(config.clone()));
```

---

## 二、待完成工作

### 1. 【重要】OpenAI Provider 引擎集成

**现状分析**：

目前存在两个 OpenAI 相关实现：

| 位置 | 实现方式 | 状态 |
|------|---------|------|
| 后端 `services/openai_proxy.rs` | HTTP API 调用，依赖 Window | 未迁移 |
| 前端 `src/engines/openai-provider/` | 前端 TypeScript 实现 | 独立运行 |

**建议方案**：

创建 `OpenAIEngine` 实现 `AIEngine` trait：

```rust
// src-tauri/src/ai/engine/openai.rs

pub struct OpenAIEngine {
    client: reqwest::Client,
    config: OpenAIProviderConfig,
    sessions: SessionManager,
}

impl AIEngine for OpenAIEngine {
    fn id(&self) -> EngineId { EngineId::OpenAI }

    fn start_session(&mut self, message: &str, options: SessionOptions) -> Result<String> {
        // 通过 HTTP API 调用 OpenAI 兼容 API
        // 使用 options.event_callback 发送流式事件
    }
}
```

**关键差异**：
- CLI 引擎：spawn 进程，读取 stdout
- OpenAI 引擎：HTTP 请求，解析 SSE 流

### 2. 简化 chat.rs

当前 `commands/chat.rs` 仍有大量旧代码，需要重构为使用 `EngineRegistry`：

```rust
// 目标实现
#[tauri::command]
pub async fn start_chat(
    message: String,
    window: Window,
    state: State<'_, AppState>,
    // ...
) -> Result<String> {
    let mut registry = state.engine_registry.lock().await;

    let event_callback = Arc::new(move |event: StreamEvent| {
        // 发送到前端
        let _ = window.emit("chat-event", ...);
    });

    let options = SessionOptions::new(event_callback)
        .with_work_dir(...)
        .with_system_prompt(...);

    registry.start_session(None, &message, options)
}
```

### 3. QQ Bot 消息处理集成

在 `integrations/processor/` 中创建消息处理器，使用 `EngineRegistry`：

```rust
// src-tauri/src/integrations/processor/message.rs

pub struct MessageProcessor {
    engine_registry: Arc<AsyncMutex<EngineRegistry>>,
}

impl MessageProcessor {
    pub async fn process(&self, message: IntegrationMessage) -> Result<()> {
        let mut registry = self.engine_registry.lock().await;

        let adapter = self.qq_adapter.clone();
        let conversation_id = message.conversation_id.clone();

        let event_callback = Arc::new(move |event: StreamEvent| {
            if let Some(text) = extract_text_from_event(&event) {
                // 发送到 QQ
                let _ = adapter.send(SendTarget::Conversation(conversation_id.clone()), ...);
            }
        });

        registry.start_session(None, content, options).await
    }
}
```

### 4. 清理旧代码

完成迁移后可删除：
- `services/iflow_service.rs` (功能已迁移到 `ai/engine/iflow.rs`)
- `services/codex_service.rs` (功能已迁移到 `ai/engine/codex.rs`)
- `commands/chat.rs` 中的旧引擎启动逻辑

---

## 三、架构对比

### 迁移前

```
commands/chat.rs
├── start_chat() → 根据引擎 ID 分发
│   ├── start_claude_chat() → ChatSession::start() → Window.emit()
│   ├── start_iflow_chat_internal() → IFlowService → Window.emit()
│   └── start_codex_chat_internal() → CodexService → Window.emit()
└── 强依赖 Window 参数，无法被其他模块复用
```

### 迁移后

```
EngineRegistry
├── ClaudeEngine → event_callback(StreamEvent)
├── IFlowEngine → event_callback(StreamEvent)
├── CodexEngine → event_callback(StreamEvent)
└── OpenAIEngine (待实现) → event_callback(StreamEvent)

使用方：
├── commands/chat.rs → event_callback = window.emit()
├── integrations/processor → event_callback = qq_adapter.send()
└── 任何需要调用 AI 的模块
```

---

## 四、使用示例

### 前端调用

```typescript
// 通过 Tauri command
await invoke('start_chat', {
  message: '你好',
  engineId: 'claude',
  workDir: '/path/to/workspace'
});
```

### 后端内部调用（如 QQ Bot）

```rust
let registry = state.engine_registry.lock().await;

let callback = Arc::new(|event: StreamEvent| {
    // 处理事件
});

let options = SessionOptions::new(callback);
let session_id = registry.start_session(None, "你好", options)?;
```

---

## 五、注意事项

1. **线程安全**：`SessionManager` 使用 `Arc<Mutex<HashMap>>` 支持跨线程共享
2. **进程管理**：各引擎内部管理进程 PID，支持 `interrupt()` 中断
3. **Session ID 映射**：引擎会自动更新临时 ID 到真实 Session ID
4. **错误处理**：所有错误通过 `AppError` 统一返回

---

## 六、后续优化建议

1. **配置热更新**：支持运行时切换引擎配置
2. **会话持久化**：将 `SessionManager` 的数据持久化到文件
3. **并发限制**：限制同时运行的会话数量
4. **指标收集**：收集 Token 使用量、响应时间等指标
5. **前端 Engine 迁移**：考虑将前端 `src/engines/` 也统一到后端
