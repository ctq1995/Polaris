# 定时任务会话自动创建修复 Bugfix Design

## Overview

本设计文档针对定时任务系统中的两个用户体验问题提供技术解决方案：

1. **问题1 - 自动创建会话标签页**：当定时任务执行时，`sessionStoreManager.dispatchEvent()` 会自动创建会话标签页，干扰用户工作流
2. **问题2 - 缺少完成状态标识**：定时任务执行完成后，用户在任务列表中看不到明显的完成标识

修复策略采用"静默执行 + 按需显示"的设计理念：
- 定时任务默认在后台静默执行，不创建UI标签页
- 用户点击"查询日志"时才创建会话标签页
- 任务完成后在列表中显示明确的完成状态

## Glossary

- **Bug_Condition (C)**: 触发bug的条件 - 定时任务执行时自动创建会话标签页，或任务完成后缺少完成标识
- **Property (P)**: 期望的正确行为 - 定时任务静默执行不创建标签页，点击"查询日志"才创建标签页，完成后显示完成标识
- **Preservation**: 必须保持不变的现有行为 - 事件路由正确性、日志订阅功能、多任务并行隔离
- **sessionStoreManager**: `src/stores/conversationStore/sessionStoreManager.ts` 中的会话管理器，负责创建和管理会话
- **dispatchEvent**: sessionStoreManager 中的方法，负责将事件路由到对应的会话，当会话不存在时会自动创建
- **contextId**: 事件路由的上下文标识符，格式为 `scheduler-{taskId}`，用于区分不同任务的事件流
- **silentMode**: 新增的静默模式标志，用于标识会话是否应该在后台静默运行，不显示在标签栏
- **TaskStatus**: 任务运行状态，包括 'running'、'success'、'failed'、'idle'
- **lastRunAt**: 任务最后一次执行的时间戳
- **lastRunStatus**: 任务最后一次执行的状态结果

## Bug Details

### Bug Condition

Bug 1 在以下情况下触发：当定时任务执行或用户点击"执行任务"按钮时，`sessionStoreManager.dispatchEvent()` 检测到会话不存在，自动调用 `createSession()` 创建新会话，导致标签栏立即显示新标签页。

Bug 2 在以下情况下触发：当定时任务执行完成后，`schedulerStore` 仅更新 `lastRunStatus` 为 'success' 或 'failed'，但 UI 组件（TaskCard）没有显示明确的完成标识。

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type { event: AIEvent, contextId: string }
  OUTPUT: boolean
  
  RETURN input.contextId STARTS_WITH 'scheduler-'
         AND NOT sessionExists(extractSessionId(input.contextId))
         AND input.event.type IN ['session_start', 'message', 'tool_call', ...]
         AND sessionAutoCreated(input.contextId)
END FUNCTION

FUNCTION isBugCondition2(input)
  INPUT: input of type { taskId: string, event: AIEvent }
  OUTPUT: boolean
  
  RETURN input.event.type == 'session_end'
         AND input.event.reason IN ['success', 'completed']
         AND NOT hasCompletionIndicator(input.taskId)
