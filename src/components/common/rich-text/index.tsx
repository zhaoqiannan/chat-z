// 公共组件：富文本编辑器与统一回显组件（支持排版工具、预设/自定义表格、图片上传、链接与自适应渲染）
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  ActionIcon,
  Paper,
  Divider,
  Group,
  Tooltip,
  Menu,
  Modal,
  TextInput,
  NumberInput,
} from "@mantine/core";
import {
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
  FiGrid,
  FiImage,
  FiLink,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiType,
  FiMinus,
  FiTrash2,
  FiMaximize2,
  FiExternalLink,
} from "react-icons/fi";
import { uploadImageFile } from "@/rest/world";
import { useAlert } from "@/hooks/useAlert";

// ============================================================================
// 1. 富文本回显组件 (RichTextViewer)
// ============================================================================
export interface RichTextViewerProps {
  content?: string | null;
  emptyText?: string;
  maxHeight?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

export function RichTextViewer({
  content,
  emptyText = "暂无详细内容",
  maxHeight,
  style,
  className,
}: RichTextViewerProps) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  if (!content || !content.trim()) {
    return (
      <Box style={{ padding: "16px 0", textAlign: "center", ...style }}>
        <Text fz={12.5} c="#94a3b8" style={{ fontStyle: "italic" }}>
          {emptyText}
        </Text>
      </Box>
    );
  }

  // 点击图片进行全屏大图预览
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const src = target.getAttribute("src");
      if (src) {
        setPreviewImageUrl(src);
      }
    }
  };

  return (
    <>
      <Box
        className={`rich-text-content ${className || ""}`}
        onClick={handleContainerClick}
        style={{
          fontSize: 13.5,
          lineHeight: 1.75,
          color: "#334155",
          wordBreak: "break-word",
          maxHeight: maxHeight || "none",
          overflowY: maxHeight ? "auto" : "visible",
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* 图片全屏放大预览 Modal */}
      <Modal
        opened={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        size="auto"
        centered
        withCloseButton
        padding="sm"
        title={
          <Text fz={13} fw={600} c="#475569">
            图片预览
          </Text>
        }
      >
        {previewImageUrl && (
          <Box style={{ textAlign: "center", maxWidth: "85vw", maxHeight: "80vh" }}>
            <Box
              component="img"
              src={previewImageUrl}
              alt="插图预览"
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: 6,
              }}
            />
          </Box>
        )}
      </Modal>

      <RichTextStyleInjector />
    </>
  );
}

