import { get, post, put, patch, del } from "@/utils/rest";

// ============================================================================
// 1. 角色 API 与类型 (Characters)
// ============================================================================
export interface CharacterItem {
  id: number;
  workId: number;
  name: string;
  alias?: string | null;
  gender?: string | null;
  age?: string | null;
  identity?: string | null;
  faction?: string | null;
  roleType: "protagonist" | "major" | "supporting" | "antagonist" | "mob" | string;
  appearance?: string | null;
  avatarUrl?: string | null;
  personality?: string | null;
  personalIntro?: string | null;
  description?: string | null;
  background?: string | null;
  experiences?: string | null;
  inspirationFragments?: string | null;
  relationships?: { targetName: string; relation: string; description?: string }[] | null;
  organizations?: string | null;
  abilities?: string | null;
  tags?: string | null;
  appearanceChapters?: string | null;
  characterArc?: string | null;
  isPinned?: number | boolean;
  pinnedAt?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getCharacterList = async (workId: number | string) => {
  return get("/api/characters", { workId });
};

export const createCharacter = async (data: Partial<CharacterItem> & { workId: number | string; name: string }) => {
  return post("/api/characters", data);
};

export const updateCharacter = async (data: Partial<CharacterItem> & { id: number | string }) => {
  return put("/api/characters", data);
};

export const togglePinCharacter = async (id: number | string, isPinned: boolean) => {
  return patch("/api/characters", { id, isPinned });
};

export const deleteCharacter = async (id: number | string) => {
  return del("/api/characters", { id });
};

// ============================================================================
// 2. 地点与地图打点 API 与类型 (Locations)
// ============================================================================
export interface LocationRecord {
  id: number;
  workId: number;
  name: string;
  alias?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  region?: string | null;
  posX: number;
  posY: number;
  type?: "city" | "sect" | "dungeon" | "natural" | "landmark" | string;
  background?: string | null;
  geography?: string | null;
  customs?: string | null;
  climate?: string | null;
  terrain?: string | null;
  features?: string | null;
  specialties?: string | null;
  governingFaction?: string | null;
  plotPoints?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getLocationList = async (workId: number | string) => {
  return get("/api/locations", { workId });
};

export const createLocation = async (data: Partial<LocationRecord> & { workId: number | string; name: string }) => {
  return post("/api/locations", data);
};

export const updateLocation = async (data: Partial<LocationRecord> & { id: number | string }) => {
  return put("/api/locations", data);
};

export const deleteLocation = async (id: number | string) => {
  return del("/api/locations", { id });
};

// ============================================================================
// 3. 阵营与势力 API 与类型 (Factions)
// ============================================================================
export interface FactionItem {
  id: number;
  workId: number;
  name: string;
  leader?: string | null;
  leaderId?: number | null;
  badgeUrl?: string | null;
  scale?: string | null;
  doctrine?: string | null;
  controlledLocations?: string | null;
  locationId?: number | null;
  alignment?: "positive" | "negative" | "neutral" | string | null;
  trend?: string | null;
  relations?: { targetFaction: string; type: string; desc?: string }[] | null;
  description?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getFactionList = async (workId: number | string) => {
  return get("/api/factions", { workId });
};

export const createFaction = async (data: Partial<FactionItem> & { workId: number | string; name: string }) => {
  return post("/api/factions", data);
};

export const updateFaction = async (data: Partial<FactionItem> & { id: number | string }) => {
  return put("/api/factions", data);
};

export const deleteFaction = async (id: number | string) => {
  return del(`/api/factions?id=${id}`, { id });
};

// ============================================================================
// 4. 物品道具法宝 API 与类型 (Items)
// ============================================================================
export interface ItemData {
  id: number;
  workId: number;
  name: string;
  category?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  faction?: string | null;
  description?: string | null;
  effects?: string | null;
  tier?: string | null;
  appearance?: string | null;
  drawbacks?: string | null;
  currentHolder?: string | null;
  history?: string | null;
  imageUrl?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getItemList = async (workId: number | string) => {
  return get("/api/items", { workId });
};

export const createItem = async (data: Partial<ItemData> & { workId: number | string; name: string }) => {
  return post("/api/items", data);
};

export const updateItem = async (data: Partial<ItemData> & { id: number | string }) => {
  return put("/api/items", data);
};

export const deleteItem = async (id: number | string) => {
  return del(`/api/items?id=${id}`, { id });
};

// ============================================================================
// 5. 世界法则与规则设定 API 与类型 (World Rules)
// ============================================================================
export interface LevelTreeNode {
  order: number;
  name: string;
  lifespan?: string;
  breakthrough?: string;
  bottleneck?: string;
  powers?: string;
}

export interface WorldRuleItem {
  id: number;
  workId: number;
  name: string;
  category?: string | null;
  characters?: string | null;
  factions?: string | null;
  description?: string | null;
  mechanisms?: string | null;
  effects?: string | null;
  drawbacks?: string | null;
  taboos?: string | null;
  levelTree?: LevelTreeNode[] | null;
  extra?: Record<string, any> | null;
  isPinned?: number | null;
  pinnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getWorldRuleList = async (workId: number | string) => {
  return get("/api/rules", { workId });
};

export const createWorldRule = async (data: Partial<WorldRuleItem> & { workId: number | string; name: string }) => {
  return post("/api/rules", data);
};

export const updateWorldRule = async (data: Partial<WorldRuleItem> & { id: number | string }) => {
  return put("/api/rules", data);
};

export const deleteWorldRule = async (id: number | string) => {
  return del(`/api/rules?id=${id}`, { id });
};

export const uploadImageFile = async (
  file: File
): Promise<{ success: boolean; url?: string; fileSize?: string; fileName?: string; message?: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload/", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  try {
    return await res.json();
  } catch {
    return { success: false, message: `上传失败 (${res.status})` };
  }
};

// ============================================================================
// 6. 全文智能扫描沉淀世界观设定 API（单次 AI 调用覆盖 7 大模块）
// ============================================================================
export type WorldSyncScope =
  | "all"
  | "characters"
  | "locations"
  | "factions"
  | "items"
  | "rules"
  | "relations"
  | "timeline";

export interface WorldSyncCandidateBase {
  tempId: string;
  status: "new" | "update";
  existingId?: number;
  existingSummary?: string;
  sourceChapter?: string;
}

export interface WorldSyncCharacterCandidate extends WorldSyncCandidateBase {
  name: string;
  alias?: string;
  gender?: string;
  identity?: string;
  roleType?: string;
  faction?: string;
  personality?: string;
  abilities?: string;
  appearance?: string;
  description?: string;
}

export interface WorldSyncLocationCandidate extends WorldSyncCandidateBase {
  name: string;
  region?: string;
  type?: string;
  geography?: string;
  features?: string;
  governingFaction?: string;
  description?: string;
}

export interface WorldSyncFactionCandidate extends WorldSyncCandidateBase {
  name: string;
  leader?: string;
  alignment?: string;
  scale?: string;
  doctrine?: string;
  controlledLocations?: string;
  description?: string;
}

export interface WorldSyncItemCandidate extends WorldSyncCandidateBase {
  name: string;
  category?: string;
  tier?: string;
  ownerName?: string;
  effects: string;
  drawbacks?: string;
  description?: string;
}

export interface WorldSyncRuleCandidate extends WorldSyncCandidateBase {
  name: string;
  category?: string;
  mechanisms?: string;
  drawbacks?: string;
  taboos?: string;
  description?: string;
}

export interface WorldSyncRelationCandidate extends WorldSyncCandidateBase {
  sourceCharName: string;
  targetCharName: string;
  relationType: string;
  relationTag?: string;
  description?: string;
}

export interface WorldSyncTimelineCandidate extends WorldSyncCandidateBase {
  timePoint: string;
  title: string;
  location?: string;
  characters?: string;
  impactLevel?: string;
  description?: string;
}

export interface WorldSyncCandidatesBundle {
  characters: WorldSyncCharacterCandidate[];
  locations: WorldSyncLocationCandidate[];
  factions: WorldSyncFactionCandidate[];
  items: WorldSyncItemCandidate[];
  rules: WorldSyncRuleCandidate[];
  relations: WorldSyncRelationCandidate[];
  timelineEvents: WorldSyncTimelineCandidate[];
}

export interface ExtractWorldFromChaptersResult {
  scannedChapters: Array<{ id: number; chapterNumber: number; title: string; wordCount: number }>;
  candidates: WorldSyncCandidatesBundle;
  totalCount: number;
}

export const extractWorldFromChapters = async (data: {
  workId: number | string;
  chapterIds?: Array<number | string>;
  onlyUnscanned?: boolean;
}) => {
  return post("/api/ai/world/extract-from-chapters", data);
};

export const applyExtractedWorldEntities = async (data: {
  workId: number | string;
  scannedChapterIds?: Array<number | string>;
  selected: Partial<WorldSyncCandidatesBundle>;
}) => {
  return post("/api/ai/world/apply-extracted", data);
};
