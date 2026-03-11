/**
 * 调试补丁：增强流式渲染的日志和错误处理
 *
 * 问题诊断：
 * 1. 检查是否收到 text_delta 事件
 * 2. 检查 TokenBuffer 是否正确创建和刷新
 * 3. 检查 currentMessage 是否正确更新
 */

// 在 appendTextBlock 开头添加详细日志
export function appendTextBlock_DEBUG(content: string) {
  console.log('='.repeat(60))
  console.log('[DEBUG] appendTextBlock 调用')
  console.log('[DEBUG] - content 长度:', content.length)
  console.log('[DEBUG] - content 预览:', content.slice(0, 100))
  console.log('[DEBUG] - 时间:', new Date().toISOString())
  console.log('='.repeat(60))
}

// 在 TokenBuffer 回调中添加日志
export function tokenBufferFlush_DEBUG(content: string, isFinal: boolean) {
  console.log('>>> TokenBuffer.flush() 调用')
  console.log('>>> - content 长度:', content.length)
  console.log('>>> - isFinal:', isFinal)
  console.log('>>> - 时间:', new Date().toISOString())
}

// 在 handleAIEvent 中添加日志
export function handleAIEvent_DEBUG(event: any) {
  console.log('[handleAIEvent] 收到事件:', event.type)
  if (event.type === 'token') {
    console.log('[handleAIEvent] token 值长度:', event.value?.length)
    console.log('[handleAIEvent] token 预览:', event.value?.slice(0, 50))
  }
}
