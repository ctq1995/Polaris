/**
 * 代码块组件
 *
 * 功能：
 * - 语法高亮（基于 highlight.js）
 * - 一键复制代码
 * - 显示编程语言标签
 * - 暗色主题适配
 * - 异步高亮避免阻塞主线程
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js';

// 导入常用语言
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';

// 注册语言
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('html', html);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('shell', bash);

// 高亮结果缓存
const highlightCache = new Map<string, string>();

/**
 * 生成缓存键
 */
function getCacheKey(code: string, language: string): string {
  return `${language}:${code.length}:${code.slice(0, 50)}`;
}

interface CodeBlockProps {
  /** 代码内容 */
  children: string;
  /** 语言类型（如 language-typescript） */
  className?: string;
}

/**
 * 从 className 中提取语言
 * 例如：language-typescript -> typescript
 */
function extractLanguage(className?: string): string {
  if (!className) return '';

  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : '';
}

/**
 * 语言别名映射（处理常见的别名）
 */
const languageAliases: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rs': 'rust',
  'c': 'cpp',
  'sh': 'bash',
  'zsh': 'bash',
  'yaml': 'yaml',
  'yml': 'yaml',
};

/**
 * 获取显示用的语言名称
 */
function getDisplayName(language: string): string {
  const displayNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'python': 'Python',
    'rust': 'Rust',
    'go': 'Go',
    'java': 'Java',
    'cpp': 'C++',
    'sql': 'SQL',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'bash': 'Bash',
    'markdown': 'Markdown',
  };

  return displayNames[language] || language.toUpperCase();
}

/**
 * 异步执行高亮（使用 requestIdleCallback 或 setTimeout）
 */
function scheduleHighlight(
  code: string,
  language: string,
  callback: (result: string) => void
): () => void {
  // 检查缓存
  const cacheKey = getCacheKey(code, language);
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    callback(cached);
    return () => {};
  }

  let cancelled = false;

  const doHighlight = () => {
    if (cancelled) return;

    try {
      const result = hljs.highlight(code, { language }).value;
      highlightCache.set(cacheKey, result);
      // 限制缓存大小
      if (highlightCache.size > 100) {
        const firstKey = highlightCache.keys().next().value;
        if (firstKey) highlightCache.delete(firstKey);
      }
      if (!cancelled) callback(result);
    } catch {
      try {
        const result = hljs.highlightAuto(code).value;
        highlightCache.set(cacheKey, result);
        if (!cancelled) callback(result);
      } catch {
        if (!cancelled) callback(code);
      }
    }
  };

  // 使用 requestIdleCallback 或 setTimeout 延迟执行
  if ('requestIdleCallback' in window) {
    const id = (window as any).requestIdleCallback(doHighlight, { timeout: 100 });
    return () => {
      cancelled = true;
      (window as any).cancelIdleCallback(id);
    };
  } else {
    const id = setTimeout(doHighlight, 16);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }
}

/**
 * CodeBlock 组件
 *
 * @example
 * ```tsx
 * <CodeBlock className="language-typescript">
 *   const x: number = 1;
 *   console.log(x);
 * </CodeBlock>
 * ```
 */
export const CodeBlock = memo(function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const codeString = String(children).trimEnd();

  // 提取语言
  const language = extractLanguage(className);
  const normalizedLanguage = languageAliases[language] || language;
  const displayName = getDisplayName(normalizedLanguage);

  // 异步语法高亮
  useEffect(() => {
    if (!normalizedLanguage) {
      setHighlightedCode(null);
      return;
    }

    return scheduleHighlight(codeString, normalizedLanguage, setHighlightedCode);
  }, [codeString, normalizedLanguage]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = codeString;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [codeString]);

  // 显示原始代码或高亮后的代码
  const displayCode = highlightedCode ?? codeString;
  const useHighlight = highlightedCode !== null;

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden bg-background-base border border-border-subtle">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-background-elevated border-b border-border-subtle">
        {/* 语言标签 */}
        {displayName && (
          <span className="text-xs text-text-tertiary font-mono">{displayName}</span>
        )}

        {/* 复制按钮 */}
        <button
          className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
            copied
              ? 'bg-success text-white'
              : 'text-text-tertiary hover:bg-background-hover'
          }`}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              复制
            </>
          )}
        </button>
      </div>

      {/* 代码区域 */}
      <div className="overflow-x-auto">
        <pre
          className={`p-4 !bg-background-base !m-0 !rounded-none ${className || ''}`}
          style={{
            margin: 0,
          }}
        >
          {useHighlight ? (
            <code
              className="hljs text-sm"
              dangerouslySetInnerHTML={{ __html: displayCode }}
            />
          ) : (
            <code className="text-sm text-text-secondary">{codeString}</code>
          )}
        </pre>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较：只在代码或 className 变化时重新渲染
  return prevProps.children === nextProps.children && prevProps.className === nextProps.className;
});
