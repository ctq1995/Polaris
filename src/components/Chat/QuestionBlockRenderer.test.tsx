/**
 * QuestionBlockRenderer 组件测试
 *
 * 测试范围：
 * - 渲染：显示问题标题、选项、自定义输入框
 * - 交互：选项选择、自定义输入、提交答案
 * - 状态：pending/answered 状态切换
 * - 无障碍：ARIA 属性、键盘导航
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionBlockRenderer } from './QuestionBlockRenderer';
import type { QuestionBlock } from '../../types';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock zustand store
const mockContinueChat = vi.fn();
vi.mock('../../stores', () => ({
  useEventChatStore: vi.fn((selector) => {
    const state = {
      conversationId: 'test-conversation-id',
      continueChat: mockContinueChat,
    };
    return selector(state);
  }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'question.answered': '已回答',
        'question.submit': '提交',
        'question.submitting': '提交中...',
        'question.customInputPlaceholder': '请输入自定义答案...',
        'question.showMore': `显示更多 (${options?.count || 0} 项)`,
        'question.multiSelectHint': '可多选',
        'question.customInputLabel': '自定义输入',
        'question.selected': '已选择',
        'question.input': '输入',
      };
      return translations[key] || key;
    },
  }),
}));

// 测试数据工厂
function createQuestionBlock(overrides?: Partial<QuestionBlock>): QuestionBlock {
  return {
    id: 'test-question-id',
    type: 'question',
    header: '请选择一个选项',
    multiSelect: false,
    options: [
      { value: 'option1', label: '选项 1' },
      { value: 'option2', label: '选项 2' },
      { value: 'option3', label: '选项 3' },
    ],
    allowCustomInput: false,
    status: 'pending',
    ...overrides,
  };
}

describe('QuestionBlockRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    mockContinueChat.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该显示问题标题', () => {
      const block = createQuestionBlock({ header: '这是一个测试问题？' });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByText('这是一个测试问题？')).toBeInTheDocument();
    });

    it('应该显示所有选项', () => {
      const block = createQuestionBlock();
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByText('选项 1')).toBeInTheDocument();
      expect(screen.getByText('选项 2')).toBeInTheDocument();
      expect(screen.getByText('选项 3')).toBeInTheDocument();
    });

    it('当 allowCustomInput 为 true 时应显示自定义输入框', () => {
      const block = createQuestionBlock({ allowCustomInput: true });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByPlaceholderText('请输入自定义答案...')).toBeInTheDocument();
    });

    it('当 allowCustomInput 为 false 时不应显示自定义输入框', () => {
      const block = createQuestionBlock({ allowCustomInput: false });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.queryByPlaceholderText('请输入自定义答案...')).not.toBeInTheDocument();
    });

    it('多选模式应显示提示文本', () => {
      const block = createQuestionBlock({ multiSelect: true });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByText('可多选')).toBeInTheDocument();
    });

    it('已回答状态应显示已回答标签', () => {
      const block = createQuestionBlock({
        status: 'answered',
        answer: { selected: ['option1'] },
      });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByText('已回答')).toBeInTheDocument();
    });
  });

  describe('选项选择', () => {
    it('单选模式点击选项应选中该项', () => {
      const block = createQuestionBlock({ multiSelect: false });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;
      fireEvent.click(option1);

      // 检查选中状态（通过 aria-selected 属性）
      expect(option1).toHaveAttribute('aria-selected', 'true');
    });

    it('单选模式点击另一选项应切换选中', () => {
      const block = createQuestionBlock({ multiSelect: false });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;
      const option2 = screen.getByText('选项 2').closest('button')!;

      fireEvent.click(option1);
      expect(option1).toHaveAttribute('aria-selected', 'true');
      expect(option2).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(option2);
      expect(option1).toHaveAttribute('aria-selected', 'false');
      expect(option2).toHaveAttribute('aria-selected', 'true');
    });

    it('多选模式应允许选择多个选项', () => {
      const block = createQuestionBlock({ multiSelect: true });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;
      const option2 = screen.getByText('选项 2').closest('button')!;

      fireEvent.click(option1);
      fireEvent.click(option2);

      expect(option1).toHaveAttribute('aria-selected', 'true');
      expect(option2).toHaveAttribute('aria-selected', 'true');
    });

    it('多选模式再次点击已选项应取消选中', () => {
      const block = createQuestionBlock({ multiSelect: true });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;

      fireEvent.click(option1);
      expect(option1).toHaveAttribute('aria-selected', 'true');

      fireEvent.click(option1);
      expect(option1).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('提交答案', () => {
    it('点击提交按钮应调用 answer_question', async () => {
      const block = createQuestionBlock();
      render(<QuestionBlockRenderer block={block} />);

      // 先选择一个选项
      const option1 = screen.getByText('选项 1').closest('button')!;
      fireEvent.click(option1);

      // 点击提交
      const submitBtn = screen.getByText('提交');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('answer_question', {
          sessionId: 'test-conversation-id',
          callId: 'test-question-id',
          answer: {
            selected: ['option1'],
            customInput: undefined,
          },
        });
      });
    });

    it('提交后应调用 continueChat', async () => {
      const block = createQuestionBlock();
      render(<QuestionBlockRenderer block={block} />);

      // 选择选项并提交
      const option1 = screen.getByText('选项 1').closest('button')!;
      fireEvent.click(option1);
      fireEvent.click(screen.getByText('提交'));

      await waitFor(() => {
        expect(mockContinueChat).toHaveBeenCalled();
      });
    });

    it('未选择任何选项时提交按钮应禁用', () => {
      const block = createQuestionBlock({ allowCustomInput: false });
      render(<QuestionBlockRenderer block={block} />);

      const submitBtn = screen.getByText('提交');
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('已回答状态', () => {
    it('已回答时选项应禁用', () => {
      const block = createQuestionBlock({
        status: 'answered',
        answer: { selected: ['option1'] },
      });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;
      expect(option1).toBeDisabled();
    });

    it('已回答时不应显示提交按钮', () => {
      const block = createQuestionBlock({
        status: 'answered',
        answer: { selected: ['option1'] },
      });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.queryByText('提交')).not.toBeInTheDocument();
    });

    it('已回答时应高亮显示选中的选项', () => {
      const block = createQuestionBlock({
        status: 'answered',
        answer: { selected: ['option1'] },
      });
      render(<QuestionBlockRenderer block={block} />);

      const option1 = screen.getByText('选项 1').closest('button')!;
      // 检查是否有成功状态的类名
      expect(option1.className).toMatch(/success/);
    });
  });

  describe('无障碍', () => {
    it('应有正确的 ARIA role 属性', () => {
      const block = createQuestionBlock();
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('选项应有正确的 ARIA 属性', () => {
      const block = createQuestionBlock();
      render(<QuestionBlockRenderer block={block} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(3);

      options.forEach((option) => {
        expect(option).toHaveAttribute('aria-selected');
      });
    });

    it('多选模式 listbox 应有 aria-multiselectable', () => {
      const block = createQuestionBlock({ multiSelect: true });
      render(<QuestionBlockRenderer block={block} />);

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    });
  });

  describe('超过 5 个选项', () => {
    it('应只显示前 5 个选项并提供展开按钮', () => {
      const block = createQuestionBlock({
        options: Array.from({ length: 8 }, (_, i) => ({
          value: `option${i + 1}`,
          label: `选项 ${i + 1}`,
        })),
      });
      render(<QuestionBlockRenderer block={block} />);

      // 应显示前 5 个选项
      expect(screen.getByText('选项 1')).toBeInTheDocument();
      expect(screen.getByText('选项 5')).toBeInTheDocument();
      // 第 6 个选项不应显示
      expect(screen.queryByText('选项 6')).not.toBeInTheDocument();
      // 应显示展开按钮
      expect(screen.getByText(/显示更多/)).toBeInTheDocument();
    });

    it('点击展开按钮应显示所有选项', () => {
      const block = createQuestionBlock({
        options: Array.from({ length: 8 }, (_, i) => ({
          value: `option${i + 1}`,
          label: `选项 ${i + 1}`,
        })),
      });
      render(<QuestionBlockRenderer block={block} />);

      fireEvent.click(screen.getByText(/显示更多/));

      // 所有选项都应显示
      expect(screen.getByText('选项 6')).toBeInTheDocument();
      expect(screen.getByText('选项 8')).toBeInTheDocument();
    });
  });
});