END FUNCTION
```

### Examples

**Bug 1 示例：**
- 用户正在编辑代码，定时任务在后台触发
- 系统收到 `scheduler-task-123` 的 `session_start` 事件
- `dispatchEvent()` 发现会话不存在，自动创建会话
- 标签栏突然出现新标签页，打断用户工作流
- 预期：任务应该静默执行，不创建标签页

**Bug 2 示例：**
- 用户创建了一个每小时执行的定时任务
- 任务在后台执行完成，状态更新为 'success'
- 用户查看任务列表，只能看到状态徽章显示"成功"
- 无法快速识别任务是否刚刚完成，或者是很久之前完成的
- 预期：应该显示"完成于 2分钟前"或完成时间戳

**Edge Case：**
- 用户点击"查询日志"订阅正在运行的任务 - 应该正常创建会话标签页（不是bug）
- 多个定时任务同时执行 - 每个任务都应该静默执行，不创建标签页

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 用户点击"查询日志"按钮订阅任务时，必须继续正常创建会话标签页并显示实时日志
- 定时任务执行过程中产生的事件必须继续正确路由到对应的会话存储
- 定时任务执行失败时必须继续正确更新任务状态为 'failed'
- 多个定时任务并行执行时必须继续正确隔离各个任务的会话和事件
- 用户切换活跃会话时必须继续正确同步当前活跃会话的事件到旧架构（EventChatStore）

**Scope:**
所有不涉及定时任务自动执行的场景都应该完全不受影响。这包括：
- 用户手动在聊天界面发起对话
- 用户通过其他方式创建会话（如从历史记录恢复）
- Git commit 等其他 contextId 的事件路由
- 现有的会话切换、删除、后台运行等功能

## Hypothesized Root Cause

基于代码分析，最可能的根本原因是：

1. **自动创建逻辑过于激进（Bug 1）**: `sessionStoreManager.dispatchEvent()` 在第 273-283 行实现了自动创建会话的逻辑：
   ```typescript
   if (!store) {
     console.log('[SessionStoreManager] 事件路由时自动创建会话:', routeSessionId)
     get().createSession({
       id: routeSessionId,
       type: 'free',
       title: '新对话',
     })
   }
   ```
   这个逻辑没有区分"用户主动操作"和"后台任务"，导致所有事件都会触发会话创建。

2. **缺少静默模式标志**: `createSession()` 方法和 `SessionMetadata` 类型没有"静默模式"或"隐藏"标志，无法标识某个会话不应该显示在标签栏。

3. **UI 组件缺少完成时间显示（Bug 2）**: `TaskCard.tsx` 组件只显示 `lastRunStatus` 徽章，没有显示 `lastRunAt` 时间戳或相对时间。

4. **schedulerStore 没有持久化完成时间**: 虽然 `ScheduledTask` 类型定义了 `lastRunAt` 字段，但在任务完成时可能没有正确更新这个字段。

## Correctness Properties

Property 1: Bug Condition 1 - 定时任务静默执行

_For any_ 定时任务执行事件（contextId 以 'scheduler-' 开头），当会话不存在时，修复后的 dispatchEvent 函数 SHALL 创建一个静默会话（silentMode = true），该会话不显示在标签栏，但能正常接收和处理事件。

**Validates: Requirements 2.1**

Property 2: Bug Condition 2 - 点击查询日志创建可见会话

_For any_ 用户点击"查询日志"按钮的操作，修复后的 subscribeToEvents 函数 SHALL 将静默会话转换为可见会话（silentMode = false），并切换到该会话标签页，显示实时日志。

**Validates: Requirements 2.2**

Property 3: Bug Condition 3 - 显示完成状态标识

_For any_ 定时任务执行完成事件（session_end），修复后的系统 SHALL 更新任务的 lastRunAt 时间戳和 lastRunStatus 状态，并在 TaskCard 组件中显示完成时间（如"完成于 2分钟前"）。

**Validates: Requirements 2.3**

Property 4: Preservation - 查询日志功能不变

_For any_ 用户点击"查询日志"订阅正在运行的任务，修复后的代码 SHALL 产生与原始代码完全相同的行为，正确创建会话标签页并显示实时日志。

**Validates: Requirements 3.1**

Property 5: Preservation - 事件路由正确性

_For any_ 定时任务产生的事件，修复后的代码 SHALL 产生与原始代码完全相同的路由行为，确保事件正确到达对应的会话存储，不影响事件处理逻辑。

**Validates: Requirements 3.2, 3.4**

Property 6: Preservation - 失败状态更新

_For any_ 定时任务执行失败的情况，修复后的代码 SHALL 产生与原始代码完全相同的行为，正确更新任务状态为 'failed'。

**Validates: Requirements 3.3**

Property 7: Preservation - 会话同步机制

_For any_ 用户切换活跃会话的操作，修复后的代码 SHALL 产生与原始代码完全相同的行为，正确同步当前活跃会话的事件到旧架构（EventChatStore）。

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

修复方案采用"最小侵入性"原则，在现有架构基础上添加静默模式支持。

#### 修改 1: 扩展 SessionMetadata 类型

**File**: `src/stores/conversationStore/types.ts`

**Specific Changes**:
1. **添加 silentMode 字段**: 在 `SessionMetadata` 接口中添加可选的 `silentMode?: boolean` 字段
   ```typescript
   export interface SessionMetadata {
     id: string
     title: string
     type: 'free' | 'project'
     workspaceId: string | null
     workspaceName?: string
     contextWorkspaceIds: string[]
     status: 'idle' | 'running' | 'error' | 'background-running'
     silentMode?: boolean  // 新增：静默模式标志
     createdAt: string
     updatedAt: string
   }
   ```

2. **添加 silentMode 到 CreateSessionOptions**: 允许创建会话时指定静默模式
   ```typescript
   export interface CreateSessionOptions {
     id?: string
     type: 'free' | 'project'
     title?: string
     workspaceId?: string
     silentMode?: boolean  // 新增
   }
   ```

#### 修改 2: 修改 sessionStoreManager.dispatchEvent()

**File**: `src/stores/conversationStore/sessionStoreManager.ts`

**Function**: `dispatchEvent`

**Specific Changes**:
1. **检测 scheduler contextId**: 在自动创建会话前，检查 routeSessionId 是否来自 scheduler
   ```typescript
   // 如果会话不存在，自动创建
   if (!store) {
     // 检测是否为 scheduler 任务（静默模式）
     const isSchedulerTask = routeSessionId.startsWith('scheduler-')
     
     console.log('[SessionStoreManager] 事件路由时自动创建会话:', routeSessionId, 
                 isSchedulerTask ? '(静默模式)' : '')
     
     get().createSession({
       id: routeSessionId,
       type: 'free',
       title: isSchedulerTask ? '定时任务' : '新对话',
       silentMode: isSchedulerTask,  // scheduler 任务使用静默模式
     })
     
     store = get().stores.get(routeSessionId)
     // ...
   }
   ```

2. **不切换到静默会话**: 修改 `createSession()` 方法，静默会话不自动激活
   ```typescript
   createSession: (options: CreateSessionOptions) => {
     // ... 现有逻辑 ...
     
     set((state) => {
       const newStores = new Map(state.stores)
       newStores.set(sessionId, conversationStore)

       const newMetadata = new Map(state.sessionMetadata)
       newMetadata.set(sessionId, metadata)

       return {
         stores: newStores,
         sessionMetadata: newMetadata,
         // 静默会话不自动激活
         activeSessionId: options.silentMode ? state.activeSessionId : sessionId,
       }
     })
     // ...
   }
   ```

#### 修改 3: 添加 makeSessionVisible() 方法

**File**: `src/stores/conversationStore/sessionStoreManager.ts`

**Specific Changes**:
1. **新增方法**: 在 SessionManagerStore 接口中添加 `makeSessionVisible` 方法
   ```typescript
   /**
    * 将静默会话转换为可见会话
    * 用于用户点击"查询日志"时显示会话标签页
    */
   makeSessionVisible: (sessionId: string) => {
     const metadata = get().sessionMetadata.get(sessionId)
     if (!metadata) {
       console.warn('[SessionStoreManager] 会话不存在:', sessionId)
       return
     }

     // 如果已经是可见会话，直接切换
     if (!metadata.silentMode) {
       get().switchSession(sessionId)
       return
     }

     // 更新元数据，移除静默模式标志
     set((state) => {
       const newMetadata = new Map(state.sessionMetadata)
       newMetadata.set(sessionId, {
         ...metadata,
         silentMode: false,
         updatedAt: new Date().toISOString(),
       })
       return { sessionMetadata: newMetadata }
     })

     // 切换到该会话
     get().switchSession(sessionId)

     console.log('[SessionStoreManager] 会话已转为可见:', sessionId)
   }
   ```

#### 修改 4: 修改 schedulerStore.subscribeToEvents()

**File**: `src/stores/schedulerStore.ts`

**Function**: `subscribeToEvents`

**Specific Changes**:
1. **调用 makeSessionVisible**: 在订阅事件前，将静默会话转换为可见会话
   ```typescript
   subscribeToEvents: async (taskId) => {
     const store = get();

     // 如果已经订阅，不重复订阅
     if (store.subscribedTaskIds.has(taskId)) {
       console.log('[Scheduler] 任务已订阅，跳过:', taskId);
       return;
     }

     // 将静默会话转换为可见会话（如果存在）
     const sessionId = `scheduler-${taskId}`
     sessionStoreManager.getState().makeSessionVisible(sessionId)

     const router = getEventRouter();
     await router.initialize();
     // ... 现有订阅逻辑 ...
   }
   ```

#### 修改 5: 过滤标签栏中的静默会话

**File**: `src/components/SessionTabs/SessionTabs.tsx` (或相关的标签栏组件)

**Specific Changes**:
1. **过滤静默会话**: 在渲染标签列表时，过滤掉 `silentMode === true` 的会话
   ```typescript
   const visibleSessions = Array.from(sessionMetadata.values())
     .filter(metadata => !metadata.silentMode)  // 过滤静默会话
     .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
   ```

#### 修改 6: 更新任务完成时间

**File**: `src/stores/schedulerStore.ts`

**Function**: Event handler in `subscribeToEvents`

**Specific Changes**:
1. **更新 lastRunAt 字段**: 在处理 `session_end` 事件时，更新任务的 `lastRunAt` 时间戳
   ```typescript
   // 处理会话结束
   if (event.type === 'session_end') {
     const reason = event.reason as string | undefined;
     const finalStatus = (reason === 'error' || reason === 'failed') ? 'failed' : 'success'
     
     await get().updateRunStatus(taskId, finalStatus);
     
     // 更新完成时间
     set((state) => {
       const tasks = state.tasks.map(task => 
         task.id === taskId 
           ? { ...task, lastRunAt: new Date().toISOString() }
           : task
       )
       return { tasks }
     })
     
     // 清理订阅
     eventSubscriptions.delete(taskId);
     // ...
   }
   ```

2. **同步更新到持久化存储**: 确保 `lastRunAt` 字段被保存到 Tauri 后端
   ```typescript
   // 在 updateRunStatus 方法中添加
   updateRunStatus: async (taskId, status) => {
     set((state) => {
       const tasks = state.tasks.map((task) =>
         task.id === taskId
           ? { 
               ...task, 
               lastRunStatus: status,
               lastRunAt: new Date().toISOString()  // 同步更新
             }
           : task
       );
       return { tasks };
     });

     // 持久化到后端
     const task = get().tasks.find((t) => t.id === taskId);
     if (task) {
       await tauri.schedulerUpdateTask(task);
     }
   }
   ```

#### 修改 7: 在 TaskCard 中显示完成时间

**File**: `src/components/Scheduler/TaskCard.tsx`

**Specific Changes**:
1. **添加完成时间显示**: 在状态徽章旁边显示完成时间
   ```typescript
   {/* 右侧状态 */}
   <div className="flex items-center gap-3">
     <StatusBadge status={task.lastRunStatus} isRunning={isRunning} />
     
     {/* 显示完成时间 */}
     {task.lastRunAt && task.lastRunStatus && !isRunning && (
       <span className="text-xs text-text-muted">
         {t('card.completedAt')}: {formatRelativeTime(task.lastRunAt)}
       </span>
     )}
     
     {showNextRun && (
       <span className="text-xs text-text-muted">
         {t('card.nextRun')}: {formatRelativeTime(task.nextRunAt)}
       </span>
     )}
   </div>
   ```

2. **添加完成图标（可选）**: 在任务名称旁边添加完成图标
   ```typescript
   <div className="flex items-start gap-3">
     {/* 状态指示点 */}
     <span className={`w-2 h-2 rounded-full mt-2 ${
       isRunning
         ? 'bg-info animate-pulse'
         : isEnabled
           ? 'bg-success'
           : 'bg-text-muted'
     }`} />
     
     <div className="flex-1">
       <div className="flex items-center gap-2">
         <h3 className="font-medium text-text-primary">{task.name}</h3>
         
         {/* 完成图标 */}
         {task.lastRunStatus === 'success' && !isRunning && (
           <span className="text-success text-sm" title={t('card.lastRunSuccess')}>
             ✓
           </span>
         )}
         {task.lastRunStatus === 'failed' && !isRunning && (
           <span className="text-danger text-sm" title={t('card.lastRunFailed')}>
             ✗
           </span>
         )}
       </div>
       
       {task.description && (
         <p className="text-sm text-text-muted mt-0.5">{task.description}</p>
       )}
     </div>
   </div>
   ```

#### 修改 8: 添加国际化文本

**File**: `src/locales/zh-CN/scheduler.json` 和 `src/locales/en/scheduler.json`

**Specific Changes**:
1. **添加完成时间相关文本**:
   ```json
   {
     "card": {
       "completedAt": "完成于",
       "lastRunSuccess": "上次执行成功",
       "lastRunFailed": "上次执行失败"
     }
   }
   ```

## Testing Strategy

### Validation Approach

测试策略遵循两阶段方法：首先在未修复的代码上运行测试以确认bug存在，然后在修复后的代码上验证修复效果和保持不变的行为。

### Exploratory Bug Condition Checking

**Goal**: 在实施修复前，在未修复的代码上演示bug。确认或反驳根本原因分析。如果反驳，需要重新假设。

**Test Plan**: 编写测试模拟定时任务执行和完成场景，在未修复的代码上运行以观察失败并理解根本原因。

**Test Cases**:
1. **自动创建会话测试（Bug 1）**: 模拟定时任务触发，发送 `scheduler-task-123` 的 `session_start` 事件，观察是否自动创建会话标签页（在未修复代码上会失败 - 会创建标签页）
2. **缺少完成时间测试（Bug 2）**: 模拟任务执行完成，发送 `session_end` 事件，检查 TaskCard 是否显示完成时间（在未修复代码上会失败 - 不显示完成时间）
3. **查询日志测试**: 模拟用户点击"查询日志"按钮，观察是否正确创建会话标签页（在未修复代码上应该通过）
4. **多任务并行测试**: 模拟多个定时任务同时执行，观察会话隔离是否正确（在未修复代码上应该通过）

**Expected Counterexamples**:
- Bug 1: 定时任务执行时会自动创建会话标签页，显示在标签栏
- Bug 2: 任务完成后只显示状态徽章，不显示完成时间
- 可能的原因：dispatchEvent 自动创建逻辑过于激进，TaskCard 缺少完成时间显示

### Fix Checking

**Goal**: 验证对于所有触发bug条件的输入，修复后的函数产生预期的行为。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition1(input) DO
  result := dispatchEvent_fixed(input)
  ASSERT result.sessionCreated == true
  ASSERT result.session.silentMode == true
  ASSERT result.session NOT IN visibleTabs
END FOR

FOR ALL input WHERE isBugCondition2(input) DO
  result := handleSessionEnd_fixed(input)
  ASSERT result.task.lastRunAt IS NOT NULL
  ASSERT result.task.lastRunStatus IN ['success', 'failed']
  ASSERT taskCardShowsCompletionTime(result.task) == true
END FOR
```

