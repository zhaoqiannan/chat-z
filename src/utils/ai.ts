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
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.2-3b-instruct",
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
      max_tokens: options.maxTokens ?? 8192,
    }),
    signal: AbortSignal.timeout(120000), // 120 秒充裕超时
  });

  const data: any = await response.json();
  if (!response.ok || !data.success) {
    const errorDetails = data?.errors?.map((e: any) => `${e.code}: ${e.message}`).join("; ") || response.statusText;
    throw new Error(`REST API 错误 (${response.status}): ${errorDetails}`);
  }

  if (data.result) {
    // 1. OpenAI 兼容格式 choices[0].message (支持 content 与 reasoning 字段)
    if (Array.isArray(data.result.choices) && data.result.choices.length > 0) {
      const msg = data.result.choices[0]?.message;
      const msgContent = msg?.content;
      if (typeof msgContent === "string" && msgContent.trim()) {
        return msgContent.trim();
      }
      const msgReasoning = msg?.reasoning;
      if (typeof msgReasoning === "string" && msgReasoning.trim()) {
        return msgReasoning.trim();
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
  const accountId = process.env.CF_AI_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CF_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  const modelsToTry = options.model
    ? [options.model, ...CANDIDATE_MODELS.filter((m) => m !== options.model)]
    : CANDIDATE_MODELS;

  const errors: string[] = [];

  for (const model of modelsToTry) {
    // 1. 若配置了 Token（本地开发模式），优先走官方 REST API 直连（支持 120s 超时，避免 Miniflare 本地 15s 超时截断）
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

    // 2. 线上环境或未配置 Token 时，使用 env.AI 原生绑定通道
    if (envAi && typeof envAi.run === "function") {
      try {
        const res = await envAi.run(model, {
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
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

  const text = rawText.trim();

  // 准备候选解析文本序列
  const candidates: string[] = [text];

  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    candidates.unshift(jsonBlockMatch[1]);
  }

  const firstBracket = text.indexOf("[");
  if (firstBracket !== -1) {
    candidates.push(text.substring(firstBracket));
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    candidates.push(text.substring(firstBrace));
  }

  for (const raw of candidates) {
    // 1. 直接解析
    try {
      const parsed = JSON.parse(raw);
      return normalizeResult(parsed, fallbackValue);
    } catch {
      // 2. 自动修复截断后解析
      try {
        const repaired = repairTruncatedJson(raw);
        const parsed = JSON.parse(repaired);
        return normalizeResult(parsed, fallbackValue);
      } catch {}
    }
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
