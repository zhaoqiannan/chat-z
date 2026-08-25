"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Flex } from "@mantine/core";
import { CreateOutlinePayload, OutlineNodeType } from "@/rest/outline";
import NodeForm, { NodeFormValues } from "../node-form";

interface ModalCreateNodeProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  parentOptions: { value: string; label: string }[];
  defaultParentId?: string | null;
  defaultType?: OutlineNodeType;
  onSubmit: (data: CreateOutlinePayload) => Promise<void>;
}

export default function ModalCreateNode({
  opened,
  onClose,
  workId,
  parentOptions,
  defaultParentId,
  defaultType = "scene",
  onSubmit,
}: ModalCreateNodeProps) {
  const [formValues, setFormValues] = useState<NodeFormValues>({
    title: "",
    type: defaultType,
    pointType: "conflict",
    parentId: defaultParentId || null,
    goal: "",
    conflict: "",
    eventDescription: "",
    expectedOutcome: "",
    characters: "",
    locations: "",
    foreshadowing: "",
    linkedChapters: [],
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * 弹窗打开时重置表单为初始值
   */
  useEffect(() => {
    if (opened) {
      setFormValues({
        title: "",
        type: defaultType || "scene",
        pointType: "conflict",
        parentId: defaultParentId || null,
        goal: "",
        conflict: "",
        eventDescription: "",
        expectedOutcome: "",
        characters: "",
        locations: "",
        foreshadowing: "",
        linkedChapters: [],
        remarks: "",
      });
      setError("");
    }
  }, [opened, defaultParentId, defaultType]);

  /**
   * 提交新增节点
   */
  const handleSubmit = async () => {
    if (!formValues.title.trim()) {
      setError("节点标题不能为空");
      return;
    }
    if (!formValues.goal.trim()) {
      setError("故事目标为必填项");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit({
        workId,
        parentId: formValues.parentId || null,
        type: formValues.type,
        pointType: formValues.type === "scene" ? formValues.pointType : undefined,
        title: formValues.title.trim(),
        goal: formValues.goal.trim(),
        conflict: formValues.conflict?.trim() || "",
        eventDescription: formValues.eventDescription?.trim() || "",
        expectedOutcome: formValues.expectedOutcome?.trim() || "",
        characters: formValues.characters?.trim() || "",
        locations: formValues.locations?.trim() || "",
        foreshadowing: formValues.foreshadowing?.trim() || "",
        linkedChapters: formValues.linkedChapters || [],
        remarks: formValues.remarks?.trim() || "",
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "创建大纲节点失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="新建大纲节点"
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
    >
      <NodeForm
        initialValues={formValues}
        isEditing={true}
        parentOptions={parentOptions}
        errorMessage={error}
        onChange={(val) => setFormValues(val)}
      />

      <Flex justify="flex-end" gap={10} mt={24}>
        <Button variant="subtle" color="gray" onClick={onClose}>
          取消
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          确认创建
        </Button>
      </Flex>
    </Modal>
  );
}