### Preservation Checking

**Goal**: 验证对于所有不触发bug条件的输入，修复后的函数产生与原始函数相同的结果。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition1(input) AND NOT isBugCondition2(input) DO
  ASSERT dispatchEvent_original(input) == dispatchEvent_fixed(input)
  ASSERT subscribeToEvents_original(input) == subscribeToEvents_fixed(input)
END FOR
```

**Testing Approach**: 推荐使用基于属性的测试进行保持检查，因为：
- 它自动生成许多跨输入域的测试用例
- 它捕获手动单元测试可能遗漏的边缘情况
- 它为所有非bug输入提供强有力的保证，确保行为不变

**Test Plan**: 首先在未修复的代码上观察非bug输入的行为，然后编写基于属性的测试捕获该行为。

**Test Cases**:
1. **查询日志保持测试**: 观察未修复代码上点击"查询日志"的行为，然后编写测试验证修复后继续工作
2. **事件路由保持测试**: 观察未修复代码上事件路由到正确会话的行为，然后编写测试验证修复后继续工作
3. **失败状态保持测试**: 观察未修复代码上任务失败时的状态更新，然后编写测试验证修复后继续工作
4. **会话切换保持测试**: 观察未修复代码上切换会话时的同步行为，然后编写测试验证修复后继续工作

### Unit Tests

- 测试 `dispatchEvent()` 对 scheduler contextId 创建静默会话
- 测试 `dispatchEvent()` 对非 scheduler contextId 创建可见会话
- 测试 `makeSessionVisible()` 将静默会话转换为可见会话
- 测试 `subscribeToEvents()` 调用 `makeSessionVisible()`
- 测试标签栏过滤静默会话
- 测试 `updateRunStatus()` 更新 `lastRunAt` 字段
- 测试 TaskCard 显示完成时间和图标

### Property-Based Tests

- 生成随机的 scheduler 事件，验证所有 scheduler 事件都创建静默会话
- 生成随机的非 scheduler 事件，验证所有非 scheduler 事件都创建可见会话
- 生成随机的任务完成事件，验证所有完成事件都更新 `lastRunAt` 字段
- 生成随机的会话切换操作，验证静默会话不影响会话切换逻辑

### Integration Tests

- 测试完整的定时任务执行流程：触发 → 静默执行 → 完成 → 显示完成时间
- 测试完整的查询日志流程：点击按钮 → 转换为可见会话 → 显示标签页 → 显示日志
- 测试多任务并行执行：多个任务同时执行 → 各自静默运行 → 互不干扰
- 测试任务失败场景：任务执行失败 → 更新失败状态 → 显示失败图标和时间
