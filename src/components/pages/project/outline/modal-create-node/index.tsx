"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Flex } from "@mantine/core";
import { CreateOutlinePayload, OutlineNodeType } from "@/rest/outline";
import NodeForm, { NodeFormValues, NodeFormRef } from "../node-form";

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
  const formRef = useRef<NodeFormRef>(null);
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
    }
  }, [opened, defaultParentId, defaultType]);

  /**
   * 提交新增节点 (基于 Mantine 表单校验)
   */
  const handleSubmit = async () => {
    if (!formRef.current) return;
    const isValid = formRef.current.validate();
    if (!isValid) {
      return;
    }

    const currentData = formRef.current.getValues();

    try {
      setLoading(true);
      await onSubmit({
        workId,
        parentId: currentData.parentId || null,
        type: currentData.type,
        pointType: currentData.type === "scene" ? currentData.pointType : undefined,
        title: currentData.title.trim(),
        goal: currentData.goal.trim(),
        conflict: currentData.conflict?.trim() || "",
        eventDescription: currentData.eventDescription?.trim() || "",
        expectedOutcome: currentData.expectedOutcome?.trim() || "",
        characters: currentData.characters?.trim() || "",
        locations: currentData.locations?.trim() || "",
        foreshadowing: currentData.foreshadowing?.trim() || "",
        linkedChapters: currentData.linkedChapters || [],
        remarks: currentData.remarks?.trim() || "",
      });
      onClose();
    } catch (err: any) {
      console.error("创建大纲节点失败:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="新建大纲节点"
      size="60vw"
      centered
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
    >
      <NodeForm
        ref={formRef}
        initialValues={formValues}
        isEditing={true}
        parentOptions={parentOptions}
        onChange={(val) => setFormValues(val)}
      />

      <Flex justify="flex-end" gap={10} mt={24}>
        <Button variant="outline" color="gray" onClick={onClose}>
          取消
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          确认创建
        </Button>
      </Flex>
    </Modal>
  );
}
