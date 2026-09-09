// 组件：素材资料库系统（统一表格、60vw 智能摘要弹窗、60vw 预览弹窗与新建上传一体化）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { MaterialData, getMaterialList, deleteMaterial } from "@/rest/project-extensions";
import MaterialsTable from "./materials-table";
import ModalCreateMaterial from "./modal-create-material";
import ModalMaterialSummary from "./modal-material-summary";
import ModalMaterialPreview from "./modal-material-preview";

export default function MaterialsPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MaterialData[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [summaryMaterial, setSummaryMaterial] = useState<MaterialData | null>(null);
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
    if (confirm("确定要删除该素材资料吗？此操作不可撤销。")) {
      try {
        await deleteMaterial(id);
        if (summaryMaterial?.id === id) setSummaryMaterial(null);
        if (previewMaterial?.id === id) setPreviewMaterial(null);
        await fetchList();
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const handleUpdateSuccess = (updated: MaterialData) => {
    setList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (summaryMaterial?.id === updated.id) setSummaryMaterial(updated);
    if (previewMaterial?.id === updated.id) setPreviewMaterial(updated);
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
        onOpenCreateModal={() => setCreateModalOpened(true)}
        onOpenSummaryModal={(item) => setSummaryMaterial(item)}
        onOpenPreviewModal={(item) => setPreviewMaterial(item)}
        onDeleteMaterial={handleDelete}
      />

      {/* 新建/上传素材弹窗 */}
      <ModalCreateMaterial
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        workId={workId}
        onSuccess={(created) => {
          fetchList();
          setPreviewMaterial(created);
        }}
      />

      {/* 60vw 智能摘要与设定弹窗 */}
      <ModalMaterialSummary
        opened={!!summaryMaterial}
        material={summaryMaterial}
        onClose={() => setSummaryMaterial(null)}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* 60vw 素材正文与文档查看弹窗 */}
      <ModalMaterialPreview
        opened={!!previewMaterial}
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        onOpenSummaryModal={() => {
          if (previewMaterial) {
            setSummaryMaterial(previewMaterial);
          }
        }}
      />
    </Box>
  );
}
