// API: A ➔ B 跨度剧情推演引擎（支持字数篇幅预算、关联角色标签与关联笔记设定约束）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, worldRules, notes } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { stripHtml } from "@/utils/text";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      startPoint,
      targetPoint,
      estimatedWords = 10000,
      stepCount: rawStepCount,
      selectedCharacterIds = [],
      selectedNoteIds = [],
      pacePreference = "standard",
      pathPreference = "",
      involvedCharacters = "",
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!startPoint?.trim() || !targetPoint?.trim()) {
      return NextResponse.json({ success: false, message: "起点剧情与目标终点剧情均不能为空" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    // 计算参考步数：若用户未指定，则根据复杂度给大模型建议 2~4 步，不再硬性绑死
    let suggestedSteps = 3;
    if (typeof rawStepCount === "number" && rawStepCount > 0) {
      suggestedSteps = rawStepCount;
    } else {
      const words = Number(estimatedWords) || 10000;
      if (words <= 3000) suggestedSteps = 2;
      else if (words <= 8000) suggestedSteps = 3;
      else suggestedSteps = 4;
    }

    const wordsPerStep = Math.round((Number(estimatedWords) || 10000) / suggestedSteps);

    // 查询关联角色与动态标签
    let charContext = "暂无特定人物库，请根据常理推演核心参演人物";
    if (Array.isArray(selectedCharacterIds) && selectedCharacterIds.length > 0) {
      const numIds = selectedCharacterIds.map(Number).filter((n) => !isNaN(n));
      if (numIds.length > 0) {
        const chars = await db.select().from(characters).where(and(eq(characters.workId, workId), inArray(characters.id, numIds))).all();
        if (chars.length > 0) {
          charContext = chars
            .map((c) => `【${c.name}】(${c.roleType || "主要人物"}): 身份/标签: [${c.identity || ""}, ${c.tags || ""}] | 性格动机: ${c.personality || "未详"} | 功法能力: ${c.abilities || "普通"} | 成长弧光: ${c.characterArc || "未设定"}`)
            .join("\n");
        }
      }
    } else {
      const someChars = await db.select().from(characters).where(eq(characters.workId, workId)).all();
      if (someChars.length > 0) {
        charContext = someChars
          .slice(0, 5)
          .map((c) => `【${c.name}】(${c.roleType || "主要人物"}): 身份/标签: [${c.identity || ""}, ${c.tags || ""}] | 性格动机: ${c.personality || "未详"}`)
          .join("\n");
      }
    }

    // 查询关联笔记与设定全文
    let noteContext = "";
    if (Array.isArray(selectedNoteIds) && selectedNoteIds.length > 0) {
      const numIds = selectedNoteIds.map(Number).filter((n) => !isNaN(n));
      if (numIds.length > 0) {
        const foundNotes = await db.select().from(notes).where(and(eq(notes.workId, workId), inArray(notes.id, numIds))).all();
        if (foundNotes.length > 0) {
          noteContext = foundNotes
            .map((n) => `【参考设定/灵感笔记: ${n.title}】(${n.category}):\n${n.content}`)
            .join("\n\n");
        }
      }
    }

    // 查询基础世界规则
    const rulesList = await db.select().from(worldRules).where(eq(worldRules.workId, workId)).all();
    const ruleContext = rulesList.length > 0
      ? rulesList.slice(0, 3).map((r) => `【${r.name}】(${r.category}): ${stripHtml(r.mechanisms || r.description).slice(0, 150)}`).join("\n")
      : "";

    const systemPrompt = `你是一名专业的小说剧情架桥与因果推演助手。
你的任务不是替作者编造脱离设定的套路故事，而是帮助作者解决“从【起点剧情 A】如何自然、合乎因果逻辑地发展到【目标终点 B】”。

【推演核心原则】：
1. 【补齐因果，而非无病呻吟】：分析 A 与 B 之间缺少哪些必要的状态变化（信息获取、人物关系演变、目标转移、资源获取、认知改变、决策触发等），构建最小因果桥梁。
2. 【最小必要事件原则】：每个新增事件都必须承担明确推进作用（提供必要信息/改变人物关系/打破僵局）。如果删除该步骤 A➔B 仍能成立，则不要加入多余水剧情。
3. 【人物行动动机驱动】：角色行动不能为了“剧情需要”而强行动作，必须基于人物的目标、利益、恐惧、性格、已知信息与外部压力。
4. 【禁止剧情捷径】：严禁依赖“凭空冒出的神秘证据”、“机械降神”、“反派主动自曝认罪”等无依据捷径解决因果缺口。
5. 【不预设反派与高潮】：剧情节奏由 A、B 与上下文决定。若只是日常过渡或线索调查，保持其自然节奏，严禁强行制造全场轰动或狗血高潮。
6. 【转折与伏笔均为可选】：twist（突发变故）和 suspense（伏笔线索）仅在自然合理时提供，绝非每步必填。
7. 【方案数量灵活】：若 A➔B 存在唯一自然路径，提供 1~2 套方案；若存在不同发展取向，最多提供 3 套。

【字段输出要求（严格精简防冗长重复）】：
- title: 阶段标题（12字以内）
- purpose: 本阶段解决的核心缺口（25字以内）
- cause: 为什么发生此阶段（20~40字）
- action: 核心角色具体做了什么（20~45字）
- result: 产生的结果与局势变化（20~40字）
- characterDecision: 角色决策动因（20~40字）
- stateChange: 状态变化数组（1~2条，如["信息：未知 ➔ 产生怀疑"]）
- event: 结合具体人名与场景的完整互动经过（60~120字，不要机械复读上面的短句）
- nextCondition: 下一步前提条件（最后一步填 null）
- twist: 可选突发变故（无则设为 null）
- suspense: 可选伏笔细节（无则设为 null）
- estimatedWords: 预估篇幅字数

请严格输出以下合法 JSON，绝不输出 Markdown 代码块或多余文字：
{
  "paths": [
    {
      "id": 1,
      "title": "<方案标题>",
      "style": "<风格标签>",
      "summary": "<一句话核心因果演进逻辑>",
      "steps": [
        {
          "stepIndex": 1,
          "title": "<阶段标题>",
          "purpose": "<解决的因果缺口>",
          "cause": "<起因>",
          "action": "<具体行动>",
          "result": "<阶段结果>",
          "characterDecision": "<角色决策动因>",
          "stateChange": ["<维度：前状态 ➔ 后状态>"],
          "event": "<60~120字具体人名与场景互动经过>",
          "nextCondition": "<下一步前提条件或null>",
          "twist": null,
          "suspense": null,
          "estimatedWords": ${wordsPerStep}
        }
      ]
    }
  ],
  "missingConditions": []
}`;

    const userMessage = `【作品】：书名《${work.title}》（题材：${work.tag || "通用小说"}）
【参考世界观】：${ruleContext || "通用设定背景"}
【参考笔记】：${noteContext ? noteContext.slice(0, 2000) : "无"}
【参演人物档案】：
${charContext}${involvedCharacters ? `\n补充提及人物：${involvedCharacters}` : ""}

【起点剧情 A（现状）】：${startPoint.trim()}
【目标终点 B（预期）】：${targetPoint.trim()}
【篇幅预算】：约 ${estimatedWords} 字（建议规划 ${suggestedSteps} 个关键因果阶段，可根据实际因果需要灵活调整）
【节奏偏好】：${pacePreference || "自然演进"}${pathPreference ? `\n【作者补充演进期望】：${pathPreference}` : ""}

请严格围绕上述起点 A、终点 B 与人物/设定进行因果架桥分析，每一步都必须写出具体人名、具体行动与具体因果变化（严禁空洞套话），直接输出合法 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const isValidPaths = (obj: any) =>
      Boolean(obj && Array.isArray(obj.paths) && obj.paths.some((p: any) => Array.isArray(p?.steps) && p.steps.length > 0));

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.5,
      maxTokens: 6144,
    });

    let parsed: any = parseStructuredJson<any>(rawResponse, null);

    // 首次解析失败时切换 fast 通道自动重试一次，绝不使用假模板糊弄
    if (!isValidPaths(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.45,
          maxTokens: 5120,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (isValidPaths(retryParsed)) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        console.warn("[plot-deduction] 备选通道重试失败:", retryErr);
      }
    }

    if (!isValidPaths(parsed)) {
      return NextResponse.json(
        { success: false, message: "AI 剧情推演结果解析失败，请稍后重试" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      message: "推演完成",
    });
  } catch (error: any) {
    console.error("[API /api/ai/plot-deduction] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "剧情推演异常" }, { status: 500 });
  }
});
