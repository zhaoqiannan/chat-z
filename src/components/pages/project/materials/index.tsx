// 组件：素材资料库系统（表格多维筛选、详情沉浸侧栏与新建上传调度）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { MaterialData, getMaterialList, createMaterial, deleteMaterial } from "@/rest/project-extensions";
import { uploadImageFile } from "@/rest/world";
import MaterialsTable from "./materials-table";
import PanelMaterialDetail from "./panel-material-detail";
import ModalCreateMaterial from "./modal-create-material";

export default function MaterialsPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MaterialData[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialData | null>(null);
  const [createModalOpened, setCreateModalOpened] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMaterialList(workId, {
        fileType: typeFilter,
        status: statusFilter,
        keyword: searchKey,
      });
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
        if (selectedMaterial) {
          const matched = res.result.find((m) => m.id === selectedMaterial.id);
          if (matched) setSelectedMaterial(matched);
        } else if (res.result.length > 0) {
          setSelectedMaterial(res.result[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId, typeFilter, statusFilter]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workId) return;

    try {
      setLoading(true);
      let fileType = "document";
      if (file.type.startsWith("image/")) fileType = "image";
      else if (file.type.startsWith("audio/")) fileType = "audio";
      else if (file.type.startsWith("video/")) fileType = "video";

      const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      let uploadedUrl = "";
      if (fileType === "image") {
        const uploadRes = await uploadImageFile(file);
        if (uploadRes && uploadRes.success && uploadRes.url) {
          uploadedUrl = uploadRes.url;
        }
      }

      const res = await createMaterial({
        workId: Number(workId),
        title: file.name,
        fileName: file.name,
        fileType,
        fileSize: fileSizeStr,
        fileUrl: uploadedUrl || undefined,
        status: "processed",
      });

      if (res && res.success && res.result) {
        await fetchList();
        setSelectedMaterial(res.result);
      }
    } catch (err: any) {
      alert("上传素材异常: " + (err?.message || "网络错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该素材资料吗？此操作不可撤销。")) {
      try {
        await deleteMaterial(id);
        if (selectedMaterial?.id === id) setSelectedMaterial(null);
        await fetchList();
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
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

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleUploadFile}
      />

      <MaterialsTable
        list={list}
        selectedMaterialId={selectedMaterial?.id || null}
        searchKey={searchKey}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onSearchChange={(val) => {
          setSearchKey(val);
          fetchList();
        }}
        onTypeFilterChange={setTypeFilter}
        onStatusFilterChange={setStatusFilter}
        onSelectMaterial={(item) => setSelectedMaterial(item)}
        onOpenCreateModal={() => setCreateModalOpened(true)}
        onTriggerUpload={() => fileInputRef.current?.click()}
        onDeleteMaterial={handleDelete}
      />

      {selectedMaterial && (
        <PanelMaterialDetail
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          onUpdateSuccess={(updated) => {
            setSelectedMaterial(updated);
            setList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }}
        />
      )}

      <ModalCreateMaterial
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        workId={workId}
        onSuccess={(created) => {
          fetchList();
          setSelectedMaterial(created);
        }}
      />
    </Box>
  );
}
