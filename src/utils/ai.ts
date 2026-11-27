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
 * 剥离思考模型附带的 <think>/<thought> 标签（兼容已闭合与因截断未闭合的情况）
 */
function stripThinkTags(rawText: string): string {
  return rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<(?:think|thought)>[\s\S]*$/gi, "")
    .trim();
}

/**
 * 统一提取 Workers AI 返回文本（兼容 OpenAI choices 格式与 Cloudflare 原生 response 格式）
 * 严禁把思考独白（reasoning_content/reasoning）当成小说正文直接返回；仅在 structured 模式下尝试抢救完整 JSON 块
 */
function extractAiText(result: any, taskType?: AiCallOptions["taskType"]): string | null {
  if (!result) return null;

  // 1. OpenAI 兼容格式 choices[0].message（优先且默认仅信任 content）
  if (Array.isArray(result.choices) && result.choices.length > 0) {
    const msg = result.choices[0]?.message;
    if (typeof msg?.content === "string" && msg.content.trim()) {
      const cleaned = stripThinkTags(msg.content);
      if (cleaned) return cleaned;
    }
    // 仅当结构化任务且 content 为空时，检查 reasoning 中是否已包含完整 JSON，否则返回 null 触发切换备选模型
    if (taskType === "structured") {
      const reasoning =
        (typeof msg?.reasoning_content === "string" && msg.reasoning_content.trim()) ||
        (typeof msg?.reasoning === "string" && msg.reasoning.trim()) ||
        "";
      const jsonBlock = reasoning.match(/```json\s*([\s\S]*?)```/i);
      if (jsonBlock && jsonBlock[1]?.trim()) {
        return jsonBlock[1].trim();
      }
    }
    return null;
  }

  // 2. Cloudflare 原生 response 字段
  if (typeof result.response === "string" && result.response.trim()) {
    const cleaned = stripThinkTags(result.response);
    return cleaned || null;
  }

  // 3. 直接返回字符串
  if (typeof result === "string" && result.trim()) {
    const cleaned = stripThinkTags(result);
    return cleaned || null;
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

  const extracted = extractAiText(data.result, options.taskType);
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

  const useRest = Boolean(accountId && apiToken);
  const useEnvAi = Boolean(envAi && typeof envAi.run === "function");

  if (!useRest && !useEnvAi) {
    throw new Error(
      "未检测到可用的 Cloudflare AI 运行环境。在本地开发时，请在 .env.local 中配置 CF_AI_ACCOUNT_ID 与 CF_AI_API_TOKEN，或在 Cloudflare 上线环境中运行。"
    );
  }

  for (const model of modelsToTry) {
    // 单模型仅走单一通道，避免同模型 REST + env.AI 重复推理拉长耗时与消耗额度
    if (useRest) {
      try {
        const restRes = await callCloudflareAiViaRest(accountId!, apiToken!, model, messages, options);
        if (restRes) {
          console.log(`[Workers AI] 命中模型: ${model} (通道: REST, 任务: ${options.taskType || "creative"})`);
          return restRes;
        }
      } catch (restErr: any) {
        const errMsg = restErr?.message || String(restErr);
        console.warn(`[Workers AI REST] 模型 ${model} 执行异常:`, errMsg);
        errors.push(`[REST ${model}]: ${errMsg}`);
      }
      continue;
    }

    try {
      const res = await envAi.run(model, {
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
      });

      const extracted = extractAiText(res, options.taskType);
      if (extracted) {
        console.log(`[Workers AI] 命中模型: ${model} (通道: env.AI, 任务: ${options.taskType || "creative"})`);
        return extracted;
      }
      errors.push(`[env.AI ${model}]: 模型返回空内容`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[Workers AI env.AI] 模型 ${model} 执行异常:`, errMsg);
      errors.push(`[env.AI ${model}]: ${errMsg}`);
    }
  }

  throw new Error(`Workers AI 推理失败:\n${errors.join("\n")}`);
}

/**
 * 流式调用 Cloudflare Workers AI（返回原始 ReadableStream<Uint8Array>，供路由转 SSE）
 */
export async function callCloudflareAiStream(
  envAi: any,
  messages: ChatMessage[],
  options: AiCallOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const accountId = process.env.CF_AI_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CF_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const useRest = Boolean(accountId && apiToken);
  const useEnvAi = Boolean(envAi && typeof envAi.run === "function");

  if (!useRest && !useEnvAi) {
    throw new Error("未检测到可用的 Cloudflare AI 运行环境");
  }

  const modelsToTry = getCandidateModels(options);
  const errors: string[] = [];

  for (const model of modelsToTry) {
    try {
      if (useRest) {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (!response.ok || !response.body) {
          throw new Error(`REST stream failed (${response.status})`);
        }
        return response.body;
      }

      const streamRes = await envAi.run(model, {
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
      });
      if (streamRes && typeof streamRes.getReader === "function") {
        return streamRes as ReadableStream<Uint8Array>;
      }
      const extracted = extractAiText(streamRes, options.taskType);
      if (extracted) {
        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: extracted })}\n\ndata: [DONE]\n\n`));
            controller.close();
          },
        });
      }
      errors.push(`[env.AI stream ${model}]: 未返回可读流`);
    } catch (err: any) {
      errors.push(`[stream ${model}]: ${err?.message || String(err)}`);
    }
  }

  throw new Error(`Workers AI 流式推理失败:\n${errors.join("\n")}`);
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
 * 针对数组或对象结果进行规范化包装提取（仅保留原有字段，不为扁平数组强行注入 children）
 */
