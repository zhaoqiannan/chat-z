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
 * Cloudflare Workers AI 目前最新且长期支持的稳定文本生成模型候选序列
 */
const CANDIDATE_MODELS = [
  "@cf/qwen/qwen3.8-27b",
  "@cf/deepseek-ai/deepseek-v4-pro-0813",
  "@cf/deepseek-ai/deepseek-v4-flash-0731",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-20b",
];

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
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  const data: any = await response.json();
  if (!response.ok || !data.success) {
    const errorDetails = data?.errors?.map((e: any) => `${e.code}: ${e.message}`).join("; ") || response.statusText;
    throw new Error(`REST API 错误 (${response.status}): ${errorDetails}`);
  }

  if (data.result) {
    // 1. OpenAI 格式 choices[0].message.content (Qwen 3.8 / DeepSeek 等新模型格式)
    if (Array.isArray(data.result.choices) && data.result.choices.length > 0) {
      const msgContent = data.result.choices[0]?.message?.content;
      if (typeof msgContent === "string" && msgContent.trim()) {
        return msgContent.trim();
      }
    }

    // 2. Cloudflare 原生 response 字段
    if (typeof data.result.response === "string" && data.result.response.trim()) {
      return data.result.response.trim();
    }

    // 3. 直接返回字符串
    if (typeof data.result === "string" && data.result.trim()) {
      return data.result.trim();
    }
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
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const modelsToTry = options.model
    ? [options.model, ...CANDIDATE_MODELS.filter((m) => m !== options.model)]
    : CANDIDATE_MODELS;

  const errors: string[] = [];

  for (const model of modelsToTry) {
    // 1. 优先尝试本地/线上的 env.AI 原生绑定
    if (envAi && typeof envAi.run === "function") {
      try {
        const res = await envAi.run(model, {
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
        });

        if (res && typeof res.response === "string" && res.response.trim()) {
          return res.response.trim();
        }
        if (res && typeof res === "string" && res.trim()) {
          return res.trim();
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[Workers AI env.AI] 模型 ${model} 执行异常:`, errMsg);
        errors.push(`[env.AI ${model}]: ${errMsg}`);
      }
    }

    // 2. 如果 env.AI 失败或本地未完全模拟，尝试 REST API (若配置了 Account ID 与 API Token)
    if (accountId && apiToken) {
      try {
        const restRes = await callCloudflareAiViaRest(accountId, apiToken, model, messages, options);
        if (restRes) {
          return restRes;
        }
      } catch (restErr: any) {
        const errMsg = restErr?.message || String(restErr);
        console.warn(`[Workers AI REST] 模型 ${model} 执行异常:`, errMsg);
        errors.push(`[REST ${model}]: ${errMsg}`);
      }
    }
  }

  if (!envAi && (!accountId || !apiToken)) {
    throw new Error(
      "未检测到可用的 Cloudflare AI 运行环境。在本地开发时，请在 .env.local 中配置 CLOUDFLARE_ACCOUNT_ID 与 CLOUDFLARE_API_TOKEN，或在 Cloudflare 上线环境中运行。"
    );
  }

  throw new Error(`Workers AI 推理失败:\n${errors.join("\n")}`);
}

/**
 * 自动修复不完整/被截断的 JSON 字符串
 */
function repairTruncatedJson(jsonStr: string): string {
  let str = cleanJsonString(jsonStr);

  // 如果字符串以未闭合的键值对或截断字段结束，回退到最后一个完整键值对
  const lastCommaIndex = str.lastIndexOf(",");
  const lastCloseBrace = str.lastIndexOf("}");
  const lastCloseBracket = str.lastIndexOf("]");
  const maxClose = Math.max(lastCloseBrace, lastCloseBracket);

  // 如果最后一段是未闭合的属性（在最后的大括号闭合之后），尝试安全截断到最后一个闭合对象
  if (maxClose > 0 && maxClose > lastCommaIndex && maxClose > str.length - 80) {
    str = str.substring(0, maxClose + 1);
  }

  // 统计未闭合的引号、括号
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\\" && inString) {
      isEscaped = !isEscaped;
      continue;
    }
    if (char === '"' && !isEscaped) {
      inString = !inString;
    } else if (!inString) {
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

  // 如果字符串处于未闭合的双引号中，先闭合双引号
  if (inString) {
    str += '"';
  }

  // 移除尾部悬空逗号
  str = str.replace(/,\s*$/, "");

  // 按照栈顺序逆序闭合所有未闭合的括号
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
 * 从 AI 生成的自然语言或 Markdown 文本中提取并解析出合法的 JSON 结构（具备自动截断修复能力）
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
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    const candidate = cleanJsonString(jsonBlockMatch[1]);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const repaired = repairTruncatedJson(candidate);
        return JSON.parse(repaired);
      } catch {}
    }
  }

  // 3. 尝试匹配首个 [ ... ] (数组优先)
  const firstBracket = text.indexOf("[");
  if (firstBracket !== -1) {
    const subStr = text.substring(firstBracket);
    try {
      const repaired = repairTruncatedJson(subStr);
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T;
      }
    } catch {}
  }

  // 4. 尝试匹配首个 { ... } (对象)
  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    const subStr = text.substring(firstBrace);
    try {
      const repaired = repairTruncatedJson(subStr);
      return JSON.parse(repaired);
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
