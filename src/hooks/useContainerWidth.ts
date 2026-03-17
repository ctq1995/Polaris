/**
 * 容器宽度检测 Hook
 *
 * 用于响应式布局，检测容器宽度变化
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type ContainerSize = 'compact' | 'normal' | 'wide';

export interface ContainerWidthInfo {
  width: number;
  size: ContainerSize;
  isCompact: boolean;
  isNormal: boolean;
  isWide: boolean;
}

interface UseContainerWidthOptions {
  /** 紧凑模式阈值，默认 480 */
  compactThreshold?: number;
  /** 宽屏模式阈值，默认 720 */
  wideThreshold?: number;
}

/**
 * 检测容器宽度的 Hook
 *
 * @example
 * const containerRef = useContainerWidth((info) => {
 *   console.log('Width:', info.width, 'Size:', info.size);
 * });
 *
 * return <div ref={containerRef}>...</div>;
 */
export function useContainerWidth(
  onWidthChange?: (info: ContainerWidthInfo) => void,
  options: UseContainerWidthOptions = {}
): React.RefObject<HTMLDivElement | null> {
  const { compactThreshold = 480, wideThreshold = 720 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Note: widthInfo is maintained internally for future use if needed
  const [, setWidthInfo] = useState<ContainerWidthInfo>({
    width: 0,
    size: 'normal',
    isCompact: false,
    isNormal: true,
    isWide: false,
  });

  const calculateSize = useCallback((width: number): ContainerSize => {
    if (width < compactThreshold) return 'compact';
    if (width >= wideThreshold) return 'wide';
    return 'normal';
  }, [compactThreshold, wideThreshold]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const size = calculateSize(width);
        const newInfo: ContainerWidthInfo = {
          width,
          size,
          isCompact: size === 'compact',
          isNormal: size === 'normal',
          isWide: size === 'wide',
        };
        setWidthInfo(newInfo);
        onWidthChange?.(newInfo);
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [calculateSize, onWidthChange]);

  // 返回 ref 以便附加到容器元素
  return containerRef;
}

/**
 * 简化版本，直接返回宽度和大小信息
 */
export function useContainerSize(
  options: UseContainerWidthOptions = {}
): [React.RefObject<HTMLDivElement | null>, ContainerWidthInfo] {
  const { compactThreshold = 480, wideThreshold = 720 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widthInfo, setWidthInfo] = useState<ContainerWidthInfo>({
    width: 0,
    size: 'normal',
    isCompact: false,
    isNormal: true,
    isWide: false,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const calculateSize = (width: number): ContainerSize => {
      if (width < compactThreshold) return 'compact';
      if (width >= wideThreshold) return 'wide';
      return 'normal';
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const size = calculateSize(width);
        setWidthInfo({
          width,
          size,
          isCompact: size === 'compact',
          isNormal: size === 'normal',
          isWide: size === 'wide',
        });
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [compactThreshold, wideThreshold]);

  return [containerRef, widthInfo];
}
