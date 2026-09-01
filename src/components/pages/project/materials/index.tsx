"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Text,
  Button,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  Paper,
  Image,
  FileInput,
  Group,
  Card,
  ScrollArea,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiBox,
  FiUploadCloud,
  FiBook,
} from "react-icons/fi";
import {
  MaterialData,
  getMaterialList,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from "@/rest/project-extensions";
import { uploadImageFile } from "@/rest/world";

export default function MaterialsPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MaterialData[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialData | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("knowledge");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchMaterials = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMaterialList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取素材列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle("");
    setCategory("knowledge");
    setContent("");
    setTags("");
    setFileUrl("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: MaterialData) => {
    setEditingItem(item);
    setTitle(item.title || "");
    setCategory(item.category || "knowledge");
    setContent(item.content || "");
    setTags(item.tags || "");
    setFileUrl(item.fileUrl || "");
    setModalOpened(true);
  };

  const handleUploadFile = async (file: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        setFileUrl(res.url);
      }
    } catch (e: any) {
      alert("上传失败: " + (e?.message || "网络异常"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("请输入素材资料主题！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateMaterial({
          id: editingItem.id,
          title: title.trim(),
          category,
          content: content.trim() || undefined,
          tags: tags.trim() || undefined,
          fileUrl: fileUrl.trim() || undefined,
        });
      } else {
        await createMaterial({
          workId: Number(workId),
          title: title.trim(),
          category,
          content: content.trim() || undefined,
          tags: tags.trim() || undefined,
          fileUrl: fileUrl.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchMaterials();
    } catch (e: any) {
      alert("保存素材失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("确定要删除该素材资料吗？")) {
      const res = await deleteMaterial(id);
      if (res && res.success) {
        await fetchMaterials();
      }
    }
  };

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchKey ||
      item.title.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.tags && item.tags.toLowerCase().includes(searchKey.toLowerCase()));

    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getCatLabel = (cat: string) => {
    switch (cat) {
      case "knowledge":
        return <Badge color="cyan" variant="light" size="xs">🌾 专业知识</Badge>;
      case "reference":
        return <Badge color="indigo" variant="light" size="xs">📐 设定参考</Badge>;
      case "photo":
        return <Badge color="teal" variant="light" size="xs">🖼️ 图片图鉴</Badge>;
      case "doc":
        return <Badge color="orange" variant="light" size="xs">📜 历史文献</Badge>;
      default:
        return <Badge color="gray" variant="light" size="xs">资料</Badge>;
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: "xl" }}>
        <Group justify="space-between" align="center" mb="lg" wrap="wrap">
          <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 540 }}>
            <TextInput
              placeholder="搜索素材标题、专业知识或标签..."
              leftSection={<FiSearch size={14} />}
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              style={{ flex: 1 }}
            />

            <Select
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v || "all")}
              data={[
                { value: "all", label: "全部素材分类" },
                { value: "knowledge", label: "🌾 专业知识" },
                { value: "reference", label: "📐 设定参考" },
                { value: "photo", label: "🖼️ 图片图鉴" },
                { value: "doc", label: "📜 历史文献" },
              ]}
              style={{ width: 160 }}
            />
          </Group>

          <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
            新建素材资料
          </Button>
        </Group>

        <Box pos="relative" style={{ minHeight: 300 }}>
          <LoadingOverlay visible={loading} />

          {filteredList.length === 0 && !loading ? (
            <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
              <FiBox size={40} strokeWidth={1.2} />
              <Text fz={15} fw={600}>暂无素材资料</Text>
              <Text fz={13}>点击右上角「新建素材资料」收集种植知识、武器枪械、民俗常识等小说参考素材</Text>
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
              {filteredList.map((item) => (
                <Card
                  key={item.id}
                  shadow="sm"
                  radius="md"
                  withBorder
                  p="md"
                  onClick={() => handleOpenEdit(item)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.fileUrl && (
                    <Box mb="xs" style={{ borderRadius: 8, overflow: "hidden", maxHeight: 150, background: "#f1f5f9" }}>
                      <Image src={item.fileUrl} alt={item.title} height={140} fit="cover" radius="sm" />
                    </Box>
                  )}

                  <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
                    <Text fz={16} fw={700} c="dark.7" truncate="end">
                      {item.title}
                    </Text>
                    {getCatLabel(item.category)}
                  </Group>

                  {item.tags && (
                    <Text fz={11} c="cyan.8" mb="xs" truncate="end">
                      🏷️ {item.tags}
                    </Text>
                  )}

                  <Text
                    fz={13}
                    c="dark.5"
                    mb="md"
                    lineClamp={4}
                    style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                  >
                    {item.content || "（点击补充详细资料笔记...）"}
                  </Text>

                  <Group justify="flex-end" gap="xs" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                    <ActionIcon variant="subtle" color="cyan" size="xs" onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}>
                      <FiEdit size={13} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="xs" onClick={(e) => handleDelete(item.id, e)}>
                      <FiTrash2 size={13} />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Box>
      </ScrollArea>

      {/* 70vw 宽屏舒适创建/编辑素材 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiBook color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑素材 - ${editingItem.title}` : "新建素材与专业资料"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="素材主题 / 资料名称"
              placeholder="例如：菊花种植技术与节气习俗..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ gridColumn: "span 2" }}
            />

            <Select
              label="素材类型"
              value={category}
              onChange={(val) => setCategory(val || "knowledge")}
              data={[
                { value: "knowledge", label: "🌾 专业领域知识 (如农业/医学/科技)" },
                { value: "reference", label: "📐 战力与设定数值参考" },
                { value: "photo", label: "🖼️ 图片与视觉图鉴" },
                { value: "doc", label: "📜 历史文献与考据" },
              ]}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="检索标签 (逗号分隔)"
              placeholder="例如：农学, 园艺, 节气, 药用价值"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />

            <div>
              <Text fz={14} fw={500} mb={4}>上传参考图片 / 资料图</Text>
              <FileInput
                placeholder="点击选择本地图片或文档上传"
                leftSection={<FiUploadCloud size={14} />}
                onChange={handleUploadFile}
                disabled={uploading}
                accept="image/*"
              />
            </div>
          </SimpleGrid>

          {fileUrl && (
            <Paper p="xs" withBorder bg="gray.0" radius="md">
              <Text fz={12} c="dimmed" mb="xs">已关联参考图片预览：</Text>
              <Image src={fileUrl} alt="参考图" height={160} fit="contain" radius="sm" />
            </Paper>
          )}

          <Textarea
            label="详细知识内容 / 摘录参考资料"
            placeholder="粘贴或输入该专业领域的详细操作规范、生长周期、温度要求或历史渊源，方便在写作时随时查阅..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={7}
            autosize
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认添加素材"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
