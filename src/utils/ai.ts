/**
 * Cloudflare Workers AI 大模型调用与结构化数据提取工具库
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallOptions {
  model?: string;
  taskType?: "creative" | "structured" | "fast";
  temperature?: number;
  maxTokens?: number;
}

/**
 * Cloudflare Workers AI 活跃文本生成模型候选序列（2026-11 更新）
 * - 已移除 2026-11-20 下线的 deepseek-r1-distill-qwen-32b 与拼写不完整的 llama-3.3-70b-instruct
 * - 优先选用 Free 计划 10,000 Neurons/天 额度内性价比高、中文与指令遵循强的活跃模型
 */
const CREATIVE_MODELS = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/qwen/qwen3.8-27b",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/qwen/qwen2.5-7b-instruct",
];

const STRUCTURED_MODELS = [
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/zai-org/glm-4.7-flash",
  "@cf/qwen/qwen3.8-27b",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/qwen/qwen2.5-7b-instruct",
];

const FAST_MODELS = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/qwen/qwen2.5-7b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
];

function getCandidateModels(options: AiCallOptions): string[] {
  const baseList =
    options.taskType === "structured"
      ? STRUCTURED_MODELS
      : options.taskType === "fast"
        ? FAST_MODELS
        : CREATIVE_MODELS;

  const envModel = process.env.CF_AI_MODEL?.trim();
  const preferred = options.model?.trim() || envModel;
  if (preferred) {
    return [preferred, ...baseList.filter((m) => m !== preferred)];
  }
  return baseList;
}

/**
 * 统一提取 Workers AI 返回文本（兼容 OpenAI choices 格式与 Cloudflare 原生 response 格式）
 */
function extractAiText(result: any): string | null {
  if (!result) return null;

  // 1. OpenAI 兼容格式 choices[0].message (优先使用 content，兜底 reasoning)
  if (Array.isArray(result.choices) && result.choices.length > 0) {
    const msg = result.choices[0]?.message;
    if (typeof msg?.content === "string" && msg.content.trim()) {
      return msg.content.trim();
    }
    if (typeof msg?.reasoning_content === "string" && msg.reasoning_content.trim()) {
      return msg.reasoning_content.trim();
    }
    if (typeof msg?.reasoning === "string" && msg.reasoning.trim()) {
      return msg.reasoning.trim();
    }
  }

  // 2. Cloudflare 原生 response 字段
  if (typeof result.response === "string" && result.response.trim()) {
    return result.response.trim();
  }

  // 3. 直接返回字符串
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }

  return null;
}

/**
 * 通过官方 REST API 直接调用 Cloudflare Workers AI（用于本地开发或未绑定原生环境时）
 */
async function callCloudflareAiViaRest(
  accountId: string,
  apiToken: string,
  model: string,
  messages: ChatMessage[],
  options: AiCallOptions
): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8192,
    }),
    signal: AbortSignal.timeout(120000), // 120 秒充裕超时
  });

  const data: any = await response.json();
  if (!response.ok || !data.success) {
    const errorDetails = data?.errors?.map((e: any) => `${e.code}: ${e.message}`).join("; ") || response.statusText;
    throw new Error(`REST API 错误 (${response.status}): ${errorDetails}`);
  }

  const extracted = extractAiText(data.result);
  if (extracted) {
    return extracted;
  }

  throw new Error(`AI REST API 返回了未知结构: ${JSON.stringify(data.result || data)}`);
}

/**
 * 调用 Cloudflare Workers AI 运行大模型推理（支持 env.AI 原生与 REST API 双轨容灾，及多模型自动重试）
 */