// ============================================================================
// 2. 富文本编辑器组件 (RichTextEditor)
// ============================================================================
export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  showTables?: boolean;
  showImages?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "请输入详细内容、设定规则或排版数据...",
  minHeight = 260,
  maxHeight = 480,
  showTables = true,
  showImages = true,
  disabled = false,
  style,
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 自定义表格弹窗
  const [tableModalOpened, setTableModalOpened] = useState(false);
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);

  // 外部 value 同步到 DOM
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // 避免输入过程中光标重置
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === "<p><br></p>" || html === "<br>" ? "" : html);
    }
  };

  const execCmd = (command: string, val: string = "") => {
    if (disabled) return;
    document.execCommand(command, false, val);
    handleInput();
  };

  const insertHtmlAtCursor = (html: string) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement("div");
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      let lastNode: ChildNode | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += html;
    }
    handleInput();
  };

  // 预设表格插入
  const handleInsertPresetTable = (type: "currency" | "levels" | "generic") => {
    let tableHtml = "";
    if (type === "currency") {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">货币名称</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">换算比例</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">购买力参考</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">铜钱 (文)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1 铜钱</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1个大烧饼 / 粗茶一壶</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">白银 (两)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1两 = 1,000 铜钱</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">寻常三口之家一月用度</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">黄金 (两)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1两 = 10 两白银</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">京城上好绸缎一匹 / 凡品战刀</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">灵石 (初品)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1枚 = 100 两黄金</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">炼气期修士修炼基础资源</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    } else if (type === "levels") {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">阶位等级</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">寿元上限</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">核心能力特征</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">突破瓶颈/代价</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">一阶 · 炼体期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">肉身坚如磐石，千斤巨力</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">需经脉筑基丹破关</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">二阶 · 筑基期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">二百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">气海化液，可御空滑翔</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">遭遇心魔反噬风险</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">三阶 · 金丹期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">五百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">丹碎成婴，引天地雷劫</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">需渡九重天雷劫</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    } else {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">属性维度</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">数值/设定标准</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">备注说明</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">参数 1</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">标准数值</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">适用全局设定</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">参数 2</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">高阶标准</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">仅限专属势力</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    }
    insertHtmlAtCursor(tableHtml);
  };

  // 自定义表格生成
  const handleCreateCustomTable = () => {
    const rows = Math.max(1, Math.min(20, tableRows));
    const cols = Math.max(1, Math.min(10, tableCols));

    let html = `<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;"><thead><tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">`;
    for (let c = 1; c <= cols; c++) {
      html += `<th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">表头 ${c}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      const bg = r % 2 === 0 ? "background-color:#f8fafc;" : "";
      html += `<tr style="${bg}">`;
      for (let c = 1; c <= cols; c++) {
        html += `<td style="padding:8px 12px; border:1px solid #cbd5e1;">数据 ${r}-${c}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table><p><br></p>`;

    insertHtmlAtCursor(html);
    setTableModalOpened(false);
  };

  // 上传图片并插入
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        insertHtmlAtCursor(
          `<p><img src="${res.url}" alt="插图" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid #e2e8f0;" /></p><p><br></p>`
        );
        useAlert.success("图片插入成功");
      } else {
        useAlert.error("图片上传失败: " + (res?.message || "网络异常"));
      }
    } catch (err: any) {
      useAlert.error("上传图片异常: " + (err?.message || "网络错误"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  return (
    <Box className={`rich-text-editor-wrap ${className || ""}`} style={{ ...style }}>
      {/* 隐藏的图片上传 input */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleUploadImage}
      />

      {/* 顶部排版工具栏 */}
      <Paper
        p="xs"
        bg="#f8fafc"
        withBorder
        radius="sm"
        mb={6}
        style={{
          borderColor: "#e2e8f0",
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        <Flex gap={4} wrap="wrap" align="center">
          {/* 标题下拉菜单 */}
          <Menu shadow="md" width={130}>
            <Menu.Target>
              <Button size="compact-xs" variant="subtle" color="gray" leftSection={<FiType size={12} />}>
                段落标题
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => execCmd("formatBlock", "<h1>")}>
                <Text fw={700} fz={15}>一级大标题</Text>
              </Menu.Item>
              <Menu.Item onClick={() => execCmd("formatBlock", "<h2>")}>
                <Text fw={700} fz={14}>二级标题</Text>
              </Menu.Item>
              <Menu.Item onClick={() => execCmd("formatBlock", "<h3>")}>
                <Text fw={600} fz={13}>三级小标题</Text>
              </Menu.Item>
              <Menu.Item onClick={() => execCmd("formatBlock", "<p>")}>
                <Text fz={12}>正文段落</Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Divider orientation="vertical" mx={2} />

          {/* 基础排版 */}
          <Tooltip label="加粗 (Ctrl+B)" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("bold")}>
              <FiBold size={13} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="斜体 (Ctrl+I)" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("italic")}>
              <FiItalic size={13} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="下划线 (Ctrl+U)" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("underline")}>
              <FiUnderline size={13} />
            </ActionIcon>
          </Tooltip>

          <Divider orientation="vertical" mx={2} />

          {/* 对齐与列表 */}
          <Tooltip label="左对齐" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("justifyLeft")}>
              <FiAlignLeft size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="居中对齐" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("justifyCenter")}>
              <FiAlignCenter size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="右对齐" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("justifyRight")}>
              <FiAlignRight size={13} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="无序列表" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("insertUnorderedList")}>
              <FiList size={13} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="分割线" position="top">
            <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("insertHorizontalRule")}>
              <FiMinus size={13} />
            </ActionIcon>
          </Tooltip>

          {/* 表格工具组 */}
          {showTables && (
            <>
              <Divider orientation="vertical" mx={2} />
              <Menu shadow="md" width={180}>
                <Menu.Target>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="blue"
                    leftSection={<FiGrid size={11} />}
                  >
                    + 插入表格
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>设定预设表格</Menu.Label>
                  <Menu.Item onClick={() => handleInsertPresetTable("currency")}>
                    💰 货币汇率表
                  </Menu.Item>
                  <Menu.Item onClick={() => handleInsertPresetTable("levels")}>
                    ⚡ 境界阶梯表
                  </Menu.Item>
                  <Menu.Item onClick={() => handleInsertPresetTable("generic")}>
                    📊 通用数据表
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item onClick={() => setTableModalOpened(true)}>
                    📐 自定义行与列...
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </>
          )}

          {/* 插入图片 */}
          {showImages && (
            <>
              <Divider orientation="vertical" mx={2} />
              <Button
                size="compact-xs"
                variant="light"
                color="teal"
                leftSection={<FiImage size={11} />}
                loading={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                插入图片
              </Button>
            </>
          )}

          <Divider orientation="vertical" mx={2} />

          <Tooltip label="清除格式" position="top">
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => execCmd("removeFormat")}>
              <FiTrash2 size={12} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      </Paper>

      {/* 可编辑容器 */}
      <Box
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="rich-text-content"
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight,
          maxHeight,
          overflowY: "auto",
          padding: "12px 14px",
          border: "1px solid #cbd5e1",
          borderRadius: 6,
          backgroundColor: disabled ? "#f8fafc" : "#ffffff",
          fontSize: 13.5,
          lineHeight: 1.75,
          color: "#1e293b",
          outline: "none",
          position: "relative",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {/* 自定义表格弹窗 */}
      <Modal
        opened={tableModalOpened}
        onClose={() => setTableModalOpened(false)}
        title="插入自定义表格"
        size="xs"
        centered
      >
        <Flex direction="column" gap="sm">
          <NumberInput
            label="表格行数 (数据行)"
            size="xs"
            min={1}
            max={20}
            value={tableRows}
            onChange={(val) => setTableRows(Number(val) || 3)}
          />
          <NumberInput
            label="表格列数"
            size="xs"
            min={1}
            max={10}
            value={tableCols}
            onChange={(val) => setTableCols(Number(val) || 3)}
          />
          <Flex justify="flex-end" gap="xs" mt="sm">
            <Button size="xs" variant="default" onClick={() => setTableModalOpened(false)}>
              取消
            </Button>
            <Button size="xs" onClick={handleCreateCustomTable}>
              确认插入
            </Button>
          </Flex>
        </Flex>
      </Modal>

      <RichTextStyleInjector />
    </Box>
  );
}

