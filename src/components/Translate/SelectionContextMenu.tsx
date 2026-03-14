/**
 * 选中文本右键菜单组件
 *
 * 支持功能：
 * - 复制选中文本
 * - 搜索（外部浏览器）
 * - 翻译（百度翻译）
 * - 复制引用（Markdown 格式）
 * - 问 AI（发送到聊天）
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslateStore, useConfigStore, useViewStore, useEventChatStore, useWorkspaceStore } from '../../stores';
import { baiduTranslate } from '../../services/tauri';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Copy, Search, Languages, Quote, MessageSquare, Check } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface SelectionInfo {
  text: string;
  position: Position;
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

export function SelectionContextMenu() {
  const { t } = useTranslation('translate');
  const { t: tCommon } = useTranslation('common');

  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const config = useConfigStore((state) => state.config);
  const setLeftPanelType = useViewStore((state) => state.setLeftPanelType);
  const setSourceText = useTranslateStore((state) => state.setSourceText);
  const sendMessage = useEventChatStore((state) => state.sendMessage);
  const currentWorkspace = useWorkspaceStore((state) => state.getCurrentWorkspace());

  // 右键菜单显示
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText && selectedText.length > 0 && selectedText.length < 5000) {
      e.preventDefault();
      setSelection({
        text: selectedText,
        position: { x: e.clientX, y: e.clientY },
      });
      setCopied(false);
    }
  }, []);

  // 点击外部关闭
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setSelection(null);
    }
  }, []);

  // ESC 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelection(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleContextMenu, handleClickOutside, handleKeyDown]);

  // 复制
  const handleCopy = async () => {
    if (!selection) return;
    await navigator.clipboard.writeText(selection.text);
    setCopied(true);
    setTimeout(() => {
      setSelection(null);
    }, 500);
  };

  // 搜索
  const handleSearch = async () => {
    if (!selection) return;
    const query = encodeURIComponent(selection.text);
    const isChinese = containsChinese(selection.text);
    const searchUrl = isChinese
      ? `https://www.baidu.com/s?wd=${query}`
      : `https://www.google.com/search?q=${query}`;
    await openUrl(searchUrl);
    setSelection(null);
  };

  // 翻译
  const handleTranslate = async () => {
    if (!selection) return;

    const baiduConfig = config?.baiduTranslate;
    if (!baiduConfig?.appId || !baiduConfig?.secretKey) {
      // 未配置则跳转到翻译面板
      setSourceText(selection.text);
      setLeftPanelType('translate');
      setSelection(null);
      return;
    }

    const isChinese = containsChinese(selection.text);
    const to = isChinese ? 'en' : 'zh';

    try {
      const result = await baiduTranslate(
        selection.text,
        baiduConfig.appId,
        baiduConfig.secretKey,
        to
      );

      if (result.success && result.result) {
        await navigator.clipboard.writeText(result.result);
        setSelection(null);
      }
    } catch (e) {
      console.error('Translation failed:', e);
    }
  };

  // 复制引用
  const handleCopyQuote = async () => {
    if (!selection) return;
    const quotedText = `> ${selection.text}`;
    await navigator.clipboard.writeText(quotedText);
    setSelection(null);
  };

  // 问 AI
  const handleAskAI = async () => {
    if (!selection || !currentWorkspace) return;

    // 发送选中文本作为问题
    await sendMessage(selection.text, currentWorkspace.path);
    setSelection(null);
  };

  if (!selection) return null;

  // 调整菜单位置，避免超出视口
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: selection.position.x,
    top: selection.position.y,
    zIndex: 9999,
  };

  const menuItems = [
    {
      id: 'copy',
      icon: copied ? <Check size={14} className="text-success" /> : <Copy size={14} />,
      label: copied ? tCommon('buttons.copied') : tCommon('buttons.copy'),
      onClick: handleCopy,
    },
    {
      id: 'search',
      icon: <Search size={14} />,
      label: t('search') || '搜索',
      onClick: handleSearch,
    },
    {
      id: 'translate',
      icon: <Languages size={14} />,
      label: containsChinese(selection.text) ? t('translateToEn') : t('translateToZh'),
      onClick: handleTranslate,
    },
    {
      id: 'copyQuote',
      icon: <Quote size={14} />,
      label: t('copyQuote') || '复制引用',
      onClick: handleCopyQuote,
    },
    {
      id: 'askAI',
      icon: <MessageSquare size={14} />,
      label: t('askAI') || '问 AI',
      onClick: handleAskAI,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-background-surface border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
    >
      {menuItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary flex items-center gap-2 transition-colors"
          onClick={item.onClick}
        >
          <span className="text-text-tertiary">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
