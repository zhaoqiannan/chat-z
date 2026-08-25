"use client";

import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import {
  Box,
  TextInput,
  Textarea,
  Select,
  Stack,
  Text,
  Grid,
} from "@mantine/core";
import { useForm, UseFormReturnType } from "@mantine/form";
import { OutlineNodeType, PlotPointType } from "@/rest/outline";
import {
  OUTLINE_NODE_TYPE_OPTIONS,
  PLOT_POINT_TYPE_OPTIONS,
} from "@/config/project.outline";
import ChapterPicker from "../chapter-picker";

export interface NodeFormValues {
  title: string;
  type: OutlineNodeType;
  pointType?: PlotPointType;
  parentId: string | null;
  goal: string;
  conflict: string;
  eventDescription: string;
  expectedOutcome: string;
  characters: string;
  locations: string;
  foreshadowing: string;
  linkedChapters: number[];
  remarks: string;
}

export interface NodeFormRef {
  validate: () => boolean;
  getValues: () => NodeFormValues;
  setValues: (values: Partial<NodeFormValues>) => void;
  reset: () => void;
}

interface NodeFormProps {
  initialValues?: Partial<NodeFormValues>;
  isEditing?: boolean;
  parentOptions: { value: string; label: string }[];
  onChange?: (values: NodeFormValues) => void;
}

