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

    // 计算步数预算：根据预估字数自动折算，或使用指定的 stepCount
    let effectiveSteps = 3;
    if (typeof rawStepCount === "number" && rawStepCount > 0) {
      effectiveSteps = rawStepCount;
    } else {
      const words = Number(estimatedWords) || 10000;
      if (words <= 3000) effectiveSteps = 1;
      else if (words <= 6000) effectiveSteps = 2;
      else if (words <= 12000) effectiveSteps = 3;
      else if (words <= 20000) effectiveSteps = 4;
      else effectiveSteps = Math.min(6, Math.max(3, Math.round(words / 4000)));
    }

    const wordsPerStep = Math.round((Number(estimatedWords) || 10000) / effectiveSteps);

    // 查询关联角色与动态标签
    let charContext = "暂无特定人物库，按通用主角与反派推演";
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

    const systemPrompt = `你是一位精通故事结构与节奏把控的小说推演架构师。
你的任务是：根据作者给出的【起点剧情 A】和【目标终点剧情 B】，结合预计总字数篇幅（约 ${estimatedWords} 字），搭建出中间严丝合缝、层层递进的过渡桥梁。

作品信息：
- 书名：《${work.title}》
- 题材分类：${work.tag || "通用"}

约束机制与参考笔记（请务必严格遵守设定与规则）：
${ruleContext}
${noteContext}

参演角色及动态标签（请严格符合其性格与身份标签）：
${charContext}

推演要求：
请推演出 3 种不同戏剧风格的演进路线，每条路线必须包含刚好 ${effectiveSteps} 个递进步骤（每步大约 ${wordsPerStep} 字）：
1. 【稳健因果流】：靠信息差、利益博弈、稳步筹备推进，因果极其严密，不机械降神；
2. 【惊天反转流】：利用隐藏伏笔、误导或第三方突发介入，形成意想不到的大转折；
3. 【极限破局流】：主角面临严重危机极限施压，付出代价后实现突破或达成目标。

每个步骤请使用通俗易懂的大白话结构输出：
- title: 步骤简明标题
- event: 发生经过（在这一步中具体发生了什么主要事件）
- twist: 意外转折（出了什么岔子、阻碍或突发冲突）
- nextGoal: 下一步动机（本步结束后角色接下来打算怎么办）
- suspense: 留下伏笔（留下了什么未解疑问或伏笔）
- characterAction: 核心角色的动作与选择

请严格输出为以下 JSON 格式：
{
  "paths": [
    {
      "id": 1,
      "title": "路线名称（如：稳扎稳打·暗度陈仓）",
      "style": "稳健因果",
      "summary": "一句话核心转折逻辑概述",
      "steps": [
        {
          "stepIndex": 1,
          "title": "步骤标题",
          "event": "具体发生经过",
          "twist": "发生的意外或冲突",
          "nextGoal": "角色下一步打算",
          "suspense": "留下的伏笔或悬念",
          "characterAction": "涉及角色的选择",
          "estimatedWords": ${wordsPerStep}
        }
      ]
    }
  ]
}
注意：仅输出纯 JSON 字符串，不要包含任何多余解说。`;

    const userMessage = `【起点剧情 A】：${startPoint.trim()}
【目标终点 B】：${targetPoint.trim()}
【预计总篇幅】：约 ${estimatedWords} 字（拆解为 ${effectiveSteps} 个章节步骤，每步约 ${wordsPerStep} 字）
【推演风格偏好】：${pacePreference}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.7,
      maxTokens: 3000,
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
      // 兜底智能生成
      parsed = {
        paths: [
          {
            id: 1,
            title: "稳健因果推进流",
            style: "稳健因果",
            summary: "从起点通过信息收集与借力打力稳步过渡到目标终点",
            steps: Array.from({ length: effectiveSteps }).map((_, i) => ({
              stepIndex: i + 1,
              title: i === 0 ? "暂避锋芒与摸清局势" : i === effectiveSteps - 1 ? "水到渠成达成终局目标" : `第 ${i + 1} 阶段：打破僵局`,
              event: i === 0 ? `主角在【${startPoint}】后迅速调整策略，暗中搜集关键情报。` : `主角克服上一阶段困难，稳步向【${targetPoint}】推进。`,
              twist: "出现预期之外的阻力与竞争对手暗中干预。",
              nextGoal: "顺藤摸瓜寻找下一个破局契机。",
              suspense: "暗中似乎有第三方势力在窥视局势发展。",
              characterAction: "保持冷静，审时度势做出最优选择。",
              estimatedWords: wordsPerStep,
            })),
          },
          {
            id: 2,
            title: "惊天反转突围流",
            style: "惊天反转",
            summary: "看似陷入绝境，实则利用敌方破绽打出意外大逆转",
            steps: Array.from({ length: effectiveSteps }).map((_, i) => ({
              stepIndex: i + 1,
              title: i === 0 ? "遭遇陷阱与假意妥协" : i === effectiveSteps - 1 ? "揭晓底牌实现惊天反杀" : `第 ${i + 1} 阶段：险中求胜`,
              event: `围绕【${startPoint}】展开激化博弈，最终以意想不到的方式连通【${targetPoint}】。`,
              twist: "盟友真实身份出现疑云，危机陡然升级。",
              nextGoal: "将计就计，反客为主。",
              suspense: "某件关键道具的作用远超所有人想象。",
              characterAction: "伪装软弱，暗中布下致命杀局。",
              estimatedWords: wordsPerStep,
            })),
          },
          {
            id: 3,
            title: "极限施压破局流",
            style: "极限突破",
            summary: "在强力外部压迫下不退反进，付出代价完成破局",
            steps: Array.from({ length: effectiveSteps }).map((_, i) => ({
              stepIndex: i + 1,
              title: i === 0 ? "硬撼强敌与付出代价" : i === effectiveSteps - 1 ? "涅槃重生掌控全场" : `第 ${i + 1} 阶段：向死而生`,
              event: `主角顶住来自多方势力的重压，以顽强意志直逼【${targetPoint}】。`,
              twist: "防线被破，不得不孤注一掷动用底牌。",
              nextGoal: "一鼓作气击溃核心阻碍。",
              suspense: "这次突破引来了更上层强者的瞩目。",
              characterAction: "果断出击，绝不退缩半分。",
              estimatedWords: wordsPerStep,
            })),
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
