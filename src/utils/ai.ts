/**
 * Cloudflare Workers AI 大模型调用与结构化数据提取工具库
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 默认推荐的中文能力极强的开源模型
 */
const DEFAULT_MODEL = "@cf/qwen/qwen2.5-72b-instruct";
const FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct";

/**
 * 调用 Cloudflare Workers AI 运行大模型推理
 */
export async function callCloudflareAi(
  envAi: any,
  messages: ChatMessage[],
  options: AiCallOptions = {}
): Promise<string> {
  const model = options.model || DEFAULT_MODEL;

  if (!envAi || typeof envAi.run !== "function") {
    throw new Error("Cloudflare Workers AI 运行环境未就绪或未绑定 AI 实例");
  }

  try {
    const res = await envAi.run(model, {
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    if (res && typeof res.response === "string" && res.response.trim()) {
      return res.response.trim();
    }
    if (res && typeof res === "string" && res.trim()) {
      return res.trim();
    }
  } catch (err: any) {
    console.warn(`[Workers AI] 主模型 ${model} 调用失败，尝试备用模型:`, err?.message);
    try {
      const fallbackRes = await envAi.run(FALLBACK_MODEL, {
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      });
      if (fallbackRes && typeof fallbackRes.response === "string" && fallbackRes.response.trim()) {
        return fallbackRes.response.trim();
      }
    } catch (fallbackErr: any) {
      throw new Error(`Workers AI 推理失败: ${fallbackErr?.message || err?.message || "未知错误"}`);
    }
  }

  throw new Error("AI 模型未返回有效生成内容，请稍后重试");
}

/**
 * 从 AI 生成的自然语言或 Markdown 文本中提取并解析出合法的 JSON 结构
 */
export function parseStructuredJson<T>(rawText: string, fallbackValue: T): T {
  if (!rawText || !rawText.trim()) {
    return fallbackValue;
  }

  const text = rawText.trim();

  // 1. 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {}

  // 2. 尝试提取 ```json ... ``` 块
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const cleanStr = cleanJsonString(jsonBlockMatch[1]);
      return JSON.parse(cleanStr);
    } catch {}
  }

  // 3. 尝试匹配首个 { ... } 或 [ ... ]
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonSub = cleanJsonString(text.substring(firstBrace, lastBrace + 1));
      return JSON.parse(jsonSub);
    } catch {}
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const jsonSub = cleanJsonString(text.substring(firstBracket, lastBracket + 1));
      return JSON.parse(jsonSub);
    } catch {}
  }

  return fallbackValue;
}

/**
 * 清理 JSON 字符串中常见的尾随逗号、单行注释等非法语法
 */
function cleanJsonString(str: string): string {
  return str
    .replace(/\/\/.*$/gm, "") // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, "") // 移除多行注释
    .replace(/,\s*([\]}])/g, "$1") // 移除尾随逗号 (trailing comma)
    .trim();
}
