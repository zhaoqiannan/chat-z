import { get, post, put, del } from "@/utils/rest";

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
  description?: string | null;
  experiences?: string | null;
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

export const getCharacterDetail = async (workId: number | string, id: number | string) => {
  return get("/api/characters", { workId, id });
};

export const createCharacter = async (data: Partial<CharacterItem> & { workId: number | string; name: string }) => {
  return post("/api/characters", data);
};

export const updateCharacter = async (data: Partial<CharacterItem> & { id: number | string }) => {
  return put("/api/characters", data);
};

export const togglePinCharacter = async (id: number | string, isPinned: boolean) => {
  return fetch("/api/characters", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, isPinned }),
  }).then((r) => r.json());
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
  region?: string | null;
  posX: number;
  posY: number;
  type: "city" | "sect" | "dungeon" | "natural" | "landmark" | string;
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

export const getLocationDetail = async (workId: number | string, id: number | string) => {
  return get("/api/locations", { workId, id });
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
  badgeUrl?: string | null;
  scale?: string | null;
  doctrine?: string | null;
  controlledLocations?: string | null;
  alignment?: string | null;
  relations?: { targetFaction: string; type: string; desc?: string }[] | null;
  description?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getFactionList = async (workId: number | string) => {
  return get("/api/factions", { workId });
};

export const getFactionDetail = async (workId: number | string, id: number | string) => {
  return get("/api/factions", { workId, id });
};

export const createFaction = async (data: Partial<FactionItem> & { workId: number | string; name: string }) => {
  return post("/api/factions", data);
};

export const updateFaction = async (data: Partial<FactionItem> & { id: number | string }) => {
  return put("/api/factions", data);
};

export const deleteFaction = async (id: number | string) => {
  return del("/api/factions", { id });
};

// ============================================================================
// 4. 物品道具法宝 API 与类型 (Items)
// ============================================================================
export interface ItemData {
  id: number;
  workId: number;
  name: string;
  category: "weapon" | "treasure" | "consumable" | "tech" | "forbidden" | "token" | string;
  tier?: string | null;
  appearance?: string | null;
  effects: string;
  drawbacks?: string | null;
  currentHolder?: string | null;
  history?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getItemList = async (workId: number | string) => {
  return get("/api/items", { workId });
};

export const getItemDetail = async (workId: number | string, id: number | string) => {
  return get("/api/items", { workId, id });
};

export const createItem = async (data: Partial<ItemData> & { workId: number | string; name: string; effects: string }) => {
  return post("/api/items", data);
};

export const updateItem = async (data: Partial<ItemData> & { id: number | string }) => {
  return put("/api/items", data);
};

export const deleteItem = async (id: number | string) => {
  return del("/api/items", { id });
};

// ============================================================================
// 5. 世界法则与境界体系 API 与类型 (World Rules)
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
  category: "power_system" | "physics_magic" | "society_law" | "taboo" | string;
  levelTree?: LevelTreeNode[] | null;
  mechanisms?: string | null;
  taboos?: string | null;
  description?: string | null;
  extra?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getWorldRuleList = async (workId: number | string) => {
  return get("/api/rules", { workId });
};

export const getWorldRuleDetail = async (workId: number | string, id: number | string) => {
  return get("/api/rules", { workId, id });
};

export const createWorldRule = async (data: Partial<WorldRuleItem> & { workId: number | string; name: string }) => {
  return post("/api/rules", data);
};

export const updateWorldRule = async (data: Partial<WorldRuleItem> & { id: number | string }) => {
  return put("/api/rules", data);
};

export const deleteWorldRule = async (id: number | string) => {
  return del("/api/rules", { id });
};

// ============================================================================
// 6. 图片上传 API (Upload)
// ============================================================================
export const uploadImageFile = async (file: File): Promise<{ success: boolean; url?: string; message?: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  return res.json();
};
