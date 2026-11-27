import dayjs from "dayjs";

/**
 * 统一剥离富文本 HTML 标签，输出纯文本（用于世界观规则、素材注入 AI 上下文，彻底杜绝 HTML 污染 Prompt）
 */
export function stripHtml(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 统一中文字数统计（排除全部空白字符）
 */
export function countWords(text?: string | null): number {
  return (text || "").replace(/\s+/g, "").length;
}

/**
 * 统一时间格式化（复用 dayjs，替代全站手写 padStart 与混用 toLocaleString）
 */
export function formatDateTime(val?: string | number | Date | null, pattern = "YYYY-MM-DD HH:mm"): string {
  if (!val) return "--";
  const d = dayjs(val);
  return d.isValid() ? d.format(pattern) : "--";
}

/**
 * 统一解析章节范围字符串（如 "1-20"、"第5章"、"12~18"）
 */
export function parseChapterRange(raw?: string | null): { start: number; end: number } | null {
  const clean = (raw || "").trim();
  if (!clean) return null;
  const nums = clean.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  const start = Number(nums[0]);
  const end = nums.length >= 2 ? Math.max(start, Number(nums[1])) : start;
  if (!Number.isFinite(start) || start <= 0) return null;
  return { start, end };
}

/**
 * 统一剪贴板复制（含旧浏览器 execCommand 降级）
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    }
    return false;
  } catch {
    return false;
  }
}
