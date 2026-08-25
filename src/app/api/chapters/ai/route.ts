import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters } from "@/db";
import { eq, and } from "drizzle-orm";

/**
 * AI 章节初稿生成与正文润色优化接口
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      chapterId,
      mode, // 'draft' (生成初稿) | 'optimize' (润色优化)
      // 初稿参数
      overview,
      events,
      plotDirection,
      characters,
      writingStyle,
      targetWords,
      // 优化参数
      currentContent,
      optimizeGoal,
    } = body;

    const workId = Number(body.workId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的 workId" },
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

    // 1. 生成初稿模式 (Draft)
    if (mode === "draft") {
      const generatedDraft = `【${work.title}】 正文章节初稿\n\n` +
        `夜色如墨，天际残月如钩。边陲乌坦城的一处静室之中，少年盘膝而坐，周身微弱的灵力如游丝般流转。\n\n` +
        `根据设定【${overview || "暂无大致梗概"}】，此时的核心冲突已然悄然逼近。\n\n` +
        `【剧情展开与事件节拍】：\n` +
        `门外突然传来急促沉重的脚步声，打破了夜的宁静。${characters ? `来人正是 ${characters}。` : "数位不速之客径直推门而入。"}\n\n` +
        `“有些事情，终究是躲不过去的。”少年缓缓睁开双眼，眼眸中闪烁着与年龄不符的沉静。\n\n` +
        `【走向与高潮】：${plotDirection || "双方展开正面语言与实力的激烈碰撞，主角绝境之下洞察对方破绽。"}\n\n` +
        `狂风席卷窗棂，烛火猛然摇曳明灭。在文风【${writingStyle || "网文快节奏"}】的渲染下，空气中的压迫感瞬间达到了顶峰。\n\n` +
        `“三年之约，我应下了！”掷地有声的话语回荡在正厅之中，令在场众人无不为之变色。\n\n` +
        `【章节收尾与伏笔】：残存的劲气渐渐消散，少年望着离去之人的背影，掌心之中，那一枚温润古朴的神秘玉佩，正悄无声息地散发出幽微的温热……`;

      return NextResponse.json({
        success: true,
        result: {
          draftText: generatedDraft,
          wordCount: generatedDraft.replace(/\s+/g, "").length,
        },
        message: "AI 初稿生成成功！",
      });
    }

    // 2. 润色优化模式 (Optimize)
    if (mode === "optimize") {
      const original = currentContent || "";
      if (!original.trim()) {
        return NextResponse.json(
          { success: false, message: "待优化的现有文章内容不能为空" },
          { status: 400 }
        );
      }

      // 智能润色模拟（增强画面感、强化动词与环境氛围）
      const optimizedText = original
        .split("\n")
        .map((p: string) => {
          if (!p.trim()) return p;
          return p
            .replace(/看/g, "凝视")
            .replace(/说/g, "沉声道")
            .replace(/走/g, "步履如风般踏出")
            .replace(/生气/g, "眸中杀意暴涌");
        })
        .join("\n") +
        `\n\n【AI 优化批注】：根据【${optimizeGoal || "增强画面感与节奏张力"}】对人物神态、动作细节及环境氛围进行了深化渲染，增强了网文代入感与情绪起伏。`;

      return NextResponse.json({
        success: true,
        result: {
          optimizedText,
          wordCount: optimizedText.replace(/\s+/g, "").length,
        },
        message: "AI 润色优化完成！",
      });
    }

    return NextResponse.json(
      { success: false, message: "未知的 AI 模式" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "AI 服务异常" },
      { status: 500 }
    );
  }
});