// ============================================================================
// 3. 统一全局样式注入器
// ============================================================================
function RichTextStyleInjector() {
  return (
    <style jsx global>{`
      .rich-text-content {
        word-break: break-word;
      }
      .rich-text-content:empty:before {
        content: attr(data-placeholder);
        color: #94a3b8;
        pointer-events: none;
      }
      .rich-text-content h1 {
        font-size: 1.35em;
        font-weight: 800;
        margin: 12px 0 6px;
        color: #0f172a;
      }
      .rich-text-content h2 {
        font-size: 1.2em;
        font-weight: 700;
        margin: 10px 0 5px;
        color: #1e293b;
      }
      .rich-text-content h3 {
        font-size: 1.05em;
        font-weight: 600;
        margin: 8px 0 4px;
        color: #334155;
      }
      .rich-text-content p {
        margin: 0 0 8px;
      }
      .rich-text-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 13px;
      }
      .rich-text-content th,
      .rich-text-content td {
        border: 1px solid #e2e8f0;
        padding: 8px 12px;
        text-align: left;
      }
      .rich-text-content th {
        background-color: #f8fafc;
        font-weight: 700;
        color: #334155;
      }
      .rich-text-content tr:nth-child(even) td {
        background-color: #fafbfc;
      }
      .rich-text-content img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 8px 0;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .rich-text-content img:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .rich-text-content hr {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 12px 0;
      }
      .rich-text-content ul,
      .rich-text-content ol {
        padding-left: 20px;
        margin: 6px 0 10px;
      }
      .rich-text-content blockquote {
        border-left: 3px solid #0284c7;
        margin: 8px 0;
        padding: 4px 12px;
        color: #475569;
        background-color: #f0f9ff;
        border-radius: 0 4px 4px 0;
      }
    `}</style>
  );
}
