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
    <Box p="24px 36px 80px" style={{ maxWidth: 960, margin: "0 auto", minHeight: "calc(100vh - 64px)" }}>
      <LoadingOverlay visible={loading} />

      <Flex align="center" gap={10} mb={24}>
        <FiSettings size={22} color="#00c9ff" />
        <Text fw={700} fz={20} c="#1e293b">
          项目设置与数据导出
        </Text>
      </Flex>

      <Stack gap="24px">
        {/* 1. 创作字数与进度目标看板 */}
        <Paper p="20px 24px" withBorder radius="md" bg="#ffffff">
          <Text fw={700} fz={15} c="#1e293b" mb={14}>
            📊 创作字数与进度看板
          </Text>

          <Flex align="center" justify="space-between" gap={20} wrap="wrap">
            <Flex align="center" gap={16}>
              <RingProgress
                size={80}
                roundCaps
                thickness={8}
                sections={[{ value: progressPercent, color: "cyan" }]}
                label={
                  <Text ta="center" fz={12} fw={700} c="cyan">
                    {progressPercent}%
                  </Text>
                }
              />
              <div>
                <Text fz={12} c="#64748b">当前全书实际总字数</Text>
                <Text fz={22} fw={800} c="#00c9ff">
                  {currentWords.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500 }}>字</span>
                </Text>
                <Text fz={12} c="#94a3b8">目标总字数：{(targetWords || 0).toLocaleString()} 字</Text>
              </div>
            </Flex>

            <Flex gap={20}>
              <Paper p="10px 16px" bg="#f8fafc" withBorder radius="md">
                <Text fz={11} c="#94a3b8">全书总章节数</Text>
                <Text fz={18} fw={700} c="#334155">{workData?.chapterCount || 0} 章</Text>
              </Paper>
              <Paper p="10px 16px" bg="#f8fafc" withBorder radius="md">
                <Text fz={11} c="#94a3b8">作品状态</Text>
                <Badge color={status === "completed" ? "green" : "yellow"} variant="light" mt={4}>
                  {status === "completed" ? "已完结" : status === "revising" ? "连载大修中" : "正在连载创作"}
                </Badge>
              </Paper>
            </Flex>
          </Flex>
        </Paper>

        {/* 2. 基本信息设置 */}
        <Paper p="20px 24px" withBorder radius="md" bg="#ffffff">
          <Text fw={700} fz={15} c="#1e293b" mb={16}>
            📝 小说基本信息与目标
          </Text>

          <Stack gap="16px">
            <SimpleGrid cols={3}>
              <TextInput
                label="作品书名"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <TextInput
                label="题材类型 / 核心标签"
                placeholder="例如：科幻都市 / 玄幻修仙"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />

              <TextInput
                label="目标总字数设定"
                type="number"
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value))}
              />
            </SimpleGrid>

            <Select
              label="连载/创作阶段"
              value={status}
              onChange={(v) => setStatus(v || "draft")}
              data={[
                { value: "draft", label: "🔥 正在连载构思中" },
                { value: "revising", label: "✍️ 精修打磨中" },
                { value: "completed", label: "🎉 全本已完结" },
              ]}
              style={{ maxWidth: 300 }}
            />

            <Textarea
              label="核心梗概与一句话主旨介绍"
              placeholder="记录故事的起点、主线金手指与终极目标..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minRows={4}
            />

            <Flex justify="flex-end" mt={10}>
              <Button
                color="cyan"
                leftSection={<FiSave size={14} />}
                loading={saveLoading}
                onClick={handleSaveSettings}
              >
                保存项目设置
              </Button>
            </Flex>
          </Stack>
        </Paper>

        {/* 3. 全书一键导出备份 */}
        <Paper p="20px 24px" withBorder radius="md" bg="#ffffff">
          <Text fw={700} fz={15} c="#1e293b" mb={8}>
            📦 全书作品数据导出与备份
          </Text>
          <Text fz={13} c="#64748b" mb={16}>
            一键将全书正文、卷目录、大纲及世界观设定汇总导出为本地文件：
          </Text>

          <Group gap={14}>
            <Button
              variant="light"
              color="teal"
              leftSection={<FiFileText size={14} />}
              onClick={() => handleExport("export_txt")}
            >
              导出为 TXT 纯文本全书
            </Button>

            <Button
              variant="light"
              color="indigo"
              leftSection={<FiBookOpen size={14} />}
              onClick={() => handleExport("export_md")}
            >
              导出为 Markdown 格式稿件
            </Button>

            <Button
              variant="light"
              color="cyan"
              leftSection={<FiCode size={14} />}
              onClick={() => handleExport("export_json")}
            >
              导出全量 JSON 备份 (含世界观与大纲)
            </Button>
          </Group>
        </Paper>

        {/* 4. 危险区域 */}
        <Paper p="20px 24px" withBorder radius="md" bg="#fff1f2" style={{ borderColor: "#fecdd3" }}>
          <Flex align="center" gap={8} mb={6} c="#991b1b">
            <FiAlertTriangle size={18} />
            <Text fw={700} fz={15}>
              危险操作区域
            </Text>
          </Flex>
          <Text fz={13} c="#7f1d1d" mb={14}>
            删除作品将会永久销毁此小说的所有章节正文、大纲节点、世界观知识库及时间线数据，此操作无法撤销。
          </Text>

          <Button color="red" variant="filled" leftSection={<FiTrash2 size={14} />} onClick={handleDeleteProject}>
            彻底删除该作品
          </Button>
        </Paper>
      </Stack>
    </Box>
  );
}
