// API: A ➔ B 跨度剧情推演引擎（支持字数篇幅预算、关联角色标签与关联笔记设定约束）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, worldRules, notes } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

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
      ? rulesList.slice(0, 3).map((r) => `【${r.name}】(${r.category}): ${r.mechanisms || r.description || ""}`).join("\n")
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

【字段输出要求】：
- title: 阶段标题（如：“核对旧档案中的时间差”）
- purpose: 本阶段解决的核心缺口（如：“解决主角对账本真实性的怀疑”）
- cause: 为什么发生此阶段（因）
- action: 核心角色具体做了什么（行）
- result: 产生的结果与局势变化（果）
- characterDecision: 角色为什么做出该决策与应对
- stateChange: 状态变化数组（如：["信息：未知 ➔ 产生怀疑"]）
- event: 完整的剧情发生与互动经过（结合 cause、action 与 result，80-160字）
- nextCondition: 下一步继续推进需满足的前提条件
- twist: 可选突发变故（无则设为 null）
- suspense: 可选伏笔细节（无则设为 null）
- estimatedWords: 预估篇幅字数

请严格输出为以下合法 JSON 格式，绝不输出任何 Markdown 标记或多余文字：
{
  "paths": [
    {
      "id": 1,
      "title": "方案标题（如：抽丝剥茧·稳步验证）",
      "style": "自然因果",
      "summary": "一句话核心因果演进逻辑",
      "steps": [
        {
          "stepIndex": 1,
          "title": "阶段标题",
          "purpose": "解决的因果缺口",
          "cause": "起因",
          "action": "具体行动",
          "result": "阶段结果",
          "characterDecision": "角色决策动因",
          "stateChange": ["信息：未知 ➔ 产生怀疑"],
          "event": "剧情发生经过...",
          "nextCondition": "下一步前提条件",
          "twist": null,
          "suspense": null,
          "estimatedWords": ${wordsPerStep}
        }
      ]
    }
  ],
  "missingConditions": []
}`;

    const userMessage = `【作品】：书名《${work.title}》（题材：${work.tag || "剧情小说"}）
【参考世界观】：${ruleContext || "通用现实/设定背景"}
【参考笔记】：${noteContext || "无"}
【参演人物档案】：
${charContext}

【起点剧情 A（现状）】：${startPoint.trim()}
【目标终点 B（预期）】：${targetPoint.trim()}
【篇幅预算】：约 ${estimatedWords} 字（建议规划 ${suggestedSteps} 个关键因果阶段，可根据实际因果需要灵活调整）
【演进偏好与要求】：${pacePreference || "自然演进"}

