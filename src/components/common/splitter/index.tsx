// 公共组件：可拖拽面板宽度调节分割器（支持左侧栏/右侧栏双方向拖拽与一键折叠展开）
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Flex, Tooltip, ActionIcon } from "@mantine/core";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export interface PanelSplitterProps {
  side: "left" | "right";
  width: number;
  onResize: (newWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  expandTooltip?: string;
  collapseTooltip?: string;
}

export default function PanelSplitter({
  side,
  width,
  onResize,
  minWidth = 220,
  maxWidth = 680,
  defaultWidth = 320,
  collapsed = false,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  expandTooltip = "展开面板",
  collapseTooltip = "收起面板 (双击手柄恢复默认宽度)",
}: PanelSplitterProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: width });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      onDragStart?.();
      dragInfoRef.current = { startX: e.clientX, startWidth: width };
    },
    [width, onDragStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = side === "right" ? dragInfoRef.current.startX - e.clientX : e.clientX - dragInfoRef.current.startX;
      const clamped = Math.max(minWidth, Math.min(maxWidth, dragInfoRef.current.startWidth + deltaX));
      onResize(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
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
  }, [isDragging, side, minWidth, maxWidth, onResize, onDragEnd]);

  if (collapsed) {
    const isRight = side === "right";
    return (
      <Flex
        w={24}
        h="100%"
        direction="column"
        align="center"
        justify={isRight ? "flex-start" : "center"}
        pt={isRight ? 12 : 0}
        bg="#f8fafc"
        style={{
          borderLeft: isRight ? "1px solid #e2e8f0" : undefined,
          borderRight: isRight ? undefined : "1px solid #e2e8f0",
          zIndex: 25,
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={onToggleCollapse}
      >
        <Tooltip label={expandTooltip} position={isRight ? "left" : "right"} withArrow>
          <ActionIcon size="xs" variant="subtle" color="gray">
            {isRight ? <FiChevronLeft size={13} /> : <FiChevronRight size={13} />}
          </ActionIcon>
        </Tooltip>
      </Flex>
    );
  }

  const active = isHovered || isDragging;
  const isRight = side === "right";

  return (
    <Flex
      pos="relative"
      w={8}
      h="100%"
      align="center"
      justify="center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onResize(defaultWidth)}
      style={{ cursor: "col-resize", zIndex: 30, margin: "0 -4px", flexShrink: 0, userSelect: "none" }}
    >
      <Box
        w={active ? 2 : 1}
        h="100%"
        bg={isDragging ? "#0284c7" : isHovered ? "#38bdf8" : "#e2e8f0"}
        style={{
          transition: isDragging ? "none" : "all 0.15s ease",
          boxShadow: active ? "0 0 6px rgba(14, 165, 233, 0.4)" : "none",
        }}
      />

      <Flex
        pos="absolute"
        direction="column"
        align="center"
        gap={2}
        px={2}
        py={8}
        bdrs={4}
        bg={active ? "#ffffff" : "transparent"}
        bd={active ? "1px solid #cbd5e1" : "none"}
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          boxShadow: active ? "0 2px 6px rgba(0, 0, 0, 0.08)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        <Box w={3} h={3} bdrs="50%" bg={active ? "#0284c7" : "#94a3b8"} />
        <Box w={3} h={3} bdrs="50%" bg={active ? "#0284c7" : "#94a3b8"} />
        <Box w={3} h={3} bdrs="50%" bg={active ? "#0284c7" : "#94a3b8"} />

        {active && onToggleCollapse && (
          <Flex
            mt={4}
            align="center"
            justify="center"
            c="#64748b"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            <Tooltip label={collapseTooltip} position={isRight ? "left" : "right"} withArrow fz={11}>
              <ActionIcon size={14} variant="transparent" color="gray">
                {isRight ? <FiChevronRight size={12} /> : <FiChevronLeft size={12} />}
              </ActionIcon>
            </Tooltip>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
