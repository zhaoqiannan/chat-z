"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Box, Button, Divider, Flex, Group, Paper, Progress, RingProgress, SimpleGrid, Stack, Text } from "@mantine/core";
import { FiAlertTriangle, FiArrowRight, FiBookmark, FiCheck, FiCheckCircle, FiCompass, FiEye, FiInfo, FiUser } from "react-icons/fi";
import { AnalysisChapterBrief, AnalysisReportRecord } from "@/rest/analysis";
import { createNote } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";
import styles from "./style.module.scss";

interface ReportViewerProps {
  workId: string;
  record: AnalysisReportRecord;
  chapters: AnalysisChapterBrief[];
}

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "严重矛盾", color: "red" },
  medium: { label: "疑似漏洞", color: "orange" },
  low: { label: "细节建议", color: "cyan" },
};

const OOC_RISK_MAP: Record<string, string> = {
  高: "red",
  中: "orange",
  低: "green",
};

export default function ReportViewer({ workId, record, chapters }: ReportViewerProps) {
  const router = useRouter();
  const [savedTodoKeys, setSavedTodoKeys] = useState<Record<string, boolean>>({});
  const [savingTodoKey, setSavingTodoKey] = useState<string | null>(null);

  const report = record.report || {};
  const score = Number(record.overallScore || report.overallScore || 0);

  const resolveChapterId = (chapterId?: number | null, chapterNumber?: number | null): number | null => {
    if (chapterId && chapters.some((c) => c.id === Number(chapterId))) {
      return Number(chapterId);
    }
    if (chapterNumber) {
      const found = chapters.find((c) => c.chapterNumber === Number(chapterNumber));
      if (found) return found.id;
    }
    return null;
  };

  const handleJumpChapter = (chapterId?: number | null, chapterNumber?: number | null) => {
    const resolved = resolveChapterId(chapterId, chapterNumber);
    if (resolved) {
      router.push(`/project/${workId}?tab=chapters&chapterId=${resolved}`);
    } else {
      router.push(`/project/${workId}?tab=chapters`);
    }
  };

  const handleAddTodo = async (key: string, title: string, detail: string, chapterNumber?: number | null) => {
    if (savedTodoKeys[key]) return;
    try {
      setSavingTodoKey(key);
      const prefix = chapterNumber ? `[第${chapterNumber}章] ` : "";
      const res = await createNote({
        workId: Number(workId),
        title: `${prefix}${title}`.slice(0, 60),
        content: `【来源：${record.scopeLabel}】\n${detail}`,
        category: "plot",
        isTodo: 1,
        priority: "high",
      });
      if (res && res.success) {
        setSavedTodoKeys((prev) => ({ ...prev, [key]: true }));
        useAlert.success("已加入修改待办（可在「笔记」中查看）");
      } else {
        useAlert.error(res?.message || "加入待办失败");
      }
    } catch (e: any) {
      useAlert.error("加入待办失败: " + (e?.message || "网络异常"));
    } finally {
      setSavingTodoKey(null);
    }
  };

  const renderActionButtons = (key: string, title: string, detail: string, chapterId?: number | null, chapterNumber?: number | null) => {
    const resolvedId = resolveChapterId(chapterId, chapterNumber);
    const isSaved = Boolean(savedTodoKeys[key]);

    return (
      <Group gap={6} mt={8}>
        {resolvedId || chapterNumber ? (
          <Button
            size="compact-xs"
            variant="light"
            rightSection={<FiArrowRight size={11} />}
            onClick={() => handleJumpChapter(chapterId, chapterNumber)}
          >
            跳转第 {chapterNumber || ""} 章
          </Button>
        ) : null}
        <Button
          size="compact-xs"
          variant={isSaved ? "subtle" : "default"}
          color={isSaved ? "green" : undefined}
          leftSection={isSaved ? <FiCheck size={11} /> : <FiBookmark size={11} />}
          loading={savingTodoKey === key}
          disabled={isSaved}
          onClick={() => handleAddTodo(key, title, detail, chapterNumber)}
        >
          {isSaved ? "已加入待办" : "加入修改待办"}
        </Button>
      </Group>
    );
  };

  return (
    <Stack gap={14}>
      {/* 总评卡片 */}
      <Paper p={16} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
        <Flex align="center" gap={16} wrap="wrap">
          <RingProgress
            size={76}
            thickness={7}
            roundCaps
            sections={[{ value: score, color: score >= 80 ? "#00c9ff" : score >= 65 ? "orange" : "red" }]}
            label={
              <Text ta="center" fz={16} fw={800} c="#0f172a">
                {score}
              </Text>
            }
          />
          <Box flex={1} miw={220}>
            <Flex align="center" gap={8} mb={4} wrap="wrap">
              <Text fz={15} fw={700} c="#0f172a">{record.scopeLabel}</Text>
              <Badge size="xs" variant="light">{new Date(record.createdAt).toLocaleString()}</Badge>
            </Flex>
            <Text fz={13} c="#334155" lh={1.6}>{report.summary || "分析已完成"}</Text>
            {report.progressDiagnosis ? (
              <Text fz={12} c="#64748b" mt={6} lh={1.6}>进度与剧情评估：{report.progressDiagnosis}</Text>
            ) : null}
            {report.goalAchievement ? (
              <Text fz={12} c="#64748b" mt={6} lh={1.6}>预期目标评估：{report.goalAchievement}</Text>
            ) : null}
          </Box>
        </Flex>
      </Paper>

      {/* 多维评分 */}
      {Array.isArray(report.dimensions) && report.dimensions.length > 0 ? (
        <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
          <Text fz={13} fw={700} c="#0f172a" mb={10}>维度评分</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={10}>
            {report.dimensions.map((d: any, idx: number) => (
              <Box key={idx} p={10} bg="#fafbfc" bdrs={6} bd="1px solid #f1f5f9">
                <Flex justify="space-between" align="center" mb={4}>
                  <Text fz={12} fw={600} c="#334155">{d.name}</Text>
                  <Text fz={12} fw={700} c="#00c9ff">{d.score} 分</Text>
                </Flex>
                <Progress value={Number(d.score) || 0} size="xs" color="#00c9ff" mb={6} />
                <Text fz={11.5} c="#64748b" lh={1.5}>{d.comment}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>
      ) : null}

      {/* 全书分析：亮点与风险 */}
      {record.analysisType === "book_overview" && (Array.isArray(report.strengths) || Array.isArray(report.risks)) ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12}>
          <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
            <Flex align="center" gap={6} mb={8}>
              <FiCheckCircle size={14} color="#10b981" />
              <Text fz={13} fw={700} c="#0f172a">核心亮点</Text>
            </Flex>
            <Stack gap={6}>
              {(report.strengths || []).map((item: string, i: number) => (
                <Text key={i} fz={12.5} c="#334155" lh={1.6}>• {item}</Text>
              ))}
            </Stack>
          </Paper>

          <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
            <Flex align="center" gap={6} mb={8}>
              <FiAlertTriangle size={14} color="#f59e0b" />
              <Text fz={13} fw={700} c="#0f172a">潜在风险预警</Text>
            </Flex>
            <Stack gap={6}>
              {(report.risks || []).map((item: string, i: number) => (
                <Text key={i} fz={12.5} c="#334155" lh={1.6}>• {item}</Text>
              ))}
            </Stack>
          </Paper>
        </SimpleGrid>
      ) : null}

      {/* 区间分析：逐章节奏诊断 */}
      {Array.isArray(report.chapterPacing) && report.chapterPacing.length > 0 ? (
        <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
          <Flex align="center" gap={6} mb={10}>
            <FiCompass size={14} color="#00c9ff" />
            <Text fz={13} fw={700} c="#0f172a">逐章节奏诊断</Text>
          </Flex>
          <Stack gap={8}>
            {report.chapterPacing.map((ch: any, idx: number) => (
              <Flex key={idx} align="center" justify="space-between" gap={10} p={10} bg="#fafbfc" bdrs={6} bd="1px solid #f1f5f9" wrap="wrap">
                <Box flex={1} miw={200}>
                  <Group gap={6} mb={2}>
                    <Text fz={12.5} fw={700} c="#0f172a">第 {ch.chapterNumber} 章 {ch.title}</Text>
                    <Badge size="xs" variant="light">{ch.pacingTag}</Badge>
                    <Badge size="xs" variant="outline" color="gray">{ch.score} 分</Badge>
                  </Group>
                  <Text fz={12} c="#475569">{ch.note}</Text>
                </Box>
                <Button size="compact-xs" variant="subtle" rightSection={<FiArrowRight size={11} />} onClick={() => handleJumpChapter(ch.chapterId, ch.chapterNumber)}>
                  去编辑
                </Button>
              </Flex>
            ))}
          </Stack>
        </Paper>
      ) : null}

      {/* 区间分析：伏笔追踪表 */}
      {report.foreshadowing ? (
        <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
          <Flex align="center" gap={6} mb={10}>
            <FiEye size={14} color="#00c9ff" />
            <Text fz={13} fw={700} c="#0f172a">伏笔与线索追踪</Text>
          </Flex>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing={10}>
            <Box p={10} bg="#fafbfc" bdrs={6} bd="1px solid #f1f5f9">
              <Text fz={12} fw={700} c="#0f172a" mb={6}>新埋伏笔</Text>
              {(report.foreshadowing.planted || []).length > 0 ? (
                <Stack gap={6}>
                  {report.foreshadowing.planted.map((f: any, i: number) => (
                    <Text key={i} fz={12} c="#334155" lh={1.5}>• [第{f.chapterNumber}章] {f.clue}</Text>
                  ))}
                </Stack>
              ) : (
                <Text fz={12} c="#94a3b8">暂无明显新埋伏笔</Text>
              )}
            </Box>

            <Box p={10} bg="#fafbfc" bdrs={6} bd="1px solid #f1f5f9">
              <Text fz={12} fw={700} c="#0f172a" mb={6}>已回收伏笔</Text>
              {(report.foreshadowing.resolved || []).length > 0 ? (
                <Stack gap={6}>
                  {report.foreshadowing.resolved.map((f: any, i: number) => (
                    <Text key={i} fz={12} c="#334155" lh={1.5}>• [第{f.chapterNumber}章] {f.clue}</Text>
                  ))}
                </Stack>
              ) : (
                <Text fz={12} c="#94a3b8">本区间暂无回收伏笔</Text>
              )}
            </Box>

            <Box p={10} bg="#fffbeb" bdrs={6} bd="1px solid #fef3c7">
              <Text fz={12} fw={700} c="#92400e" mb={6}>疑似落下 / 断线伏笔</Text>
              {(report.foreshadowing.forgotten || []).length > 0 ? (
                <Stack gap={6}>
                  {report.foreshadowing.forgotten.map((f: any, i: number) => (
                    <Box key={i}>
                      <Text fz={12} c="#78350f" lh={1.5}>• [第{f.chapterNumber}章] {f.clue}</Text>
                      {renderActionButtons(`fg-${record.id}-${i}`, `补全伏笔：${String(f.clue || "").slice(0, 20)}`, f.clue || "", null, f.chapterNumber)}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Text fz={12} c="#92400e">暂未发现明显断线伏笔</Text>
              )}
            </Box>
          </SimpleGrid>
        </Paper>
      ) : null}

      {/* 逻辑审查：冲突列表 */}
      {record.analysisType === "logic_audit" ? (
        <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
          <Text fz={13} fw={700} c="#0f172a" mb={10}>逻辑与设定审查结果</Text>
          {Array.isArray(report.issues) && report.issues.length > 0 ? (
            <Stack gap={10}>
              {report.issues.map((issue: any, idx: number) => {
                const sev = SEVERITY_MAP[issue.severity] || SEVERITY_MAP.medium;
                return (
                  <Box key={idx} className={styles.issueCard}>
                    <Group gap={6} mb={6}>
                      <Badge size="xs" color={sev.color} variant="light">{sev.label}</Badge>
                      {issue.category ? <Badge size="xs" color="gray" variant="outline">{issue.category}</Badge> : null}
                      <Text fz={13} fw={700} c="#0f172a">{issue.title}</Text>
                    </Group>
                    <Text fz={12.5} c="#334155" lh={1.6} mb={4}>冲突依据：{issue.evidence}</Text>
                    <Text fz={12} c="#64748b" lh={1.6}>修复建议：{issue.fixSuggestion}</Text>
                    {renderActionButtons(`lg-${record.id}-${idx}`, issue.title || "逻辑修复", `${issue.evidence}\n修复建议：${issue.fixSuggestion}`, issue.chapterId, issue.chapterNumber)}
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Flex align="center" gap={6} c="#10b981">
              <FiCheckCircle size={15} />
              <Text fz={13}>所选章节未发现明显设定或逻辑矛盾。</Text>
            </Flex>
          )}

          {Array.isArray(report.passedChecks) && report.passedChecks.length > 0 ? (
            <>
              <Divider my={12} color="#f1f5f9" />
              <Text fz={12} fw={600} c="#475569" mb={6}>自洽良好项</Text>
              <Stack gap={4}>
                {report.passedChecks.map((p: string, i: number) => (
                  <Text key={i} fz={12} c="#64748b">✓ {p}</Text>
                ))}
              </Stack>
            </>
          ) : null}
        </Paper>
      ) : null}

      {/* 人物性格 OOC 分析 */}
      {record.analysisType === "character_audit" && Array.isArray(report.characterReports) ? (
        <Stack gap={12}>
          {report.characterReports.map((cr: any, idx: number) => (
            <Paper key={idx} p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
              <Flex align="center" justify="space-between" mb={8} wrap="wrap" gap={8}>
                <Group gap={8}>
                  <FiUser size={15} color="#00c9ff" />
                  <Text fz={14} fw={700} c="#0f172a">{cr.name}</Text>
                  <Badge size="xs" variant="light">人设贴合 {cr.consistencyScore} 分</Badge>
                  <Badge size="xs" color={OOC_RISK_MAP[cr.oocRisk] || "gray"} variant="outline">
                    OOC 风险：{cr.oocRisk || "低"}
                  </Badge>
                </Group>
              </Flex>

              <Text fz={12.5} c="#334155" lh={1.6} mb={8}>成长弧光评估：{cr.arcProgress}</Text>

              {Array.isArray(cr.highlights) && cr.highlights.length > 0 ? (
                <Box mb={10}>
                  <Text fz={12} fw={600} c="#475569" mb={4}>立住人设的高光细节</Text>
                  {cr.highlights.map((h: string, i: number) => (
                    <Text key={i} fz={12} c="#334155" lh={1.5}>• {h}</Text>
                  ))}
                </Box>
              ) : null}

              {Array.isArray(cr.oocIssues) && cr.oocIssues.length > 0 ? (
                <Stack gap={8}>
                  <Text fz={12} fw={600} c="#92400e">OOC / 人设强化建议</Text>
                  {cr.oocIssues.map((oi: any, i: number) => (
                    <Box key={i} className={styles.issueCard}>
                      <Text fz={12.5} c="#334155" lh={1.6}>[第 {oi.chapterNumber} 章] {oi.detail}</Text>
                      <Text fz={12} c="#64748b" mt={4} lh={1.6}>优化建议：{oi.suggestion}</Text>
                      {renderActionButtons(`ch-${record.id}-${idx}-${i}`, `${cr.name}人设调整`, `${oi.detail}\n建议：${oi.suggestion}`, oi.chapterId, oi.chapterNumber)}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Text fz={12} c="#10b981">✓ 本区间内该角色言行高度贴合人设，未见明显 OOC。</Text>
              )}
            </Paper>
          ))}
        </Stack>
      ) : null}

      {/* 通用可执行修改建议清单（全书 / 区间） */}
      {Array.isArray(report.suggestions) && report.suggestions.length > 0 ? (
        <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #f1f5f9">
          <Flex align="center" gap={6} mb={10}>
            <FiInfo size={14} color="#00c9ff" />
            <Text fz={13} fw={700} c="#0f172a">可执行修改建议清单</Text>
          </Flex>
          <Stack gap={10}>
            {report.suggestions.map((s: any, idx: number) => (
              <Box key={idx} className={styles.issueCard}>
                <Group gap={6} mb={4}>
                  {s.chapterNumber ? <Badge size="xs" variant="light">第 {s.chapterNumber} 章</Badge> : null}
                  <Text fz={13} fw={700} c="#0f172a">{s.title}</Text>
                </Group>
                <Text fz={12.5} c="#334155" lh={1.6}>{s.detail}</Text>
                {renderActionButtons(`sg-${record.id}-${idx}`, s.title || "修改建议", s.detail || "", s.chapterId, s.chapterNumber)}
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