export async function callCloudflareAi(
  envAi: any,
  messages: ChatMessage[],
  options: AiCallOptions = {}
): Promise<string> {
  const accountId = process.env.CF_AI_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CF_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  const modelsToTry = getCandidateModels(options);
  const errors: string[] = [];

  for (const model of modelsToTry) {
    // 1. 若配置了 Token（本地开发模式），优先走官方 REST API 直连（支持 120s 超时，避免 Miniflare 本地 15s 超时截断）
    if (accountId && apiToken) {
      try {
        const restRes = await callCloudflareAiViaRest(accountId, apiToken, model, messages, options);
        if (restRes) {
          console.log(`[Workers AI] 命中模型: ${model} (通道: REST, 任务: ${options.taskType || "creative"})`);
          return restRes;
        }
      } catch (restErr: any) {
        const errMsg = restErr?.message || String(restErr);
        console.warn(`[Workers AI REST] 模型 ${model} 执行异常:`, errMsg);
        errors.push(`[REST ${model}]: ${errMsg}`);
      }
    }

    // 2. 线上环境或未配置 Token 时，使用 env.AI 原生绑定通道
    if (envAi && typeof envAi.run === "function") {
      try {
        const res = await envAi.run(model, {
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
        });

        const extracted = extractAiText(res);
        if (extracted) {
          console.log(`[Workers AI] 命中模型: ${model} (通道: env.AI, 任务: ${options.taskType || "creative"})`);
          return extracted;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[Workers AI env.AI] 模型 ${model} 执行异常:`, errMsg);
        errors.push(`[env.AI ${model}]: ${errMsg}`);
      }
    }
  }

  if (!envAi && (!accountId || !apiToken)) {
    throw new Error(
      "未检测到可用的 Cloudflare AI 运行环境。在本地开发时，请在 .env.local 中配置 CF_AI_ACCOUNT_ID 与 CF_AI_API_TOKEN，或在 Cloudflare 上线环境中运行。"
    );
  }

  throw new Error(`Workers AI 推理失败:\n${errors.join("\n")}`);
}

/**
 * 自动修复不完整/被截断的 JSON 字符串（处理控制字符、未闭合键值与括号栈）
 */
function repairTruncatedJson(jsonStr: string): string {
  const strClean = cleanJsonString(jsonStr);

  // 1. 转义未转义的字符串内部控制字符（换行/制表符）
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let sanitized = "";

  for (let i = 0; i < strClean.length; i++) {
    const char = strClean[i];
    if (char === "\\" && inString) {
      isEscaped = !isEscaped;
      sanitized += char;
      continue;
    }
    if (char === '"' && !isEscaped) {
      inString = !inString;
      sanitized += char;
    } else if (inString) {
      if (char === "\n") sanitized += "\\n";
      else if (char === "\r") sanitized += "\\r";
      else if (char === "\t") sanitized += "\\t";
      else sanitized += char;
    } else {
      sanitized += char;
      if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}" && stack[stack.length - 1] === "{") {
        stack.pop();
      } else if (char === "]" && stack[stack.length - 1] === "[") {
        stack.pop();
      }
    }
    isEscaped = false;
  }

  let str = sanitized;

  // 2. 如果截断在未闭合的字符串中，先闭合双引号
  if (inString) {
    str += '"';
  }

  // 3. 检查末尾是否截断在冒号后例如 "key": 
  if (/:\s*$/.test(str)) {
    str += '""';
  }

  // 4. 移除尾随悬空逗号
  str = str.replace(/,\s*$/, "");

  // 5. 按照栈顺序逆序闭合所有未闭合的括号
  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === "{") {
      str += "}";
    } else if (openChar === "[") {
      str += "]";
    }
  }

  return str;
}

/**
 * 针对数组或对象结果进行规范化包装提取
 */
function normalizeResult<T>(parsed: any, fallbackValue: T): T {
  if (Array.isArray(fallbackValue)) {
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        ...item,
        children: Array.isArray(item.children) ? item.children : [],
      })) as unknown as T;
    }
    if (parsed && typeof parsed === "object") {
      const arr =
        parsed.volumes ||
        parsed.outline ||
        parsed.tree ||
        parsed.data ||
        parsed.list ||
        parsed.result ||
        parsed.chapters ||
        parsed.scenes;
      if (Array.isArray(arr)) {
        return arr.map((item) => ({
          ...item,
          children: Array.isArray(item.children) ? item.children : [],
        })) as unknown as T;
      }
      return [parsed] as unknown as T;
    }
  }
  return parsed as T;
}

/**
 * 从 AI 生成的自然语言或 Markdown 文本中提取并解析出合法的 JSON 结构（具备自动截断修复能力）
 */
export function parseStructuredJson<T>(rawText: string, fallbackValue: T): T {
  if (!rawText || !rawText.trim()) {
    return fallbackValue;
  }

  // 先剥离模型可能附带的思考链标签，避免思考过程中出现的花括号干扰 JSON 提取
  const text = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();

  if (!text) {
    return fallbackValue;
  }

  // 准备候选解析文本序列
  const candidates: string[] = [text];

  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    candidates.unshift(jsonBlockMatch[1].trim());
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1) {
    if (lastBracket > firstBracket) {
      candidates.push(text.substring(firstBracket, lastBracket + 1));
    }
    candidates.push(text.substring(firstBracket));
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1) {
    if (lastBrace > firstBrace) {
      candidates.push(text.substring(firstBrace, lastBrace + 1));
    }
    candidates.push(text.substring(firstBrace));
  }

  for (const raw of candidates) {
    // 1. 直接解析
    try {
      const parsed = JSON.parse(raw);
      return normalizeResult(parsed, fallbackValue);
    } catch {
      // 2. 清理注释/尾随逗号后解析
      try {
        const cleaned = cleanJsonString(raw);
        const parsed = JSON.parse(cleaned);
        return normalizeResult(parsed, fallbackValue);
      } catch {
        // 3. 自动修复截断后解析
        try {
          const repaired = repairTruncatedJson(raw);
          const parsed = JSON.parse(repaired);
          return normalizeResult(parsed, fallbackValue);
        } catch {}
      }
    }
  }

  return fallbackValue;
}

/**
 * 专用于分析/问答模式（critique / chat）的轻度清洗：
 * 仅剥离 <think>/<thought> 思考链标签，完整保留 Markdown 标题、列表与总结内容
 */
export function cleanAnalysisText(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  return rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();
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

/**
 * 智能提取纯净的小说正文文本（自动剥离 AI 思考链、大纲分析、任务构思、草稿标记与字数元数据）
 */
export function cleanNovelStoryText(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  let text = rawText.trim();

  // 1. 彻底剥离可能存在的 <think>...</think> 或 <thought>...</thought> 思考链标签
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

  // 2. 剥离外层包裹的 Markdown 代码块标签
  const codeBlockMatch = text.match(/^```(?:markdown|text)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 3. 如果包含明确的正文起止锚点，直接提取正文部分
  const splitKeywords = [
    /【(?:润色版正文|润色版|润色正文|润色替换稿|润色稿|修改后正文|修改后|扩写正文|续写正文|正文开始|正文)】/i,
    /(?:正文如下|正式正文|最终正文|最终定稿|润色稿|润色版)[：:]/i,
    /【第\d+章[^】\n]*】\n+/i,
  ];

  for (const pattern of splitKeywords) {
    const matches = text.split(pattern);
    if (matches.length > 1) {
      const lastCandidate = matches[matches.length - 1].trim();
      if (lastCandidate.length > 30) {
        text = lastCandidate;
      }
    }
  }

  // 4. 剥离模型开头可能遗留的任务分析与思考构思段落（如“任务：智能润色... 需要考虑：... 让我们构思润色稿：...”）
  const metaBlockPattern = /^(?:任务[：:][\s\S]*?)(?=(?:\n\n[“"‘'第]|(?:\n\n[\u4e00-\u9fa5]{2,}[，。、“"”]))|$)/i;
  if (metaBlockPattern.test(text)) {
    const afterMeta = text.replace(metaBlockPattern, "").trim();
    if (afterMeta.length > 30) {
      text = afterMeta;
    }
  }

  // 5. 逐行剥离常见的思考与引导前缀
  const lines = text.split("\n");
  let startIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (
      line.startsWith("任务：") ||
      line.startsWith("任务:") ||
      line.startsWith("需要考虑：") ||
      line.startsWith("需要考虑:") ||
      line.startsWith("思考过程") ||
      line.startsWith("思考：") ||
      line.startsWith("构思：") ||
      line.startsWith("让我们构思") ||
      line.startsWith("我们需要") ||
      line.startsWith("用户要求") ||
      line.startsWith("字数估算") ||
      line.startsWith("好的，") ||
      line.startsWith("以下是") ||
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      line.startsWith("```")
    ) {
      startIndex = i + 1;
    } else {
      break;
    }
  }

  if (startIndex > 0 && startIndex < lines.length) {
    text = lines.slice(startIndex).join("\n").trim();
  }

  // 6. 移除开头的引导短语如 "可写："、"正文："、"剧情："、"润色后正文："
  text = text.replace(/^(?:可写[：:]|正文[：:]|剧情[：:]|故事[：:]|润色(?:后|版)?[：:]|修改后[：:])\s*/i, "");

  // 7. 剥离文末的分析总结、优化重点与字数说明
  const endPattern = /\n+(?:【(?:主要优化点|优化重点|修改说明|创作思路|字数统计)】|(?:主要优化点|优化重点|修改说明|字数估算|字数统计|总结|以上是|注)[：:])[\s\S]*$/i;
  text = text.replace(endPattern, "").trim();

  return text;
}