function normalizeResult<T>(parsed: any, fallbackValue: T): T {
  if (Array.isArray(fallbackValue)) {
    if (Array.isArray(parsed)) {
      return parsed as unknown as T;
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
        parsed.scenes ||
        parsed.suggestions;
      if (Array.isArray(arr)) {
        return arr as unknown as T;
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
  const text = stripThinkTags(rawText);

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
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  const bracketCandidates: string[] = [];
  if (firstBracket !== -1) {
    if (lastBracket > firstBracket) {
      bracketCandidates.push(text.substring(firstBracket, lastBracket + 1));
    }
    bracketCandidates.push(text.substring(firstBracket));
  }

  const braceCandidates: string[] = [];
  if (firstBrace !== -1) {
    if (lastBrace > firstBrace) {
      braceCandidates.push(text.substring(firstBrace, lastBrace + 1));
    }
    braceCandidates.push(text.substring(firstBrace));
  }

  // 根据期望类型与根括号位置决定优先序，避免期望对象时误提取对象内部数组
  const preferArray = Array.isArray(fallbackValue) || (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace));
  if (preferArray) {
    candidates.push(...bracketCandidates, ...braceCandidates);
  } else {
    candidates.push(...braceCandidates, ...bracketCandidates);
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
  return stripThinkTags(rawText);
}

/**
 * 清理 JSON 字符串中常见的尾随逗号及字符串外部的单行/多行注释（严格保护字符串内的 https:// 等 URL）
 */
function cleanJsonString(str: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    // 仅在双引号外跳过 // 单行注释
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < str.length && str[i] !== "\n") i++;
      if (i < str.length) out += "\n";
      continue;
    }

    // 仅在双引号外跳过 /* */ 多行注释
    if (ch === "/" && next === "*") {
      i += 2;
      while (i + 1 < str.length && !(str[i] === "*" && str[i + 1] === "/")) i++;
      i++;
      continue;
    }

    out += ch;
  }

  return out.replace(/,\s*([\]}])/g, "$1").trim();
}

/**
 * 智能提取纯净的小说正文文本（自动剥离 AI 思考链、大纲分析、任务构思、草稿标记与字数元数据）
 */
export function cleanNovelStoryText(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  let text = stripThinkTags(rawText);

  // 1. 剥离外层包裹的 Markdown 代码块标签
  const codeBlockMatch = text.match(/^```(?:markdown|text)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 2. 如果包含明确的正文起止锚点，直接提取正文部分
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

  // 3. 剥离模型开头可能遗留的任务分析与思考构思段落
  const metaBlockPattern = /^(?:任务[：:][\s\S]*?)(?=(?:\n\n[“"‘'第]|(?:\n\n[\u4e00-\u9fa5]{2,}[，。、“"”]))|$)/i;
  if (metaBlockPattern.test(text)) {
    const afterMeta = text.replace(metaBlockPattern, "").trim();
    if (afterMeta.length > 30) {
      text = afterMeta;
    }
  }

  // 4. 逐行剥离明确的 AI 元话术前缀（不误删以“好的，”或破折号开头的真实小说对白）
  const lines = text.split("\n");
  let startIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    if (
      /^(?:任务|需要考虑|思考过程|思考|构思|字数估算|字数统计)[：:]/.test(line) ||
      /^(?:让我们构思|好的，以下是|好的，为您|以下是(?:润色|修改|扩写|续写|精简|改写|本章))/.test(line) ||
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

  // 5. 移除开头的引导短语如 "正文："、"润色后正文："
  text = text.replace(/^(?:可写[：:]|正文[：:]|剧情[：:]|故事[：:]|润色(?:后|版)?[：:]|修改后[：:])\s*/i, "");

  // 6. 剥离文末明确的 AI 元分析总结与字数说明（避免误截小说正文内以“注：”“总结：”开头的自然段）
  const endPattern = /\n+(?:【(?:主要优化点|优化重点|修改说明|创作思路|字数统计)】|(?:主要优化点|优化重点|修改说明|字数估算|字数统计|以上是(?:本次|修改|润色|扩写|精简|续写))[：:])[\s\S]*$/i;
  text = text.replace(endPattern, "").trim();

  return text;
}
