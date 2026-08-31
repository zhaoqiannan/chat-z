import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { callCloudflareAi, parseStructuredJson, ChatMessage } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { workId: rawWorkId, action, premise, targetNodeId, targetNode, additionalPrompt } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
        { status: 400 }
      );
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限" },
        { status: 404 }
      );
    }

    const workTitle = work.title;
    const workTag = work.tag || "玄幻修真";
    const workDesc = work.description || "暂无简介";

    // 查出现存所有大纲节点作为上下文
    const existingNodes = await db
      .select()
      .from(outlines)
      .where(eq(outlines.workId, workId))
      .orderBy(asc(outlines.orderIndex), asc(outlines.createdAt));

    const existingOutlineSummary = existingNodes
      .map((n) => `[${n.type || "scene"}] ${n.title} (目标: ${n.goal})`)
      .join("\n");

    let resultPayload: any = null;

    switch (action) {
      // 1. 一句话故事 / 核心梗概推演完整大纲树
      case "generate_from_premise":
      case "generate_outline": {
        const inputPremise = premise || workDesc;
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位顶级网文金牌主编与剧情架构师。
请根据作者的小说信息与核心梗概，推演构建一套专业严密、节奏紧凑的故事大纲体系。
层级规范：分卷(volume) -> 核心情节点(scene)。
必须输出标准 JSON 数组，严禁输出任何多余闲聊，结构规范如下：
[
  {
    "title": "第一卷：卷名",
    "type": "volume",
    "goal": "本卷的核心总目标",
    "conflict": "本卷主要矛盾与阻碍",
    "children": [
      {
        "title": "情节点 1：标题",
        "type": "scene",
        "pointType": "conflict",
        "goal": "该节点解决的具体叙事问题",
        "conflict": "具体冲突矛盾",
        "eventDescription": "具体发生的核心事件脉络",
        "expectedOutcome": "事件结束后的状态变化",
        "characters": "主角, 反派, 关键配角",
        "locations": "具体地点",
        "foreshadowing": "埋设或回收的伏笔",
        "linkedChapters": [1, 2]
      }
    ]
  }
]`,
          },
          {
            role: "user",
            content: `小说书名：《${workTitle}》
题材类型：${workTag}
作品设定：${workDesc}
核心故事梗概/一句话故事：${inputPremise}
${additionalPrompt ? `额外创作诉求：${additionalPrompt}` : ""}
请生成 2~3 个分卷，每卷包含 2~3 个核心情节点的标准大纲 JSON 数组，务必保证 JSON 语法完整闭合。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7, maxTokens: 4096 });
        const tree = parseStructuredJson<any[]>(aiResponse, []);

        if (!Array.isArray(tree) || tree.length === 0) {
          return NextResponse.json(
            { success: false, message: `AI 生成大纲结构解析失败，AI原始返回: ${aiResponse?.slice(0, 150) || "空"}` },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "outline_tree",
          title: `基于《${workTitle}》推演的大纲体系`,
          generatedTree: tree,
        };
        break;
      }

      // 2. 卷大纲自动生成章节规划
      case "plan_chapters":
      case "generate_chapter_plan": {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位专业网文连载策划。请根据给定的分卷大纲，将其拆解为具体的连续章节规划。
必须输出标准 JSON 数组，格式如下：
[
  {
    "chapterNumber": 1,
    "title": "章节名称",
    "goal": "本章核心推进目标",
    "beat": "核心看点/剧情节拍",
    "cliffhanger": "章末钩子/悬念"
  }
]`,
          },
          {
            role: "user",
            content: `书名：《${workTitle}》(${workTag})
分卷/大纲信息：${premise || workDesc}
${additionalPrompt ? `作者要求：${additionalPrompt}` : ""}
请规划 5~10 章的章节细纲。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7 });
        const chapters = parseStructuredJson<any[]>(aiResponse, []);

        if (!Array.isArray(chapters) || chapters.length === 0) {
          return NextResponse.json(
            { success: false, message: "AI 章节规划生成失败或解析异常，请重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "chapter_plan",
          title: `章节连载节拍规划 (${workTitle})`,
          chapters,
        };
        break;
      }

      // 3. 扩写当前情节点
      case "expand_node": {
        const node = targetNode || existingNodes.find((n) => n.id === targetNodeId);
        const nodeTitle = node?.title || "未命名情节点";
        const nodeGoal = node?.goal || "推进剧情";

        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位顶级网文编剧。请根据当前情节点的基本信息，进行全方位的情节扩写与细节丰富。
必须输出标准 JSON 对象，格式如下：
{
  "title": "润色后的精炼标题",
  "goal": "深化的叙事目标",
  "conflict": "升级的矛盾与人物对抗",
  "eventDescription": "详细的事件发生过程（发生什么、如何推进、关键动作）",
  "expectedOutcome": "事件结束后局势与角色状态的质变",
  "characters": "出场角色列表",
  "locations": "场景地点",
  "foreshadowing": "新增埋下的伏笔或回收的线索",
  "remarks": "作者创作提示"
}`,
          },
          {
            role: "user",
            content: `小说：《${workTitle}》(${workTag})
原情节点：${nodeTitle}
原故事目标：${nodeGoal}
${node?.conflict ? `已有冲突：${node.conflict}` : ""}
${additionalPrompt ? `作者扩写诉求：${additionalPrompt}` : ""}
请展开扩写。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7 });
        const expanded = parseStructuredJson<any>(aiResponse, null);

        if (!expanded || typeof expanded !== "object" || Object.keys(expanded).length === 0) {
          return NextResponse.json(
            { success: false, message: "AI 情节点扩写生成失败，请稍后重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "expand_node",
          title: `节点扩写预览：${nodeTitle}`,
          expandedData: expanded,
        };
        break;
      }

      // 4. 拆解情节点为 4 个紧凑情节点 (起承转合)
      case "split_node": {
        const node = targetNode || existingNodes.find((n) => n.id === targetNodeId);
        const nodeTitle = node?.title || "当前节点";
        const nodeGoal = node?.goal || "剧情推进";

        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位网文结构大师。请将作者给出的单个大纲节点，按“起、承、转、合”的叙事节拍拆解为 4 个紧凑连贯的情节点。
必须输出标准 JSON 数组，格式如下：
[
  {
    "title": "情节点标题",
    "type": "scene",
    "pointType": "conflict", // conflict | twist | foreshadow | climax | transition | reveal
    "goal": "解决什么问题/达成什么目标",
    "conflict": "主要矛盾",
    "eventDescription": "具体事件过程",
    "expectedOutcome": "结果与状态变化",
    "characters": "人物",
    "locations": "地点",
    "foreshadowing": "伏笔",
    "linkedChapters": [1, 2]
  }
]`,
          },
          {
            role: "user",
            content: `小说：《${workTitle}》(${workTag})
待拆解节点：${nodeTitle}
节点目标：${nodeGoal}
${node?.eventDescription ? `事件简述：${node.eventDescription}` : ""}
${additionalPrompt ? `额外诉求：${additionalPrompt}` : ""}
请拆解为 4 个情节点。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.75 });
        const scenes = parseStructuredJson<any[]>(aiResponse, []);

        if (!Array.isArray(scenes) || scenes.length === 0) {
          return NextResponse.json(
            { success: false, message: "AI 情节点拆解生成失败，未能解析出合法情节点" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "split_node",
          title: `节点拆解预览：${nodeTitle}`,
          splitScenes: scenes,
        };
        break;
      }

      // 5. 发散 3 种替代剧情方案
      case "alternative_plots": {
        const node = targetNode || existingNodes.find((n) => n.id === targetNodeId);
        const nodeTitle = node?.title || "当前剧情";

        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位网文脑洞与戏剧策划专家。请针对作者当前的剧情节点，构思 3 种戏剧冲突完全不同的替代发展方案。
必须输出标准 JSON 数组，格式如下：
[
  {
    "badge": "方案类型标签",
    "name": "方案名称",
    "description": "核心剧情走向简述",
    "pros": "方案优势/爽点所在",
    "cons": "可能带来的长线隐患"
  }
]`,
          },
          {
            role: "user",
            content: `小说：《${workTitle}》(${workTag})
当前情节点：${nodeTitle}
当前设定：${node?.goal || workDesc}
${additionalPrompt ? `作者期望方向：${additionalPrompt}` : ""}
请发散 3 个不同走向的剧情方案。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.85 });
        const alternatives = parseStructuredJson<any[]>(aiResponse, []);

        if (!Array.isArray(alternatives) || alternatives.length === 0) {
          return NextResponse.json(
            { success: false, message: "AI 替代剧情方案生成失败，请重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "alternatives",
          title: `《${nodeTitle}》的 3 种替代剧情走向`,
          alternatives,
        };
        break;
      }

      // 6. 检查主线完整度
      case "check_mainline": {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位资深小说责任主编。请深度审阅作者的小说大纲节点，评估主线完整度、主线动机、逻辑连贯性与故事闭环。
必须输出标准 JSON 对象，格式如下：
{
  "score": 88,
  "summary": "一句话核心评价",
  "strengths": ["亮点一", "亮点二"],
  "weaknesses": ["不足一", "不足二"],
  "suggestions": ["修改建议一", "修改建议二"]
}`,
          },
          {
            role: "user",
            content: `书名：《${workTitle}》(${workTag})
小说简介：${workDesc}
当前全部大纲节点：
${existingOutlineSummary || "暂无详细节点，仅有一句话简介"}
请进行主线完整度深度体检诊断。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7 });
        const diagnosis = parseStructuredJson<any>(aiResponse, null);

        if (!diagnosis || typeof diagnosis !== "object" || !diagnosis.score) {
          return NextResponse.json(
            { success: false, message: "AI 主线完整度诊断失败，请重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "diagnosis",
          title: `主线完整度诊断报告 (${workTitle})`,
          diagnosis,
        };
        break;
      }

      // 7. 检查冲突密度
      case "check_conflict": {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位网文冲突与危机节奏专家。请评估作者大纲中的冲突密度、危机强度与升级合理性。
必须输出标准 JSON 对象，格式如下：
{
  "score": 82,
  "summary": "冲突评价",
  "strengths": ["优势一", "优势二"],
  "weaknesses": ["问题一", "问题二"],
  "suggestions": ["建议一", "建议二"]
}`,
          },
          {
            role: "user",
            content: `书名：《${workTitle}》(${workTag})
当前大纲节点：
${existingOutlineSummary || "暂无节点"}
请诊断冲突密度。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7 });
        const diagnosis = parseStructuredJson<any>(aiResponse, null);

        if (!diagnosis || typeof diagnosis !== "object" || !diagnosis.score) {
          return NextResponse.json(
            { success: false, message: "AI 冲突密度评估失败，请重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "diagnosis",
          title: `冲突密度与危机评估报告 (${workTitle})`,
          diagnosis,
        };
        break;
      }

      // 8. 检查故事节奏 (Pacing)
      case "check_pacing": {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: `你是一位网文节奏与爽点策划专家。请评估作者大纲的情绪起伏、节奏松紧与爽点释放频率。
必须输出标准 JSON 对象，格式如下：
{
  "score": 86,
  "summary": "节奏评价",
  "strengths": ["节奏优点一", "节奏优点二"],
  "weaknesses": ["节奏短板一", "节奏短板二"],
  "suggestions": ["优化建议一", "优化建议二"]
}`,
          },
          {
            role: "user",
            content: `书名：《${workTitle}》(${workTag})
当前大纲节点：
${existingOutlineSummary || "暂无节点"}
请评估节奏与情绪曲线。`,
          },
        ];

        const aiResponse = await callCloudflareAi(env.AI, messages, { temperature: 0.7 });
        const diagnosis = parseStructuredJson<any>(aiResponse, null);

        if (!diagnosis || typeof diagnosis !== "object" || !diagnosis.score) {
          return NextResponse.json(
            { success: false, message: "AI 故事节奏评估失败，请重试" },
            { status: 500 }
          );
        }

        resultPayload = {
          mode: "diagnosis",
          title: `故事节奏与情绪曲线评估 (${workTitle})`,
          diagnosis,
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, message: `未知的 AI 动作: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      result: resultPayload,
      message: "AI 推演完成",
    });
  } catch (error: any) {
    console.error("Outline AI API error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "AI 推演服务异常" },
      { status: 500 }
    );
  }
});
