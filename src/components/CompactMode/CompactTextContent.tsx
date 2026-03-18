/**
 * CompactTextContent - 小屏模式文本内容渲染
 *
 * 特点：
 * - 紧凑的代码块显示
 * - 行内代码高亮
 * - 链接可点击
 * - 列表简化渲染
 */

import { useMemo, memo } from 'react'

interface CompactTextContentProps {
  content: string
}

export const CompactTextContent = memo(function CompactTextContent({ content }: CompactTextContentProps) {
  const elements = useMemo(() => parseMarkdown(content), [content])

  return (
    <div className="bg-background-surface/50 rounded-lg px-2.5 py-1.5 space-y-1">
      {elements}
    </div>
  )
})

/**
 * 简化的 Markdown 解析器
 */
function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  let key = 0

  // 分割成行
  const lines = text.split('\n')
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''
  let currentParagraph: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paraText = currentParagraph.join('\n')
      if (paraText.trim()) {
        elements.push(
          <p key={key++} className="text-sm text-text-primary whitespace-pre-wrap break-words">
            {renderInlineMarkdown(paraText)}
          </p>
        )
      }
      currentParagraph = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 代码块开始/结束
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 代码块结束
        elements.push(
          <CompactCodeBlock
            key={key++}
            code={codeBlockContent.join('\n')}
            lang={codeBlockLang}
          />
        )
        codeBlockContent = []
        codeBlockLang = ''
        inCodeBlock = false
      } else {
        // 代码块开始
        flushParagraph()
        codeBlockLang = line.slice(3).trim()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // 列表项
    if (line.match(/^[-*]\s/)) {
      flushParagraph()
      const listItems: string[] = [line.replace(/^[-*]\s/, '')]
      while (i + 1 < lines.length && lines[i + 1].match(/^[-*]\s/)) {
        i++
        listItems.push(lines[i].replace(/^[-*]\s/, ''))
      }
      elements.push(
        <ul key={key++} className="text-sm text-text-primary space-y-0.5 pl-3">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex gap-1">
              <span className="text-text-tertiary">•</span>
              <span>{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 有序列表
    if (line.match(/^\d+\.\s/)) {
      flushParagraph()
      const listItems: string[] = [line.replace(/^\d+\.\s/, '')]
      while (i + 1 < lines.length && lines[i + 1].match(/^\d+\.\s/)) {
        i++
        listItems.push(lines[i].replace(/^\d+\.\s/, ''))
      }
      elements.push(
        <ol key={key++} className="text-sm text-text-primary space-y-0.5 pl-3">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex gap-1">
              <span className="text-text-tertiary shrink-0">{idx + 1}.</span>
              <span>{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // 空行
    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    // 普通文本
    currentParagraph.push(line)
  }

  // 处理剩余内容
  flushParagraph()
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <CompactCodeBlock
        key={key++}
        code={codeBlockContent.join('\n')}
        lang={codeBlockLang}
      />
    )
  }

  // 如果没有内容，返回原始文本
  if (elements.length === 0) {
    return [
      <p key={0} className="text-sm text-text-primary whitespace-pre-wrap break-words">
        {text}
      </p>
    ]
  }

  return elements
}

/**
 * 渲染行内 Markdown（粗体、斜体、行内代码、链接）
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let key = 0
  let remaining = text

  interface MatchInfo {
    index: number
    length: number
    element: React.ReactNode
  }

  // 简化处理：逐个匹配并替换
  while (remaining.length > 0) {
    const matches: MatchInfo[] = []

    // 检查行内代码
    const codeMatch = remaining.match(/`([^`]+)`/)
    if (codeMatch && codeMatch.index !== undefined) {
      matches.push({
        index: codeMatch.index,
        length: codeMatch[0].length,
        element: (
          <code
            key={`code-${key++}`}
            className="bg-background-hover px-1 rounded text-xs font-mono text-primary"
          >
            {codeMatch[1]}
          </code>
        )
      })
    }

    // 检查粗体
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
    if (boldMatch && boldMatch.index !== undefined) {
      matches.push({
        index: boldMatch.index,
        length: boldMatch[0].length,
        element: (
          <strong key={`bold-${key++}`} className="font-semibold">
            {boldMatch[1]}
          </strong>
        )
      })
    }

    // 检查斜体
    const italicMatch = remaining.match(/\*([^*]+)\*/)
    if (italicMatch && italicMatch.index !== undefined && !italicMatch[0].startsWith('**')) {
      matches.push({
        index: italicMatch.index,
        length: italicMatch[0].length,
        element: (
          <em key={`italic-${key++}`} className="italic">
            {italicMatch[1]}
          </em>
        )
      })
    }

    // 检查链接
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch && linkMatch.index !== undefined) {
      matches.push({
        index: linkMatch.index,
        length: linkMatch[0].length,
        element: (
          <a
            key={`link-${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {linkMatch[1]}
          </a>
        )
      })
    }

    if (matches.length === 0) {
      // 没有更多匹配，添加剩余文本
      parts.push(remaining)
      break
    }

    // 选择最早的匹配
    const earliestMatch = matches.reduce((a, b) => a.index < b.index ? a : b)

    // 添加匹配前的文本
    if (earliestMatch.index > 0) {
      parts.push(remaining.slice(0, earliestMatch.index))
    }
    // 添加匹配的元素
    parts.push(earliestMatch.element)
    // 更新剩余文本
    remaining = remaining.slice(earliestMatch.index + earliestMatch.length)
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

/**
 * 紧凑代码块组件
 */
function CompactCodeBlock({ code, lang }: { code: string; lang: string }) {
  // 截断长代码
  const maxLines = 10
  const lines = code.split('\n')
  const truncated = lines.length > maxLines
  const displayCode = truncated
    ? lines.slice(0, maxLines).join('\n') + '\n...'
    : code

  return (
    <div className="bg-background-hover rounded-md overflow-hidden my-1">
      {/* 头部 */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-background-surface/50">
        <span className="text-xs text-text-tertiary font-mono">
          {lang || 'text'}
        </span>
        {truncated && (
          <span className="text-xs text-text-tertiary">
            {lines.length} 行
          </span>
        )}
      </div>
      {/* 代码内容 */}
      <pre className="p-2 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre-wrap break-all">
        {displayCode}
      </pre>
    </div>
  )
}