请进行因果架桥分析，输出严密、符合逻辑的剧情演进路径 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.65,
      maxTokens: 4096,
    });

    const cleaned = cleanNovelStoryText(rawResponse);
    let parsed: any = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (__) {}
      }
    }

    if (!parsed || !Array.isArray(parsed.paths) || parsed.paths.length === 0) {
      const startBrief = startPoint.trim().slice(0, 30);
      const targetBrief = targetPoint.trim().slice(0, 30);

      parsed = {
        paths: [
          {
            id: 1,
            title: "自然因果·稳步推进",
            style: "自然因果",
            summary: `从【${startBrief}】出发，通过关键信息验证与合理行动，自然推进至【${targetBrief}】`,
            steps: suggestedSteps <= 2 ? [
              {
                stepIndex: 1,
                title: "核实关键线索与局势转化",
                purpose: "打破起点僵局，获取推进所需的关键支持或事实证据",
                cause: `承接起点【${startBrief}】遗留的未解疑问与现实阻力`,
                action: "角色根据掌握的有限线索，主动找到核心知情人或调取记录进行交叉比对",
                result: "确认了关键因果关系，掌握了主动权",
                characterDecision: "审时度势，选择以最稳妥的方式验证事实而非盲目行动",
                stateChange: ["信息：模糊怀疑 ➔ 确凿掌握", "局势：被动 ➔ 明确方向"],
                event: `在【${startPoint}】之后，角色没有盲目冒进，而是针对核心疑点展开核实，通过可信渠道锁定了关键事实，为后续推进奠定扎实基础。`,
                nextCondition: `直接依据确凿结果采取行动，达成【${targetPoint}】`,
                twist: null,
                suspense: null,
                estimatedWords: Math.round((Number(estimatedWords) || 10000) / 2),
              },
              {
                stepIndex: 2,
                title: "采取决定性行动并达成目标",
                purpose: "根据已具备的前置条件顺理成章达成目标状态 B",
                cause: "前置核实工作已就绪，时机成熟",
                action: `角色在合适场合拿出准备充分的方案与结果，顺畅推进至【${targetPoint}】`,
                result: `成功达成预期目标【${targetBrief}】`,
                characterDecision: "果断执行，彻底解决起点遗留的核心问题",
                stateChange: ["目标：推进中 ➔ 顺利达成"],
                event: `结合前期积累的成果与各方认同，角色从容化解了最后的阻力，所有因果逻辑水到渠成，完美实现【${targetPoint}】。`,
                nextCondition: null,
                twist: null,
                suspense: null,
                estimatedWords: Math.round((Number(estimatedWords) || 10000) / 2),
              }
            ] : [
              {
                stepIndex: 1,
                title: "发现异常与确定调查切入点",
                purpose: "使角色意识到当前状态与目标之间的实质差距并找到切入点",
                cause: `起点【${startBrief}】造成的直接影响与信息缺失`,
                action: "梳理现有线索，敏锐捕捉到关键漏洞或未被注意的细节",
                result: "明确了下一步行动的目标与求证方向",
                characterDecision: "不轻信表面结论，保持谨慎客观的态度",
                stateChange: ["认知：未察觉 ➔ 发现关键切入点"],
                event: `在经历【${startPoint}】后，角色仔细比对前后细节，发现了此前被忽略的矛盾点，决定顺此线索深入探查。`,
                nextCondition: "需要获取第一手资料或关键人物口供",
                twist: null,
                suspense: null,
                estimatedWords: wordsPerStep,
              },
              {
                stepIndex: 2,
                title: "突破阻碍与获取核心支撑",
                purpose: "补齐达成目标 B 所必需的关键证据或人际支持",
                cause: "深入调查触及到实际阻力或既得利益方的防备",
                action: "角色利用合理手段周旋，成功取得关键支持与核心证据",
                result: "彻底补全了达成目标所需的核心条件",
                characterDecision: "在原则范围内灵活变通，化解沟通阻力",
                stateChange: ["资源：匮乏 ➔ 掌握关键支撑"],
                event: `在推进过程中遭遇了合理的阻碍，角色凭借沉着判断化解了分歧，顺利拿到足以定论的关键支撑。`,
                nextCondition: "在关键节点正式公开或落实成果",
                twist: null,
                suspense: null,
                estimatedWords: wordsPerStep,
              },
              {
                stepIndex: 3,
                title: "因果闭环与目标达成",
                purpose: "全面达成目标状态 B 并稳固新局势",
                cause: "所有必要前置条件均已齐备",
                action: `正面推进并落实最终决议，使所有人认可结果`,
                result: `顺利达成【${targetPoint}】并形成因果闭环`,
                characterDecision: "沉着收官，巩固来之不易的发展成果",
                stateChange: ["局势：悬而未决 ➔ 全面达成目标"],
                event: `所有线索与准备在此刻汇聚，角色以无可辩驳的事实与扎实的准备达成目标，全篇因果严丝合缝，圆满实现【${targetPoint}】。`,
                nextCondition: null,
                twist: null,
                suspense: null,
                estimatedWords: wordsPerStep,
              }
            ],
          },
        ],
      };
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
