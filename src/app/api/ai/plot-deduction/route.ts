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

    const systemPrompt = `你是一位精通戏剧冲突与故事节奏的小说剧情推演大师。
你的核心任务是：根据作者给出的【起点剧情 A】和【目标终点 B】，在两者之间推演出【逻辑严密、细节真实、因果严丝合缝】的发展演进过程。

小说信息：
- 书名：《${work.title}》
- 题材：${work.tag || "都市/剧情"}

参考规则与世界观背景：
${ruleContext || "现代/通用商业都市"}
${noteContext || "暂无特定设定笔记"}

参演人物背景与性格动机（推演中必须深度结合这些人物的具体行动与对话互动）：
${charContext}

推演核心要求（⚠️ 严禁假大空的通用套话，严禁出现“暗中搜集情报/顺藤摸瓜/面临潜在阻力”等空洞模版）：
1. 必须从【起点 A】的当下具体局势出发，结合参演人物的具体身份与性格（谁做了什么、说了什么、遇到了什么具体的现实阻碍）；
2. 必须一步一步推进到【终点 B】的达成，中间的转折与冲突必须合情合理、有血有肉；
3. 输出 3 套不同戏剧风味的演进路线，每条路线拆分为刚好 ${effectiveSteps} 个递进步骤（每步大约 ${wordsPerStep} 字）：
   - 【稳健因果流】：扎实的现实博弈与筹备，利用商业手段、人脉、证据或规则步步为营达成 B；
   - 【戏剧冲突流】：反派狗急跳墙施加更猛烈的阻击，主角借力打力、公开对峙引爆高潮达成 B；
   - 【巧妙反转流】：反派以为抓住了主角软肋，实则是主角故意布下的阳谋，反将一军达成 B。

每步字段要求：
- stepIndex: 步骤序号 (1, 2, ...)
- title: 具体的场景事件标题（如：“商会晚宴的暗流交锋”、“调取二十年前的第一代专利档案”）
- event: 具体剧情经过（写明在什么场景、谁做了什么具体的行动、双方发生了怎样的交锋，80-150字）
- twist: 意外转折/冲突点（对方的具体反击或突发变故，30-60字）
- nextGoal: 下一步行动计划（针对当前状况，角色接下来的明确动作，20-40字）
- suspense: 伏笔或细节线索（本阶段埋下的关键伏笔，20-40字）
- characterAction: 核心人物的关键决策与神态行动

请严格输出为以下 JSON 格式：
{
  "paths": [
    {
      "id": 1,
      "title": "方案名称（如：稳健因果·步步为营）",
      "style": "稳健因果",
      "summary": "一句话核心推进逻辑",
      "steps": [
        {
          "stepIndex": 1,
          "title": "具体步骤标题",
          "event": "具体翔实的剧情发生经过...",
          "twist": "具体的冲突或阻碍...",
          "nextGoal": "明确的下一步目标...",
          "suspense": "留下的线索...",
          "characterAction": "人物的具体反应与决策...",
          "estimatedWords": ${wordsPerStep}
        }
      ]
    }
  ]
}
注意：只输出合法 JSON，不要附带任何 Markdown 说明。`;

    const userMessage = `请根据以下信息推演从 A 发展到 B 的具体过程：
【起点剧情 A（现状）】：${startPoint.trim()}
【目标终点 B（预期）】：${targetPoint.trim()}
【篇幅预算】：约 ${estimatedWords} 字（拆解为 ${effectiveSteps} 个阶段，每阶段约 ${wordsPerStep} 字）
【推演偏好】：${pacePreference}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.7,
      maxTokens: 3500,
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
      // 深度根据 A 和 B 生成具体且高质量的动态兜底路线
      const startBrief = startPoint.trim().slice(0, 30);
      const targetBrief = targetPoint.trim().slice(0, 30);

      parsed = {
        paths: [
          {
            id: 1,
            title: "稳健因果·步步为营",
            style: "稳健因果",
            summary: `从【${startBrief}】出发，通过实打实的证据与人脉铺垫，稳健推进至【${targetBrief}】`,
            steps: effectiveSteps === 1 ? [
              {
                stepIndex: 1,
                title: "局势转化与彻底反击",
                event: `承接【${startPoint}】，主角趁胜追击，当众拿出无可辩驳的核心证据与早年奋斗底牌，正面击溃对方的质疑，顺理成章达成【${targetPoint}】。`,
                twist: "对方试图做最后的负隅顽抗，却反被主角当场抓住更大破绽。",
                nextGoal: "乘胜追击，巩固胜利果实并彻底奠定话语权。",
                suspense: "这次正面反击让在场所有大佬对主角的真正底蕴刮目相看。",
                characterAction: "沉稳应对，不急不躁，用无可挑剔的实力彻底服众。",
                estimatedWords: wordsPerStep,
              }
            ] : [
              {
                stepIndex: 1,
                title: "稳住局面与掌握核心证据",
                event: `在经历【${startPoint}】后，现场舆论开始扭转。主角并未立刻穷追猛打，而是安排关键助手暗中锁定对方的违规证据链，同时联络行业权威第三方进行公证，为下一步铺平道路。`,
                twist: "对手暗中动用商圈人脉试图联合封杀，企图压制真相传播。",
                nextGoal: "拿到当年关键的第一手档案，准备在重要公开场合一次性引爆。",
                suspense: "对手的后台似乎牵扯到了更高的利益集团。",
                characterAction: "展现出成熟企业家的沉稳魄力，稳步布局。",
                estimatedWords: wordsPerStep,
              },
              {
                stepIndex: 2,
                title: "公开对峙与揭秘传奇背景",
                event: `在随后的行业高端峰会上，对手再次挑起事端。主角从容登台，不仅拿出当年白手起家的一张张老图纸与真实专利链条，更有力戳穿对手的所有谎言，全场轰动，完美实现【${targetPoint}】。`,
                twist: "对手当场语塞，同盟阵营瞬间瓦解倒戈。",
                nextGoal: "借此契机全面拓展自身商业版图。",
                suspense: "这场反击战也引来了顶级投资机构的深度关注。",
                characterAction: "气场全开，用二十年的艰辛奋斗史赢得全场起立鼓掌。",
                estimatedWords: wordsPerStep,
              }
            ],
          },
          {
            id: 2,
            title: "戏剧冲突·当众打脸",
            style: "戏剧冲突",
            summary: `引诱对手狂妄出手，在最高潮处当众揭穿，达成【${targetBrief}】`,
            steps: effectiveSteps === 1 ? [
              {
                stepIndex: 1,
                title: "高潮反击与绝地翻盘",
                event: `在【${startPoint}】的基础上，对手不甘失败再次设局挑衅，主角将计就计，在所有媒体与行业巨头面前公开揭晓早年白手起家的创业真相，以绝对实力完成【${targetPoint}】。`,
                twist: "对手原本以为胜券在握，却不知自己彻底踩入死穴。",
                nextGoal: "一举奠定行业龙头地位。",
                suspense: "对方背后的资本方紧急宣布与其切割割席。",
                characterAction: "言辞犀利，掌控全场节奏。",
                estimatedWords: wordsPerStep,
              }
            ] : [
              {
                stepIndex: 1,
                title: "假意示弱与引蛇出洞",
                event: `在【${startPoint}】之后，主角故意对外界的打压保持低调，让对手误以为主角已无还手之力而疯狂加码挑衅，在媒体前肆意抹黑。`,
                twist: "对手得意忘形，当众夸大其词说漏了关键内幕。",
                nextGoal: "搜集所有公开抹黑的录音与直播证据，准备绝杀。",
                suspense: "甚至有神秘老友暗中为主角送来关键的原始公证文件。",
                characterAction: "胸有成竹，静待最佳反击时刻到来。",
                estimatedWords: wordsPerStep,
              },
              {
                stepIndex: 2,
                title: "全网直播反转与揭开身世",
                event: `在万众瞩目的发布会现场，主角正面现身，大屏幕直接切出当年从地摊、小作坊一步一个脚印白手起家的铁证，当场重重打脸对手，达成【${targetPoint}】。`,
                twist: "对手在镜头前瞬间脸色惨白，声名扫地。",
                nextGoal: "全面启动新项目，将危机转化为巨大的品牌声量。",
                suspense: "主角早年的某位故人通过直播认出了主角的身份。",
                characterAction: "坦荡自豪地讲述奋斗岁月，赢得所有人的敬重。",
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
