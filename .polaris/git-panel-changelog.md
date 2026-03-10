# GitPanel UI/UX 优化日志

## 2026-03-10

### 修复记录

#### 1. BranchSelector.tsx 国际化问题

**问题描述**: BranchSelector 组件中存在硬编码的中文文本，未使用国际化。

**修改原因**: 确保所有文本支持多语言，提升国际化体验。

**修改文件**: `src/components/GitPanel/BranchSelector.tsx`

**修改内容**:
- 第 189 行: `本地分支 ({localBranches.length})` → `{t('branch.local')} ({localBranches.length})`
- 第 204 行: `远程分支 ({remoteBranches.length})` → `{t('branch.remote')} ({remoteBranches.length})`

---

#### 2. BranchTab.tsx 未导入组件问题

**问题描述**: BranchTab 组件中使用了自定义的 `ChevronRightIcon` 组件，但该组件可以直接使用 lucide-react 提供的 `ChevronRight` 替代。

**修改原因**: 
- 统一使用 lucide-react 图标库，减少冗余代码
- 自定义 SVG 组件与 lucide-react 的 `ChevronRight` 功能完全相同

**修改文件**: `src/components/GitPanel/BranchTab.tsx`

**修改内容**:
1. 在导入语句中添加 `ChevronRight`
2. 将 `<ChevronRightIcon ... />` 替换为 `<ChevronRight ... />`
3. 删除自定义的 `ChevronRightIcon` 函数（约 20 行代码）

---

### 验证结果

- TypeScript 类型检查: ✅ 通过 (`npx tsc --noEmit`)

---

### 待检查项（未发现问题）

以下项目在检查后未发现问题：

- [x] 布局自适应：各组件使用 flex 布局，响应式良好
- [x] 滚动区域：各 Tab 组件都有正确的 `overflow-y-auto` 设置
- [x] 弹窗层级：统一使用 `z-50`，层级一致
- [x] 国际化：除上述问题外，其他文本均已国际化
- [x] 状态提示：loading/error 状态处理完善
