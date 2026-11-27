// API: 项目总纲节点 AI 逻辑推算（针对当前节点及其下属子节点的大纲剧情发展与逻辑梳理，无评分）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, worldRules } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { stripHtml } from "@/utils/text";

function serializeSubtree(node: any, depth = 0, indexLabel = ""): string {
  if (!node || typeof node !== "object") return "";
  const indent = "  ".repeat(depth);
  const metaParts: string[] = [];
  if (node.id) metaParts.push(`nodeId:${String(node.id)}`);
  if (node.tag) metaParts.push(String(node.tag));
  if (node.chapterRange) metaParts.push(`第${node.chapterRange}章`);
  const meta = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";
  const note = node.note ? ` —— 要点：${String(node.note).trim()}` : " —— 要点：（未填写）";
  const prefix = indexLabel ? `${indexLabel}. ` : "";
  let line = `${indent}- ${prefix}${node.title || "未命名节点"}${meta}${note}\n`;
  if (Array.isArray(node.children) && node.children.length > 0) {
    node.children.forEach((child: any, idx: number) => {
      const nextLabel = indexLabel ? `${indexLabel}.${idx + 1}` : `${idx + 1}`;
      line += serializeSubtree(child, depth + 1, nextLabel);
    });
  }
  return line;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const targetNode = body.targetNode;
    const rootSummary = String(body.rootSummary || "").trim();

    if (!workId || isNaN(workId) || !targetNode || typeof targetNode !== "object") {
      return NextResponse.json({ success: false, message: "参数不完整" }, { status: 400 });
    }

    if (!Array.isArray(targetNode.children) || targetNode.children.length === 0) {
      return NextResponse.json({ success: false, message: "该节点暂无子节点，无法进行大纲逻辑推算" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    const [charList, ruleList] = await Promise.all([
      db
        .select({ name: characters.name, identity: characters.identity, personality: characters.personality })
        .from(characters)
        .where(eq(characters.workId, workId))
        .limit(8)
        .all(),
      db
        .select({ name: worldRules.name, mechanisms: worldRules.mechanisms, taboos: worldRules.taboos })
        .from(worldRules)
        .where(eq(worldRules.workId, workId))
        .limit(5)
        .all(),
    ]);

    let context = `作品：《${work.title}》（题材：${work.tag || "小说"}，全书预计 ${work.expectedWords || 500000} 字 / ${work.expectedChapters || 100} 章）\n简介：${work.description || "暂无简介"}\n`;
    if (rootSummary) {
      context += `项目总纲概览：${rootSummary}\n`;
    }
    if (charList.length > 0) {
      context += `【核心角色参考】：${charList.map((c) => `${c.name}(${c.identity || ""}${c.personality ? `/${c.personality}` : ""})`).join("；")}\n`;
    }
    if (ruleList.length > 0) {
      context += `【核心世界规则参考】：${ruleList.map((r) => `${r.name}(机制:${stripHtml(r.mechanisms).slice(0, 80)}${r.taboos ? ` 禁忌:${r.taboos.slice(0, 50)}` : ""})`).join("；")}\n`;
    }

    const subtreeText = serializeSubtree(targetNode);

    const systemPrompt = `你是一位极具洞察力的小说总编剧与剧情架构师。请针对作者选定的【项目总纲节点及其下属子节点】，进行深度的大纲剧情发展推演与逻辑梳理，帮助作者理清剧情因果、排查漏洞、规划篇幅节奏，并给出可直接采纳同步到卡片的最终优化逻辑线。

【严格要求】：
1. 这是纯大纲层面的剧情逻辑推算，**不要给出任何分数或评分**。
2. 必须紧密结合当前父节点的目标与其所有子节点的先后顺序、因果承接、人物动机、伏笔呼应与高潮铺垫来分析，切忌泛泛而谈。
3. 必须结合作品全书预计体量与当前节点体量，给出客观的【建议章节与字数篇幅控制（suggestedChapterPacing）】：明确建议这部分剧情最好在多少章、多少字以内完成，并简述前中后段节奏分配。
4. 在【建议最终修改逻辑线（recommendedLogicLine）】中，请逐条列出对应卡片节点的修改前后对照：
   - 若对应已有子节点（或父节点），**必须严格原样填回输入数据中的 nodeId**，并给出原节点标题/要点（originalTitle / originalNote）以及建议修改后的标题/要点（title / note）；
   - **克制原则**：若某个原节点本身逻辑通顺、没有问题，请尽量保持其原标题和核心要点不变（在 changeSummary 标注“结构合理，保持原样”），**严禁为了凑改动而把原本写得好的节点全部强行重写**；
   - 若认为必须补充新增一个过渡节点，则 nodeId 填空字符串 ""，并给出建议新增的 title 与 note。
5. 实事求是评估是否有问题：若整体逻辑自洽，hasIssues 设为 false，logicHoles 可为空数组 []，绝不为了凑条数硬编漏洞。
6. 仅输出合法 JSON 对象，严禁输出 Markdown 代码块或任何多余说明：
{
  "logicLine": "<对当前节点及下属子节点整体剧情发展脉络、起承转合和因果链条的清晰梳理>",
  "suggestedChapterPacing": "<结合作品体量与本段事件密度，给出建议章节数、字数上限以及前中后段节奏分配>",
  "hasIssues": false,
  "issueConclusion": "<明确判断当前节点与子节点的逻辑是否存在问题及核心依据总括>",
  "logicHoles": [
    "<若存在明确逻辑漏洞则逐条指出涉及的子节点与原因；若无明显漏洞则输出空数组>"
  ],
  "optimizablePoints": [
    "<从节奏张力、动机铺垫、悬念钩子或伏笔呼应角度提出可优化方向；若无则输出空数组>"
  ],
  "optimizationSuggestions": [
    {
      "targetNodeTitle": "<具体对应子节点名称或整体衔接>",
      "problem": "<该处存在的具体问题或薄弱点>",
      "suggestion": "<具体、可直接落地的修改与补充建议>"
    }
  ],
  "recommendedLogicLine": [
    {
      "step": 1,
      "nodeId": "<已有节点的真实 nodeId；若为建议新增过渡节点则留空字符串>",
      "originalTitle": "<原节点标题>",
      "originalNote": "<原节点要点说明>",
      "title": "<建议修改后的节点标题（无问题可保持原样）>",
      "note": "<建议修改后的节点要点说明（可直接替换写入卡片）>",
      "changeSummary": "<一句话概括改动原因，或标注保持原样>"
    }
  ]
}`;

    const userPrompt = `${context}
【待推算的当前节点及下属子节点结构】：
${subtreeText}
请直接输出上述大纲逻辑推算结果的合法 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.4,
      maxTokens: 6144,
    });

    let parsed = parseStructuredJson<any>(raw, null);
    if (!parsed || typeof parsed !== "object") {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.35,
          maxTokens: 5120,
        });
        parsed = parseStructuredJson<any>(retryRaw, null);
      } catch {}
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ success: false, message: "AI 逻辑推算结果解析失败，请重试" }, { status: 500 });
    }

    const result = {
      updatedAt: Date.now(),
      logicLine: String(parsed.logicLine || "").trim() || "暂无逻辑线梳理内容",
      suggestedChapterPacing: String(parsed.suggestedChapterPacing || "").trim() || "",
      hasIssues: Boolean(parsed.hasIssues),
      issueConclusion: String(parsed.issueConclusion || "").trim() || (parsed.hasIssues ? "存在需要关注的逻辑或衔接问题" : "当前节点与子节点整体逻辑基本自洽"),
      logicHoles: Array.isArray(parsed.logicHoles)
        ? parsed.logicHoles.map((s: any) => String(s || "").trim()).filter(Boolean)
        : [],
      optimizablePoints: Array.isArray(parsed.optimizablePoints)
        ? parsed.optimizablePoints.map((s: any) => String(s || "").trim()).filter(Boolean)
        : [],
      optimizationSuggestions: Array.isArray(parsed.optimizationSuggestions)
        ? parsed.optimizationSuggestions
            .filter((item: any) => item && typeof item === "object")
            .map((item: any) => ({
              targetNodeTitle: String(item.targetNodeTitle || "整体衔接").trim(),
              problem: String(item.problem || "").trim(),
              suggestion: String(item.suggestion || "").trim(),
            }))
            .filter((item: any) => item.problem || item.suggestion)
        : [],
      recommendedLogicLine: Array.isArray(parsed.recommendedLogicLine)
        ? parsed.recommendedLogicLine
            .filter((item: any) => item && typeof item === "object")
            .map((item: any, idx: number) => ({
              step: Number(item.step) || idx + 1,
              nodeId: item.nodeId ? String(item.nodeId).trim() : "",
              originalTitle: item.originalTitle ? String(item.originalTitle).trim() : "",
              originalNote: item.originalNote ? String(item.originalNote).trim() : "",
              title: String(item.title || `阶段 ${idx + 1}`).trim(),
              note: String(item.note || "").trim(),
              changeSummary: item.changeSummary ? String(item.changeSummary).trim() : "",
            }))
            .filter((item: any) => item.title || item.note)
        : [],
    };

    return NextResponse.json({
      success: true,
      result,
      message: "AI 大纲逻辑推算完成",
    });
  } catch (error: any) {
    console.error("[API /api/ai/outline/master/logic-deduction] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "AI 逻辑推算异常" }, { status: 500 });
  }
});
