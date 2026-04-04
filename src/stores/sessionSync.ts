/**
 * 会话消息同步模块
 *
 * 负责 SessionStore 和 EventChatStore 之间的消息同步
 *
 * 设计说明：
 * - EventChatStore 作为"活跃消息缓存"，UI 组件从这里读取消息
 * - SessionStore.sessionMessages 作为"持久化存储"，每个会话的消息独立保存
 * - 会话切换时通过此模块同步消息
 *
 * 同步流程：
 * 1. 切换会话前：保存当前 EventChatStore 消息到 SessionStore
 * 2. 切换会话后：加载目标会话消息到 EventChatStore
 */

import { useEventChatStore } from './eventChatStore'
import { useSessionStore, getSessionEffectiveWorkspace } from './sessionStore'
import { useWorkspaceStore } from './workspaceStore'
import type { ChatMessage } from '../types'
import type { CreateSessionOptions } from '../types/session'
import { createLogger } from '../utils/logger'

const log = createLogger('SessionSync')

/**
 * 保存当前会话的消息状态到 SessionStore
 *
 * @param sessionId 要保存的会话 ID
 */
export function saveCurrentMessagesToSession(sessionId: string): void {
  const eventChatState = useEventChatStore.getState()
  const sessionSyncActions = eventChatState.getSessionSyncActions()

  if (!sessionSyncActions) {
    log.warn('SessionSyncActions 未注入，无法保存消息')
    return
  }

  // 获取当前消息状态
  const { messages, archivedMessages, conversationId } = eventChatState

  // 保存到 SessionStore
  sessionSyncActions.setSessionMessages(sessionId, {
    messages,
    archivedMessages,
    conversationId,
  })

  log.debug('保存会话消息', {
    sessionId,
    messageCount: messages.length,
    archivedCount: archivedMessages.length,
    conversationId,
  })
}

/**
 * 加载目标会话的消息状态到 EventChatStore
 *
 * @param sessionId 要加载的会话 ID
 * @param skipStreamingCheck 是否跳过流式传输检查（后台切换时使用）
 * @returns 是否成功加载
 */
export async function loadSessionMessagesToEventChat(sessionId: string, skipStreamingCheck = false): Promise<boolean> {
  const eventChatState = useEventChatStore.getState()
  const sessionSyncActions = eventChatState.getSessionSyncActions()

  if (!sessionSyncActions) {
    log.warn('SessionSyncActions 未注入，无法加载消息')
    return false
  }

  // 检查是否正在流式传输（除非显式跳过）
  if (!skipStreamingCheck && eventChatState.isStreaming) {
    log.warn('当前正在流式传输，无法切换会话')
    return false
  }

  // 从 SessionStore 获取消息状态
  const sessionMessages = sessionSyncActions.getSessionMessages(sessionId)

  if (!sessionMessages || sessionMessages.messages.length === 0) {
    // 没有保存的消息，初始化为空状态
    log.debug('会话无保存消息，初始化为空', { sessionId })

    // 清空 EventChatStore（保留事件监听器）
    clearEventChatState()

    // 更新会话状态为 idle
    sessionSyncActions.updateSessionStatus(sessionId, 'idle')

    return true
  }

  // 清空当前状态（保留事件监听器）
  clearEventChatState()

  // 加载会话消息到 EventChatStore
  useEventChatStore.setState({
    messages: sessionMessages.messages as ChatMessage[],
    archivedMessages: (sessionMessages.archivedMessages || []) as ChatMessage[],
    conversationId: sessionMessages.conversationId || null,
    isStreaming: false,
    error: null,
    currentMessage: null,
    progressMessage: null,
  })

  log.debug('加载会话消息', {
    sessionId,
    messageCount: sessionMessages.messages.length,
    archivedCount: sessionMessages.archivedMessages?.length || 0,
    conversationId: sessionMessages.conversationId,
  })

  // 更新会话状态
  sessionSyncActions.updateSessionStatus(sessionId, 'idle')

  return true
}

/**
 * 切换会话（带消息同步）
 *
 * 流程：
 * 1. 如果当前正在流式传输，将当前会话转为后台运行
 * 2. 保存当前会话消息
 * 3. 切换 SessionStore 的 activeSessionId
 * 4. 加载目标会话消息
 *
 * @param targetSessionId 目标会话 ID
 * @returns 是否成功切换
 */
