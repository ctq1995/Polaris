# 定时任务重构计划

## 概述

本计划旨在简化定时任务系统，统一存储架构，修复 MCP 问题。

## 执行次序

| 序号 | 文档 | 内容 | 预计工作量 |
|------|------|------|------------|
| 1 | [01-overview.md](./01-overview.md) | 问题分析与重构目标 | 阅读 |
| 2 | [02-phase1-storage.md](./02-phase1-storage.md) | 统一存储架构 | 中 |
| 3 | [03-phase2-model.md](./03-phase2-model.md) | 简化数据模型 | 低 |
| 4 | [04-phase3-mcp.md](./04-phase3-mcp.md) | 重构 MCP | 高 |
| 5 | [05-phase4-frontend.md](./05-phase4-frontend.md) | 简化前端 | 中 |
| 6 | [06-phase5-cleanup.md](./06-phase5-cleanup.md) | 清理删除 | 低 |

## 关键变更

### 存储统一

| 数据类型 | 当前路径 | 目标路径 |
|----------|----------|----------|
| 待办 | `config_dir/todo/` | ✅ 已完成 |
| 需求 | `config_dir/requirements/` | ✅ 已完成 |
| 定时任务 | `workspace/.polaris/scheduler/` | `config_dir/scheduler/` |

### 功能精简

**移除**：日志系统、模板管理、订阅机制、协议模式、重试机制、超时配置、通知配置

**保留**：基础任务 CRUD、触发器计算、执行状态

## 风险提示

1. 现有定时任务数据需要迁移（如有）
2. MCP 配置需要更新参数格式
3. 前端组件需要适配简化后的接口

## 参考文档

- [MCP 存储路径避坑指南](../20260329-mcp-storage-path-pitfall.md)
- [待办重构总结](../todo-refactor-summary.md)
- [需求重构分析](../requirement-refactor-analysis.md)