const NodeForm = forwardRef<NodeFormRef, NodeFormProps>(function NodeForm(
  {
    initialValues,
    isEditing = true,
    parentOptions,
    onChange,
  },
  ref
) {
  const form: UseFormReturnType<NodeFormValues> = useForm<NodeFormValues>({
    initialValues: {
      title: initialValues?.title || "",
      type: initialValues?.type || "scene",
      pointType: (initialValues?.pointType as PlotPointType) || "conflict",
      parentId: initialValues?.parentId || null,
      goal: initialValues?.goal || "",
      conflict: initialValues?.conflict || "",
      eventDescription: initialValues?.eventDescription || "",
      expectedOutcome: initialValues?.expectedOutcome || "",
      characters: initialValues?.characters || "",
      locations: initialValues?.locations || "",
      foreshadowing: initialValues?.foreshadowing || "",
      linkedChapters: Array.isArray(initialValues?.linkedChapters)
        ? initialValues.linkedChapters
        : [],
      remarks: initialValues?.remarks || "",
    },
    validate: {
      title: (value) => (!value?.trim() ? "节点标题不能为空" : null),
      goal: (value) => (!value?.trim() ? "故事目标为必填项" : null),
    },
  });

  /**
   * 当 initialValues 变动时同步更新 form 内部值
   */
  useEffect(() => {
    if (initialValues) {
      form.setValues({
        title: initialValues.title || "",
        type: initialValues.type || "scene",
        pointType: (initialValues.pointType as PlotPointType) || "conflict",
        parentId: initialValues.parentId || null,
        goal: initialValues.goal || "",
        conflict: initialValues.conflict || "",
        eventDescription: initialValues.eventDescription || "",
        expectedOutcome: initialValues.expectedOutcome || "",
        characters: initialValues.characters || "",
        locations: initialValues.locations || "",
        foreshadowing: initialValues.foreshadowing || "",
        linkedChapters: Array.isArray(initialValues.linkedChapters)
          ? initialValues.linkedChapters
          : [],
        remarks: initialValues.remarks || "",
      });
      form.clearErrors();
    }
  }, [initialValues]);

  /**
   * 暴露方法给父组件
   */
  useImperativeHandle(ref, () => ({
    validate: () => {
      const result = form.validate();
      return !result.hasErrors;
    },
    getValues: () => form.values,
    setValues: (vals) => form.setValues(vals),
    reset: () => form.reset(),
  }));

  /**
   * 拦截值变更并通知外部
   */
  const handleFieldChange = (field: keyof NodeFormValues, value: any) => {
    form.setFieldValue(field, value);
    if (onChange) {
      onChange({ ...form.values, [field]: value });
    }
  };

  const currentType = form.values.type;

  return (
    <Stack gap="16px" className="form-box">
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="节点标题"
            placeholder="请输入节点名称"
            readOnly={!isEditing}
            required
            {...form.getInputProps("title")}
            onChange={(e) => handleFieldChange("title", e.currentTarget.value)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select
            label="层级类型"
            readOnly={!isEditing}
            data={OUTLINE_NODE_TYPE_OPTIONS}
            {...form.getInputProps("type")}
            onChange={(val) => {
              const nextType = (val as OutlineNodeType) || "scene";
              handleFieldChange("type", nextType);
            }}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          {currentType === "scene" ? (
            <Select
              label="情节点细分类型"
              readOnly={!isEditing}
              data={PLOT_POINT_TYPE_OPTIONS}
              {...form.getInputProps("pointType")}
              onChange={(val) => {
                const nextPointType = (val as PlotPointType) || "conflict";
                handleFieldChange("pointType", nextPointType);
              }}
            />
          ) : (
            <Select
              label="挂载父级节点"
              placeholder="无父节点 (顶级)"
              readOnly={!isEditing}
              data={parentOptions}
              clearable
              {...form.getInputProps("parentId")}
              onChange={(val) => handleFieldChange("parentId", val || null)}
            />
          )}
          {currentType === "scene" && (
            <Select
              label="挂载父级节点"
              placeholder="请选择所属卷/幕"
              readOnly={!isEditing}
              data={parentOptions}
              clearable
              {...form.getInputProps("parentId")}
              onChange={(val) => handleFieldChange("parentId", val || null)}
            />
          )}
        </Grid.Col>
      </Grid>

      <Textarea
        label="故事目标"
        placeholder="该节点解决什么故事问题/达成什么叙事目标？"
        readOnly={!isEditing}
        minRows={2}
        required
        {...form.getInputProps("goal")}
        onChange={(e) => handleFieldChange("goal", e.currentTarget.value)}
      />

      <Textarea
        label="主要冲突"
        placeholder="人物或力量之间的矛盾与对立..."
        readOnly={!isEditing}
        minRows={3}
        {...form.getInputProps("conflict")}
        onChange={(e) => handleFieldChange("conflict", e.currentTarget.value)}
      />

      <Textarea
        label="事件描述"
        placeholder="简述该节点具体发生的核心事件脉络..."
        readOnly={!isEditing}
        minRows={3}
        {...form.getInputProps("eventDescription")}
        onChange={(e) => handleFieldChange("eventDescription", e.currentTarget.value)}
      />

      <TextInput
        label="结果 / 状态变化"
        placeholder="事件结束后局势与角色状态如何变化..."
        readOnly={!isEditing}
        {...form.getInputProps("expectedOutcome")}
        onChange={(e) => handleFieldChange("expectedOutcome", e.currentTarget.value)}
      />

      <TextInput
        label="伏笔 (新增或回收)"
        placeholder="新增或回收的前文伏笔/线索..."
        readOnly={!isEditing}
        {...form.getInputProps("foreshadowing")}
        onChange={(e) => handleFieldChange("foreshadowing", e.currentTarget.value)}
      />

      <TextInput
        label="关联人物"
        placeholder="如：主角, 长老, 反派圣女"
        readOnly={!isEditing}
        {...form.getInputProps("characters")}
        onChange={(e) => handleFieldChange("characters", e.currentTarget.value)}
      />

      <TextInput
        label="关联地点"
        placeholder="如：家族正厅, 后山寒潭"
        readOnly={!isEditing}
        {...form.getInputProps("locations")}
        onChange={(e) => handleFieldChange("locations", e.currentTarget.value)}
      />

      <Box>
        <Text size="md" fw={700} mb={8}>
          对应章节
        </Text>
        <ChapterPicker
          readOnly={!isEditing}
          value={form.values.linkedChapters}
          onChange={(val) => {
            if (isEditing) {
              handleFieldChange("linkedChapters", val);
            }
          }}
        />
      </Box>

      <TextInput
        label="备注说明"
        placeholder="记录作者的临时灵感或备忘说明..."
        readOnly={!isEditing}
        {...form.getInputProps("remarks")}
        onChange={(e) => handleFieldChange("remarks", e.currentTarget.value)}
      />
    </Stack>
  );
});

export default NodeForm;