export async function switchSessionWithSync(targetSessionId: string): Promise<boolean> {
  const { activeSessionId, sessions } = useSessionStore.getState()

  // 检查目标会话是否存在
  if (!sessions.has(targetSessionId)) {
    log.warn('目标会话不存在', { targetSessionId })
    return false
  }

  // 如果切换到同一个会话，不做任何操作
  if (activeSessionId === targetSessionId) {
    log.debug('切换到当前会话，无需操作', { targetSessionId })
    return true
  }

  // 检查是否正在流式传输
  const eventChatState = useEventChatStore.getState()
  if (eventChatState.isStreaming && activeSessionId) {
    // 将当前会话转为后台运行，不中断流式传输
    log.info('当前会话转为后台运行', { sessionId: activeSessionId })

    // 将当前会话加入后台运行列表
    useSessionStore.getState().addToBackground(activeSessionId)

    // 更新会话状态为 background-running
    useSessionStore.getState().updateSessionStatus(activeSessionId, 'background-running')

    // 保存当前消息状态（流式传输会继续写入）
    saveCurrentMessagesToSession(activeSessionId)
  }

  // 1. 保存当前会话消息（如果有活跃会话且不在流式传输中）
  if (activeSessionId && !eventChatState.isStreaming) {
    saveCurrentMessagesToSession(activeSessionId)
  }

  // 2. 切换 SessionStore 的 activeSessionId
  useSessionStore.getState().switchSession(targetSessionId)

  // 3. 加载目标会话消息（跳过流式检查，因为已处理）
  const success = await loadSessionMessagesToEventChat(targetSessionId, true)

  if (success) {
    log.info('会话切换成功', {
      from: activeSessionId,
      to: targetSessionId,
      isBackground: eventChatState.isStreaming
    })
  }

  return success
}

/**
 * 清空 EventChatStore 的消息状态（保留事件监听器）
 */
function clearEventChatState(): void {
  const eventChatState = useEventChatStore.getState()

  // 清理 Provider Session
  if (eventChatState.providerSessionCache?.session) {
    try {
      eventChatState.providerSessionCache.session.dispose()
    } catch (e) {
      log.warn('清理 Provider Session 失败', { error: String(e) })
    }
  }

  // 清理工具面板
  const toolPanelActions = eventChatState.getToolPanelActions()
  if (toolPanelActions) {
    toolPanelActions.clearTools()
  }

  // 重置状态（保留事件监听器状态）
  useEventChatStore.setState({
    messages: [],
    archivedMessages: [],
    conversationId: null,
    currentConversationSeed: null,
    isStreaming: false,
    error: null,
    progressMessage: null,
    currentMessage: null,
    toolBlockMap: new Map(),
    questionBlockMap: new Map(),
    planBlockMap: new Map(),
    activePlanId: null,
    agentRunBlockMap: new Map(),
    activeTaskId: null,
    toolGroupBlockMap: new Map(),
    pendingToolGroup: null,
    permissionRequestBlockMap: new Map(),
    activePermissionRequestId: null,
    providerSessionCache: null,
  })
}

/**
 * 初始化 SessionSyncActions 依赖注入
 *
 * 在应用启动时调用，将 SessionStore 的方法注入到 EventChatStore
 */
export function initializeSessionSync(): void {
  useEventChatStore.getState().setDependencies({
    ...useEventChatStore.getState()._dependencies,
    sessionSyncActions: {
      getActiveSessionId: () => useSessionStore.getState().activeSessionId,
      getSessionMessages: (sessionId: string) => {
        const state = useSessionStore.getState().getSessionMessages(sessionId)
        return state ? {
          messages: state.messages,
          archivedMessages: state.archivedMessages,
          conversationId: state.conversationId,
        } : undefined
      },
      setSessionMessages: (sessionId: string, state: { messages: unknown[]; archivedMessages?: unknown[]; conversationId?: string | null }) => {
        useSessionStore.getState().setSessionMessages(sessionId, state)
      },
      updateSessionStatus: (sessionId: string, status: 'idle' | 'running' | 'waiting' | 'error') => {
        useSessionStore.getState().updateSessionStatus(sessionId, status)
      },
      updateSessionExternalId: (sessionId: string, externalSessionId: string) => {
        useSessionStore.getState().updateSessionExternalId(sessionId, externalSessionId)
      },
      getSessionEffectiveWorkspace: (sessionId: string) => {
        const session = useSessionStore.getState().sessions.get(sessionId)
        if (!session) return null
        return getSessionEffectiveWorkspace(session, useWorkspaceStore.getState().currentWorkspaceId)
      },
      getSessionContextWorkspaceIds: (sessionId: string) => {
        const session = useSessionStore.getState().sessions.get(sessionId)
        return session?.contextWorkspaceIds || []
      },
    },
  })

  log.info('SessionSync 初始化完成')
}

/**
 * 创建新会话并同步消息
 *
 * 流程：
 * 1. 保存当前会话消息（如果有）
 * 2. 创建新会话
 * 3. 清空 EventChatStore 消息
 *
 * @param options 创建会话选项
 * @returns 新会话 ID
 */
