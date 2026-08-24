import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines } from "@/db";
import { eq, and } from "drizzle-orm";

/**
 * 结构化 AI 故事大纲生成逻辑
 */
function generateMockStoryOutline(title: string, tag: string, description: string) {
  return [
    {
      type: "volume",
      title: "第一卷：风起微末",
      goal: "交代世界观体系与主角初始困境，获得机缘并立下宏大誓约",
      conflict: "自身实力弱小与宗门/家族强权的压迫",
      characters: "主角, 导师/护道者, 宿敌",
      locations: "边陲小镇, 家族演武场, 祖传禁地",
      expectedOutcome: "成功破局，获得首个金手指并踏上宗门历练之路",
      linkedChapters: "第 1 ~ 10 章",
      children: [
        {
          type: "act",
          title: "第一幕：深渊开局",
          goal: "展现主角当前的绝境危机，激起读者的同理心与期待感",
          conflict: "核心资源被夺，遭遇强权逼迫",
          characters: "主角, 家族长老, 跋扈反派",
          locations: "家族正厅",
          expectedOutcome: "主角隐忍不发，暗中探寻破局之法",
          linkedChapters: "第 1 ~ 3 章",
          children: [
            {
              type: "scene",
              title: "场景：退婚/夺宝之辱",
              goal: "高烈度情绪爆发，确立全书前期主线目标",
              conflict: "反派上门威逼，族人冷眼旁观",
              characters: "主角, 退婚者, 父亲",
              locations: "议事大厅",
              expectedOutcome: "立下三年誓约，埋下复仇伏笔",
              linkedChapters: "第 1 章",
            },
            {
              type: "event",
              title: "事件：金手指觉醒",
              goal: "扭转绝境，提供实力飙升的底层逻辑支撑",
              conflict: "神魂反噬与生死考验",
              characters: "主角, 戒中神秘老者/器灵",
              locations: "后山静室",
              expectedOutcome: "掌握失传功法，突破瓶颈",
              linkedChapters: "第 2 ~ 3 章",
            },
          ],
        },
        {
          type: "act",
          title: "第二幕：初露锋芒",
          goal: "在公开场合展现新实力，打脸前期质疑者",
          conflict: "宗门大比/家族考核中的生死擂台",
          characters: "主角, 竞争对手, 宗门考官",
          locations: "比武广场",
          expectedOutcome: "一战成名，获取前往更高学府/秘境的资格",
          linkedChapters: "第 4 ~ 7 章",
        },
      ],
    },
    {
      type: "volume",
      title: "第二卷：潜龙出海",
      goal: "离开新手村，踏入广袤大地图，直面跨阶层势力冲突",
      conflict: "多方势力的利益倾轧与远古遗迹的争夺",
      characters: "主角, 新结识道友, 敌对宗门圣子",
      locations: "中州帝都, 天断山脉, 远古秘境",
      expectedOutcome: "建立自己的势力雏形，揭开大陆隐秘一角",
      linkedChapters: "第 11 ~ 30 章",
    },
  ];
}

/**
 * AI 章节规划与大纲推演接口
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { workId, mode, nodeContext, applyDirectly } = body;

    if (!workId) {
      return NextResponse.json(
        { success: false, message: "workId 不能为空" },
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

    // 生成大纲规划建议
    const generatedTree = generateMockStoryOutline(
      work.title,
      work.tag,
      work.description || ""
    );

    // 如果用户选择“直接应用写入数据库”
    if (applyDirectly) {
      let order = 0;
      const insertNodeRecursive = async (node: any, parentId: string | null = null) => {
        const nodeId = crypto.randomUUID();
        order += 1;
        await db.insert(outlines).values({
          id: nodeId,
          workId,
          parentId,
          type: node.type,
          title: node.title,
          goal: node.goal,
          conflict: node.conflict || "",
          characters: node.characters || "",
          locations: node.locations || "",
          expectedOutcome: node.expectedOutcome || "",
          linkedChapters: node.linkedChapters || "",
          orderIndex: order,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            await insertNodeRecursive(child, nodeId);
          }
        }
      };

      for (const rootNode of generatedTree) {
        await insertNodeRecursive(rootNode, null);
      }
    }

    return NextResponse.json({
      success: true,
      result: generatedTree,
      message: applyDirectly
        ? "AI 大纲已成功生成并写入当前作品！"
        : "AI 大纲规划方案生成成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "AI 规划失败" },
      { status: 500 }
    );
  }
});
