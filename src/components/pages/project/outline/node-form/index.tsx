"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  TextInput,
  Textarea,
  Select,
  Stack,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { OutlineNode, OutlineNodeType, PlotPointType } from "@/rest/outline";
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
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
}

interface NodeFormProps {
  initialValues?: Partial<NodeFormValues>;
  isEditing?: boolean;
  parentOptions: { value: string; label: string }[];
  errorMessage?: string;
  onChange?: (values: NodeFormValues) => void;
}

export default function NodeForm({
  initialValues,
  isEditing = true,
  parentOptions,
  errorMessage,
  onChange,
}: NodeFormProps) {
  const [title, setTitle] = useState(initialValues?.title || "");
  const [type, setType] = useState<OutlineNodeType>(initialValues?.type || "scene");
  const [pointType, setPointType] = useState<PlotPointType>(
    (initialValues?.pointType as PlotPointType) || "conflict"
  );
  const [parentId, setParentId] = useState<string | null>(initialValues?.parentId || null);
  const [goal, setGoal] = useState(initialValues?.goal || "");
  const [conflict, setConflict] = useState(initialValues?.conflict || "");
  const [eventDescription, setEventDescription] = useState(
    initialValues?.eventDescription || ""
  );
  const [expectedOutcome, setExpectedOutcome] = useState(
    initialValues?.expectedOutcome || ""
  );
  const [characters, setCharacters] = useState(initialValues?.characters || "");
  const [locations, setLocations] = useState(initialValues?.locations || "");
  const [foreshadowing, setForeshadowing] = useState(
    initialValues?.foreshadowing || ""
  );
  const [linkedChapters, setLinkedChapters] = useState<number[]>(
    Array.isArray(initialValues?.linkedChapters) ? initialValues.linkedChapters : []
  );
  const [remarks, setRemarks] = useState(initialValues?.remarks || "");

  /**
   * 当外部传入的 initialValues 变动时同步更新表单内部状态
   */
  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title || "");
      setType(initialValues.type || "scene");
      setPointType((initialValues.pointType as PlotPointType) || "conflict");
      setParentId(initialValues.parentId || null);
      setGoal(initialValues.goal || "");
      setConflict(initialValues.conflict || "");
      setEventDescription(initialValues.eventDescription || "");
      setExpectedOutcome(initialValues.expectedOutcome || "");
      setCharacters(initialValues.characters || "");
      setLocations(initialValues.locations || "");
      setForeshadowing(initialValues.foreshadowing || "");
      setLinkedChapters(
        Array.isArray(initialValues.linkedChapters) ? initialValues.linkedChapters : []
      );
      setRemarks(initialValues.remarks || "");
    }
  }, [initialValues]);

  /**
   * 状态变更触发通知
   */
  const notifyChange = (updated: Partial<NodeFormValues>) => {
    if (!onChange) return;
    onChange({
      title,
      type,
      pointType: type === "scene" ? pointType : undefined,
      parentId,
      goal,
      conflict,
      eventDescription,
      expectedOutcome,
      characters,
      locations,
      foreshadowing,
      linkedChapters,
      remarks,
      ...updated,
    });
  };

  return (
    <Stack gap="16px" className="form-box">
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="12px">
        <TextInput
          label="节点标题"
          placeholder="请输入节点名称"
          value={title}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setTitle(val);
            notifyChange({ title: val });
          }}
          required
        />

        <Select
          label="层级类型"
          value={type}
          readOnly={!isEditing}
          onChange={(val) => {
            const nextType = (val as OutlineNodeType) || "scene";
            setType(nextType);
            notifyChange({ type: nextType });
          }}
          data={OUTLINE_NODE_TYPE_OPTIONS}
        />

        {type === "scene" ? (
          <Select
            label="情节点细分类型"
            value={pointType}
            readOnly={!isEditing}
            onChange={(val) => {
              const nextPointType = (val as PlotPointType) || "conflict";
              setPointType(nextPointType);
              notifyChange({ pointType: nextPointType });
            }}
            data={PLOT_POINT_TYPE_OPTIONS}
          />
        ) : (
          <Select
            label="挂载父级节点"
            placeholder="无父节点 (顶级)"
            value={parentId || ""}
            readOnly={!isEditing}
            onChange={(val) => {
              setParentId(val || null);
              notifyChange({ parentId: val || null });
            }}
            data={parentOptions}
            clearable
          />
        )}
      </SimpleGrid>

      {type === "scene" && (
        <Select
          label="挂载父级节点"
          placeholder="请选择所属卷/幕"
          value={parentId || ""}
          readOnly={!isEditing}
          onChange={(val) => {
            setParentId(val || null);
            notifyChange({ parentId: val || null });
          }}
          data={parentOptions}
          clearable
        />
      )}

      <Textarea
        label="故事目标"
        placeholder="该节点解决什么故事问题/达成什么叙事目标？"
        value={goal}
        readOnly={!isEditing}
        onChange={(e) => {
          const val = e.currentTarget.value;
          setGoal(val);
          notifyChange({ goal: val });
        }}
        minRows={2}
        required
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
        <Textarea
          label="主要冲突"
          placeholder="人物或力量之间的矛盾与对立..."
          value={conflict}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setConflict(val);
            notifyChange({ conflict: val });
          }}
          minRows={3}
        />

        <Textarea
          label="事件描述"
          placeholder="简述该节点具体发生的核心事件脉络..."
          value={eventDescription}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setEventDescription(val);
            notifyChange({ eventDescription: val });
          }}
          minRows={3}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
        <TextInput
          label="结果 / 状态变化"
          placeholder="事件结束后局势与角色状态如何变化..."
          value={expectedOutcome}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setExpectedOutcome(val);
            notifyChange({ expectedOutcome: val });
          }}
        />

        <TextInput
          label="伏笔 (新增或回收)"
          placeholder="新增或回收的前文伏笔/线索..."
          value={foreshadowing}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setForeshadowing(val);
            notifyChange({ foreshadowing: val });
          }}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
        <TextInput
          label="关联人物"
          placeholder="如：主角, 长老, 反派圣女"
          value={characters}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setCharacters(val);
            notifyChange({ characters: val });
          }}
        />

        <TextInput
          label="关联地点"
          placeholder="如：家族正厅, 后山寒潭"
          value={locations}
          readOnly={!isEditing}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setLocations(val);
            notifyChange({ locations: val });
          }}
        />
      </SimpleGrid>

      <Box>
        <Text fz={13} fw={500} c="#475569" mb={6}>
          对应章节
        </Text>
        <ChapterPicker
          readOnly={!isEditing}
          value={linkedChapters}
          onChange={(val) => {
            if (isEditing) {
              setLinkedChapters(val);
              notifyChange({ linkedChapters: val });
            }
          }}
        />
      </Box>

      <TextInput
        label="备注说明"
        placeholder="记录作者的临时灵感或备忘说明..."
        value={remarks}
        readOnly={!isEditing}
        onChange={(e) => {
          const val = e.currentTarget.value;
          setRemarks(val);
          notifyChange({ remarks: val });
        }}
      />

      {errorMessage && (
        <Text c="red" fz="xs" fw={500}>
          {errorMessage}
        </Text>
      )}
    </Stack>
  );
}
