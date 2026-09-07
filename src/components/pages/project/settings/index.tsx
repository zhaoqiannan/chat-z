"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Paper,
  TextInput,
  Textarea,
  Select,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  Divider,
  Group,
  RingProgress,
} from "@mantine/core";
import {
  FiSettings,
  FiSave,
  FiDownload,
  FiFileText,
  FiCode,
  FiTrash2,
  FiAlertTriangle,
  FiBookOpen,
} from "react-icons/fi";
import {
  getProjectDetailSettings,
  updateProjectSettings,
} from "@/rest/project-extensions";
import { deleteWork } from "@/rest/work";

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [workData, setWorkData] = useState<any>(null);

  // 表单
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [targetWords, setTargetWords] = useState<number>(500000);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");

  const fetchDetails = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getProjectDetailSettings(workId);
      if (res && res.success && res.result) {
        const d = res.result;
        setWorkData(d);
        setTitle(d.title || "");
        setTag(d.tag || "玄幻修真");
        setTargetWords(d.targetWords || 500000);
        setDescription(d.description || "");
        setStatus(d.status || "draft");
      }
    } catch (e) {
      console.error("获取项目设置失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [workId]);

  const handleSaveSettings = async () => {
    if (!title.trim()) {
      alert("作品书名不能为空");
      return;
    }
    try {
      setSaveLoading(true);
      const res = await updateProjectSettings({
        id: workId,
        title: title.trim(),
        tag: tag.trim(),
        targetWords: Number(targetWords),
        description: description.trim(),
        status,
      });
      if (res && res.success) {
        alert("项目设置已成功保存！");
        await fetchDetails();
      }
    } catch (err: any) {
      alert("保存失败: " + err?.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleExport = (action: "export_txt" | "export_md" | "export_json") => {
    window.open(`/api/project/settings?workId=${workId}&action=${action}`, "_blank");
  };

  const handleDeleteProject = async () => {
    const confirmation = prompt(`【高危操作警告】\n确定要彻底删除小说《${title}》及其所有章节、大纲和设定吗？此操作不可逆！\n\n如确认删除，请在下方输入书名确认：`);
    if (confirmation === title.trim()) {
      try {
        const res = await deleteWork(workId);
        if (res && res.success) {
          alert("作品已彻底删除");
          router.replace("/workspace");
        }
      } catch (e: any) {
        alert("删除失败: " + e?.message);
      }
    } else if (confirmation !== null) {
      alert("输入的书名不一致，已取消删除操作");
    }
  };

  const currentWords = workData?.wordCount || 0;
  const progressPercent = targetWords > 0 ? Math.min(100, Math.round((currentWords / targetWords) * 100)) : 0;

  return (
    <Box p="16px 20px 48px" style={{ maxWidth: 880, margin: "0 auto", minHeight: "calc(100vh - 64px)" }}>
      <LoadingOverlay visible={loading} />

      <Flex align="center" gap={8} mb={14}>
        <FiSettings size={18} color="#00c9ff" />
        <Text fw={700} fz={16} c="#1e293b">
          项目设置与数据导出
        </Text>
      </Flex>

      <Stack gap="12px">
        {/* 1. 创作字数与进度目标看板 */}
        <Paper p="14px 18px" withBorder radius="sm" bg="#ffffff">
          <Text fw={700} fz={13} c="#1e293b" mb={10}>
            📊 创作字数与进度看板
          </Text>

          <Flex align="center" justify="space-between" gap={16} wrap="wrap">
            <Flex align="center" gap={12}>
              <RingProgress
                size={60}
                roundCaps
                thickness={6}
                sections={[{ value: progressPercent, color: "cyan" }]}
                label={
                  <Text ta="center" fz={11} fw={700} c="cyan">
                    {progressPercent}%
                  </Text>
                }
              />
              <div>
                <Text fz={11} c="#64748b">全书实际总字数</Text>
                <Text fz={18} fw={800} c="#00c9ff" lh={1.2}>
                  {currentWords.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500 }}>字</span>
                </Text>
                <Text fz={11} c="#94a3b8">目标：{(targetWords || 0).toLocaleString()} 字</Text>
              </div>
            </Flex>

            <Flex gap={10}>
              <Paper p="6px 12px" bg="#f8fafc" withBorder radius="sm">
                <Text fz={10} c="#94a3b8">全书总章节数</Text>
                <Text fz={14} fw={700} c="#334155">{workData?.chapterCount || 0} 章</Text>
              </Paper>
              <Paper p="6px 12px" bg="#f8fafc" withBorder radius="sm">
                <Text fz={10} c="#94a3b8">作品状态</Text>
                <Badge size="sm" color={status === "completed" ? "green" : "yellow"} variant="light" mt={2}>
                  {status === "completed" ? "已完结" : status === "revising" ? "连载大修中" : "正在连载创作"}
                </Badge>
              </Paper>
            </Flex>
          </Flex>
        </Paper>

        {/* 2. 基本信息设置 */}
        <Paper p="14px 18px" withBorder radius="sm" bg="#ffffff">
          <Text fw={700} fz={13} c="#1e293b" mb={12}>
            📝 小说基本信息与目标
          </Text>

          <Stack gap="10px">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="10px">
              <TextInput
                size="xs"
                label="作品书名"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <TextInput
                size="xs"
                label="题材类型 / 核心标签"
                placeholder="例如：科幻都市 / 玄幻修仙"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />

              <TextInput
                size="xs"
                label="目标总字数设定"
                type="number"
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value))}
              />
            </SimpleGrid>

            <Select
              size="xs"
              label="连载/创作阶段"
              value={status}
              onChange={(v) => setStatus(v || "draft")}
              data={[
                { value: "draft", label: "🔥 正在连载构思中" },
                { value: "revising", label: "✍️ 精修打磨中" },
                { value: "completed", label: "🎉 全本已完结" },
              ]}
              style={{ maxWidth: 240 }}
            />

            <Textarea
              size="xs"
              label="核心梗概与一句话主旨介绍"
              placeholder="记录故事的起点、主线金手指与终极目标..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minRows={3}
            />

            <Flex justify="flex-end" mt={4}>
              <Button
                size="xs"

                leftSection={<FiSave size={13} />}
                loading={saveLoading}
                onClick={handleSaveSettings}
              >
                保存项目设置
              </Button>
            </Flex>
          </Stack>
        </Paper>

        {/* 3. 全书一键导出备份 */}
        <Paper p="14px 18px" withBorder radius="sm" bg="#ffffff">
          <Text fw={700} fz={13} c="#1e293b" mb={4}>
            📦 全书作品数据导出与备份
          </Text>
          <Text fz={12} c="#64748b" mb={10}>
            一键将全书正文、卷目录、大纲及世界观设定汇总导出为本地文件：
          </Text>

          <Group gap={8}>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<FiFileText size={13} />}
              onClick={() => handleExport("export_txt")}
            >
              导出为 TXT 纯文本全书
            </Button>

            <Button
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<FiBookOpen size={13} />}
              onClick={() => handleExport("export_md")}
            >
              导出为 Markdown 格式稿件
            </Button>

            <Button
              size="xs"
              variant="light"

              leftSection={<FiCode size={13} />}
              onClick={() => handleExport("export_json")}
            >
              导出全量 JSON 备份 (含世界观与大纲)
            </Button>
          </Group>
        </Paper>

        {/* 4. 危险区域 */}
        <Paper p="12px 18px" withBorder radius="sm" bg="#fff1f2" style={{ borderColor: "#fecdd3" }}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={10}>
            <div>
              <Flex align="center" gap={6} mb={2} c="#991b1b">
                <FiAlertTriangle size={15} />
                <Text fw={700} fz={13}>
                  危险操作区域
                </Text>
              </Flex>
              <Text fz={11} c="#7f1d1d">
                删除作品将会永久销毁此小说的所有章节正文、大纲节点、世界观知识库及时间线数据，此操作无法撤销。
              </Text>
            </div>

            <Button size="xs" color="red" variant="filled" leftSection={<FiTrash2 size={13} />} onClick={handleDeleteProject}>
              彻底删除该作品
            </Button>
          </Flex>
        </Paper>
      </Stack>
    </Box>
  );
}
