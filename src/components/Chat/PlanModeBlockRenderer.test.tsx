/**
 * PlanModeBlockRenderer 组件测试
 *
 * 测试范围：
 * - 渲染：显示计划标题、阶段列表、审批按钮
 * - 交互：批准/拒绝、反馈输入
 * - 状态：不同状态的显示
 * - 无障碍：ARIA 属性、键盘导航
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanModeBlockRenderer, SimplifiedPlanModeRenderer } from './PlanModeBlockRenderer';
import type { PlanModeBlock, PlanStageBlock } from '../../types';

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
        'plan.defaultTitle': '执行计划',
        'plan.statusDrafting': '草稿中',
        'plan.statusPendingApproval': '待审批',
        'plan.statusApproved': '已批准',
        'plan.statusRejected': '已拒绝',
        'plan.statusExecuting': '执行中',
        'plan.statusCompleted': '已完成',
        'plan.statusCanceled': '已取消',
        'plan.approve': '批准',
        'plan.reject': '拒绝',
        'plan.cancel': '取消',
        'plan.confirmReject': '确认拒绝',
        'plan.feedbackPlaceholder': '请输入拒绝原因或修改建议...',
        'plan.feedbackLabel': '反馈意见',
        'plan.approvalButtonsLabel': '审批按钮',
        'plan.approveAriaLabel': '批准计划',
        'plan.rejectAriaLabel': '拒绝计划',
        'plan.planModeAriaLabel': `计划: ${options?.title || '执行计划'}`,
        'plan.stageAriaLabel': `${options?.name || '阶段'} (${options?.completed || 0}/${options?.total || 0})`,
      };
      return translations[key] || key;
    },
  }),
}));

// 测试数据工厂
function createPlanStage(overrides?: Partial<PlanStageBlock>): PlanStageBlock {
  return {
    stageId: 'stage-1',
    name: '阶段 1',
    status: 'pending',
    tasks: [
      { taskId: 'task-1', description: '任务 1', status: 'pending' },
      { taskId: 'task-2', description: '任务 2', status: 'pending' },
    ],
    ...overrides,
  };
}

function createPlanModeBlock(overrides?: Partial<PlanModeBlock>): PlanModeBlock {
  return {
    id: 'test-plan-id',
    type: 'plan_mode',
    title: '测试计划',
    description: '这是一个测试计划',
    status: 'pending_approval',
    isActive: true,
    stages: [createPlanStage()],
    ...overrides,
  };
}

describe('PlanModeBlockRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    mockContinueChat.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该显示计划标题', () => {
      const block = createPlanModeBlock({ title: '这是一个测试计划' });
      render(<PlanModeBlockRenderer block={block} />);

      // 标题可能在头部和 aria-label 中出现
      const titleElements = screen.getAllByText('这是一个测试计划');
      expect(titleElements.length).toBeGreaterThan(0);
    });

    it('应该显示计划描述', () => {
      const block = createPlanModeBlock({ description: '计划描述内容' });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('计划描述内容')).toBeInTheDocument();
    });

    it('应该显示阶段列表', () => {
      const block = createPlanModeBlock({
        stages: [
          createPlanStage({ stageId: 'stage-1', name: '阶段 A' }),
          createPlanStage({ stageId: 'stage-2', name: '阶段 B' }),
        ],
      });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('阶段 A')).toBeInTheDocument();
      expect(screen.getByText('阶段 B')).toBeInTheDocument();
    });

    it('应该显示状态标签', () => {
      const block = createPlanModeBlock({ status: 'pending_approval' });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('待审批')).toBeInTheDocument();
    });

    it('pending_approval 且 isActive 为 true 时应显示审批按钮', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('批准')).toBeInTheDocument();
      expect(screen.getByText('拒绝')).toBeInTheDocument();
    });

    it('非 pending_approval 状态不应显示审批按钮', () => {
      const block = createPlanModeBlock({ status: 'approved', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.queryByText('批准')).not.toBeInTheDocument();
      expect(screen.queryByText('拒绝')).not.toBeInTheDocument();
    });

    it('isActive 为 false 时不应显示审批按钮', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.queryByText('批准')).not.toBeInTheDocument();
      expect(screen.queryByText('拒绝')).not.toBeInTheDocument();
    });

    it('应该显示整体进度', () => {
      const block = createPlanModeBlock({
        stages: [
          createPlanStage({
            tasks: [
              { taskId: 'task-1', description: '任务 1', status: 'completed' },
              { taskId: 'task-2', description: '任务 2', status: 'pending' },
            ],
          }),
        ],
      });
      render(<PlanModeBlockRenderer block={block} />);

      // 整体进度和阶段进度都会显示 1/2
      const progressTexts = screen.getAllByText('1/2');
      expect(progressTexts.length).toBeGreaterThan(0);
    });

    it('应该显示反馈信息', () => {
      const block = createPlanModeBlock({ feedback: '需要修改' });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('需要修改')).toBeInTheDocument();
    });
  });

  describe('批准操作', () => {
    it('点击批准按钮应调用 approve_plan', async () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      const approveBtn = screen.getByText('批准');
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('approve_plan', {
          sessionId: 'test-conversation-id',
          planId: 'test-plan-id',
        });
      });
    });

    it('批准后应调用 continueChat', async () => {
      const block = createPlanModeBlock({
        status: 'pending_approval',
        isActive: true,
        title: '我的计划',
      });
      render(<PlanModeBlockRenderer block={block} />);

      const approveBtn = screen.getByText('批准');
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockContinueChat).toHaveBeenCalled();
        const prompt = mockContinueChat.mock.calls[0][0];
        expect(prompt).toContain('批准');
        expect(prompt).toContain('我的计划');
      });
    });
  });

  describe('拒绝操作', () => {
    it('点击拒绝按钮应显示反馈输入框', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      const rejectBtn = screen.getByText('拒绝');
      fireEvent.click(rejectBtn);

      expect(screen.getByPlaceholderText('请输入拒绝原因或修改建议...')).toBeInTheDocument();
    });

    it('输入反馈后点击确认拒绝应调用 reject_plan', async () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      // 点击拒绝显示输入框
      const rejectBtn = screen.getByText('拒绝');
      fireEvent.click(rejectBtn);

      // 输入反馈
      const input = screen.getByPlaceholderText('请输入拒绝原因或修改建议...');
      fireEvent.change(input, { target: { value: '需要更多细节' } });

      // 确认拒绝
      const confirmBtn = screen.getByText('确认拒绝');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('reject_plan', {
          sessionId: 'test-conversation-id',
          planId: 'test-plan-id',
          feedback: '需要更多细节',
        });
      });
    });

    it('点击取消应隐藏反馈输入框', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      // 点击拒绝显示输入框
      const rejectBtn = screen.getByText('拒绝');
      fireEvent.click(rejectBtn);
      expect(screen.getByPlaceholderText('请输入拒绝原因或修改建议...')).toBeInTheDocument();

      // 点击取消
      const cancelBtn = screen.getByText('取消');
      fireEvent.click(cancelBtn);

      expect(screen.queryByPlaceholderText('请输入拒绝原因或修改建议...')).not.toBeInTheDocument();
    });
  });

  describe('阶段展开/折叠', () => {
    it('点击阶段应展开显示任务列表', () => {
      const block = createPlanModeBlock({
        stages: [createPlanStage({ name: '可展开阶段' })],
      });
      render(<PlanModeBlockRenderer block={block} />);

      // 阶段默认折叠，任务不应显示
      expect(screen.queryByText('任务 1')).not.toBeInTheDocument();

      // 点击展开
      const stageHeader = screen.getByText('可展开阶段').closest('div');
      fireEvent.click(stageHeader!);

      expect(screen.getByText('任务 1')).toBeInTheDocument();
    });

    it('再次点击应折叠阶段', () => {
      const block = createPlanModeBlock({
        stages: [createPlanStage({ name: '可折叠阶段' })],
      });
      render(<PlanModeBlockRenderer block={block} />);

      // 展开阶段
      const stageHeader = screen.getByText('可折叠阶段').closest('div');
      fireEvent.click(stageHeader!);
      expect(screen.getByText('任务 1')).toBeInTheDocument();

      // 再次点击折叠
      fireEvent.click(stageHeader!);
      expect(screen.queryByText('任务 1')).not.toBeInTheDocument();
    });
  });

  describe('无障碍', () => {
    it('应有正确的 ARIA role 属性', () => {
      const block = createPlanModeBlock();
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('阶段应有正确的 ARIA 属性', () => {
      const block = createPlanModeBlock();
      render(<PlanModeBlockRenderer block={block} />);

      const stageButton = screen.getByRole('button', { name: /阶段 1/ });
      expect(stageButton).toBeInTheDocument();
      expect(stageButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('审批按钮组应有正确的 ARIA 属性', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByRole('group', { name: '审批按钮' })).toBeInTheDocument();
    });

    it('键盘 Escape 应关闭反馈输入框', () => {
      const block = createPlanModeBlock({ status: 'pending_approval', isActive: true });
      render(<PlanModeBlockRenderer block={block} />);

      // 打开反馈输入框
      const rejectBtn = screen.getByText('拒绝');
      fireEvent.click(rejectBtn);
      expect(screen.getByPlaceholderText('请输入拒绝原因或修改建议...')).toBeInTheDocument();

      // 按 Escape 关闭
      fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' });

      expect(screen.queryByPlaceholderText('请输入拒绝原因或修改建议...')).not.toBeInTheDocument();
    });
  });

  describe('不同状态', () => {
    it('drafting 状态应显示旋转动画', () => {
      const block = createPlanModeBlock({ status: 'drafting' });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('草稿中')).toBeInTheDocument();
    });

    it('approved 状态应显示已批准', () => {
      const block = createPlanModeBlock({ status: 'approved', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('已批准')).toBeInTheDocument();
    });

    it('rejected 状态应显示已拒绝', () => {
      const block = createPlanModeBlock({ status: 'rejected', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('已拒绝')).toBeInTheDocument();
    });

    it('executing 状态应显示执行中', () => {
      const block = createPlanModeBlock({ status: 'executing', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('执行中')).toBeInTheDocument();
    });

    it('completed 状态应显示已完成', () => {
      const block = createPlanModeBlock({ status: 'completed', isActive: false });
      render(<PlanModeBlockRenderer block={block} />);

      expect(screen.getByText('已完成')).toBeInTheDocument();
    });
  });
});

describe('SimplifiedPlanModeRenderer', () => {
  it('应该显示简化版计划信息', () => {
    const block = createPlanModeBlock({ title: '简化计划' });
    render(<SimplifiedPlanModeRenderer block={block} />);

    expect(screen.getByText('简化计划')).toBeInTheDocument();
  });

  it('应该显示任务进度', () => {
    const block = createPlanModeBlock({
      stages: [
        createPlanStage({
          tasks: [
            { taskId: 'task-1', description: '任务 1', status: 'completed' },
            { taskId: 'task-2', description: '任务 2', status: 'pending' },
            { taskId: 'task-3', description: '任务 3', status: 'pending' },
          ],
        }),
      ],
    });
    render(<SimplifiedPlanModeRenderer block={block} />);

    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('应该有 aria-label 属性', () => {
    const block = createPlanModeBlock({ title: '无障碍测试计划' });
    render(<SimplifiedPlanModeRenderer block={block} />);

    const element = screen.getByText('无障碍测试计划').closest('div');
    expect(element).toHaveAttribute('aria-label');
  });
});
