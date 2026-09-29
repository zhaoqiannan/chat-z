// 组件：素材资料库系统（统一表格、宽屏富文本新增/编辑弹窗与笔记查看一体化）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { MaterialData, getMaterialList, updateMaterial, deleteMaterial } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import MaterialsTable from "./materials-table";
import ModalCreateMaterial from "./modal-create-material";
import ModalMaterialPreview from "./modal-material-preview";

export default function MaterialsPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MaterialData[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialData | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialData | null>(null);

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMaterialList(workId, {
        keyword: searchKey,
      });
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm({
      title: "删除素材",
      message: "确定要删除该素材资料吗？此操作不可撤销。",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteMaterial(id);
        if (editingMaterial?.id === id) setEditingMaterial(null);
        if (previewMaterial?.id === id) setPreviewMaterial(null);
        useAlert.success("素材已成功删除");
        await fetchList();
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const handleTogglePin = async (item: MaterialData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextPinned = item.isPinned ? 0 : 1;
      await updateMaterial({ id: item.id, isPinned: nextPinned });
      useAlert.success(nextPinned ? "已置顶该素材" : "已取消置顶");
      await fetchList();
    } catch (err: any) {
      useAlert.error("置顶操作失败: " + (err?.message || "网络异常"));
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <LoadingOverlay visible={loading && list.length === 0} />

      {/* 表格区 */}
      <MaterialsTable
        list={list}
        searchKey={searchKey}
        onSearchChange={(val) => {
          setSearchKey(val);
          getMaterialList(workId, { keyword: val }).then((res) => {
            if (res && res.success && Array.isArray(res.result)) {
              setList(res.result);
            }
          });
        }}
        onOpenCreateModal={() => {
          setEditingMaterial(null);
          setCreateModalOpened(true);
        }}
        onOpenEditModal={(item) => {
          setEditingMaterial(item);
          setCreateModalOpened(true);
        }}
        onOpenPreviewModal={(item) => setPreviewMaterial(item)}
        onTogglePin={handleTogglePin}
        onDeleteMaterial={handleDelete}
      />

      {/* 新建/编辑素材弹窗 */}
      <ModalCreateMaterial
        opened={createModalOpened}
        onClose={() => {
          setCreateModalOpened(false);
          setEditingMaterial(null);
        }}
        workId={workId}
        initialData={editingMaterial}
        onSuccess={() => {
          fetchList();
          useAlert.success(editingMaterial ? "素材修改保存成功！" : "素材创建/上传成功！");
        }}
      />

      {/* 完整素材笔记查看弹窗 */}
      <ModalMaterialPreview
        opened={!!previewMaterial}
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        onOpenEditModal={() => {
          if (previewMaterial) {
            const item = previewMaterial;
            setPreviewMaterial(null);
            setEditingMaterial(item);
            setCreateModalOpened(true);
          }
        }}
      />
    </Box>
  );
}