export function createSessionWithSync(options: CreateSessionOptions): string {
  const { activeSessionId } = useSessionStore.getState()

  // 1. 保存当前会话消息（如果有活跃会话）
  if (activeSessionId) {
    saveCurrentMessagesToSession(activeSessionId)
  }

  // 2. 创建新会话
  const newSessionId = useSessionStore.getState().createSession(options)

  // 3. 清空 EventChatStore 消息
  clearEventChatState()

  // 更新会话状态
  const sessionSyncActions = useEventChatStore.getState().getSessionSyncActions()
  if (sessionSyncActions) {
    sessionSyncActions.updateSessionStatus(newSessionId, 'idle')
  }

  log.info('创建新会话并同步消息', {
    newSessionId,
    previousSessionId: activeSessionId,
  })

  return newSessionId
}

/**
 * 从历史会话创建新会话
 *
 * 流程：
 * 1. 保存当前会话消息（如果有）
 * 2. 创建新会话（可指定工作区）
 * 3. 加载历史消息到新会话
 * 4. 切换到新会话
 *
 * @param options 选项
 * @returns 新会话 ID
 */
export async function createSessionFromHistory(options: {
  title: string
  workspaceId?: string
  engineId?: 'claude-code' | 'iflow' | 'codex' | `provider-${string}`
  externalSessionId?: string
  messages: ChatMessage[]
  conversationId?: string | null
}): Promise<string> {
  const { activeSessionId } = useSessionStore.getState()

  // 1. 保存当前会话消息（如果有活跃会话）
  if (activeSessionId) {
    saveCurrentMessagesToSession(activeSessionId)
  }

  // 2. 创建新会话
  const newSessionId = useSessionStore.getState().createSession({
    type: options.workspaceId ? 'project' : 'free',
    workspaceId: options.workspaceId,
    title: options.title,
    engineId: options.engineId,
    externalSessionId: options.externalSessionId,
  })

  // 3. 将历史消息存入 SessionStore
  const sessionSyncActions = useEventChatStore.getState().getSessionSyncActions()
  if (sessionSyncActions) {
    sessionSyncActions.setSessionMessages(newSessionId, {
      messages: options.messages,
      archivedMessages: [],
      conversationId: options.conversationId || options.externalSessionId || null,
    })
    sessionSyncActions.updateSessionStatus(newSessionId, 'idle')
  }

  // 4. 清空当前 EventChatStore
  clearEventChatState()

  // 5. 加载新会话消息到 EventChatStore
  useEventChatStore.setState({
    messages: options.messages,
    archivedMessages: [],
    conversationId: options.conversationId || options.externalSessionId || null,
    isStreaming: false,
    error: null,
    currentMessage: null,
    progressMessage: null,
  })

  log.info('从历史创建新会话', {
    newSessionId,
    title: options.title,
    workspaceId: options.workspaceId,
    messageCount: options.messages.length,
    previousSessionId: activeSessionId,
  })

  return newSessionId
}

/**
 * 后台会话完成处理
 *
 * 当后台运行的会话完成 AI 响应时调用，更新状态并发送通知
 *
 * @param sessionId 完成的会话 ID
 */
export function onBackgroundSessionComplete(sessionId: string): void {
  const sessionStore = useSessionStore.getState()
  const session = sessionStore.sessions.get(sessionId)

  // 检查是否在后台运行列表中
  if (sessionStore.backgroundSessionIds.includes(sessionId)) {
    // 从后台列表移除
    sessionStore.removeFromBackground(sessionId)

    // 加入完成通知列表
    sessionStore.addToNotifications(sessionId)

    // 更新状态为 idle
    sessionStore.updateSessionStatus(sessionId, 'idle')

    log.info('后台会话完成', {
      sessionId,
      title: session?.title,
      remainingBackground: sessionStore.backgroundSessionIds.length
    })

    // 可选：发送系统通知
    // if (session && 'Notification' in window && Notification.permission === 'granted') {
    //   new Notification('会话完成', { body: `会话 "${session.title}" 已完成` })
    // }
  }
}

/**
 * 用户查看后台完成的会话
 *
 * 当用户切换到已完成但未查看的会话时，清除通知状态
 *
 * @param sessionId 会话 ID
 */
export function acknowledgeCompletedSession(sessionId: string): void {
  const sessionStore = useSessionStore.getState()

  // 从完成通知列表移除
  if (sessionStore.completedNotifications.includes(sessionId)) {
    sessionStore.removeFromNotifications(sessionId)
    log.debug('用户查看了完成的会话', { sessionId })
  }
}