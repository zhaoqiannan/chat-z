// 组件：拖拽调节分割器（Splitter），用于在章节编辑区与 AI 协同助手之间灵活调节面板宽度
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Tooltip, ActionIcon } from "@mantine/core";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface SplitterProps {
  width: number;
  onResize: (newWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function Splitter({
  width,
  onResize,
  minWidth = 280,
  maxWidth = 720,
  defaultWidth = 360,
  collapsed = false,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
}: SplitterProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: width });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      if (onDragStart) onDragStart();
      dragInfoRef.current = {
        startX: e.clientX,
        startWidth: width,
      };
    },
    [width, onDragStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 拖拽位于右侧面板左边缘：鼠标向左移动 (delta < 0)，右侧面板变宽；向右移动，右侧面板变窄
      const deltaX = dragInfoRef.current.startX - e.clientX;
      const targetWidth = dragInfoRef.current.startWidth + deltaX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, targetWidth));
      onResize(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (onDragEnd) onDragEnd();
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, onResize, onDragEnd]);

  const handleDoubleClick = () => {
    onResize(defaultWidth);
  };

  if (collapsed) {
    return (
      <Box
        style={{
          width: 24,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          zIndex: 25,
          cursor: "pointer",
          transition: "background-color 0.15s ease",
        }}
        onClick={onToggleCollapse}
      >
        <Tooltip label="展开 AI 协同创作助手" position="left" withArrow>
          <ActionIcon size="xs" variant="subtle" >
            <FiChevronLeft size={13} />
          </ActionIcon>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      pos="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        width: 8,
        height: "100%",
        cursor: "col-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        margin: "0 -4px",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* 视觉分割线 */}
      <Box
        style={{
          width: isHovered || isDragging ? 2 : 1,
          height: "100%",
          backgroundColor: isDragging
            ? "#0284c7"
            : isHovered
              ? "#38bdf8"
              : "#e2e8f0",
          transition: isDragging ? "none" : "all 0.15s ease",
          boxShadow: isDragging || isHovered ? "0 0 6px rgba(14, 165, 233, 0.4)" : "none",
        }}
      />

      {/* 居中拖拽手柄条与折叠按钮 */}
      <Box
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "8px 2px",
          borderRadius: 4,
          backgroundColor: isDragging || isHovered ? "#ffffff" : "transparent",
          border: isDragging || isHovered ? "1px solid #cbd5e1" : "none",
          boxShadow: isDragging || isHovered ? "0 2px 6px rgba(0, 0, 0, 0.08)" : "none",
          transition: "all 0.15s ease",
          pointerEvents: "auto",
        }}
      >
        {/* 抓手手柄点 */}
        <Box style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: isHovered || isDragging ? "#0284c7" : "#94a3b8" }} />
        <Box style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: isHovered || isDragging ? "#0284c7" : "#94a3b8" }} />
        <Box style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: isHovered || isDragging ? "#0284c7" : "#94a3b8" }} />

        {/* 快速收起小按钮（Hover 时显示） */}
        {(isHovered || isDragging) && onToggleCollapse && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            mt={4}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            <Tooltip label="收起 AI 协同面板 (双击手柄恢复默认宽度)" position="left" withArrow fz={11}>
              <ActionIcon size={14} variant="transparent" color="gray">
                <FiChevronRight size={12} />
              </ActionIcon>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
