export interface RoleLevelDef {
  key: string;
  name: string;
  defaultOpen: boolean;
}

export const ROLE_LEVELS: RoleLevelDef[] = [
  { key: "protagonist", name: "主角", defaultOpen: true },
  { key: "major", name: "重要配角", defaultOpen: true },
  { key: "antagonist", name: "反派", defaultOpen: true },
  { key: "supporting", name: "配角", defaultOpen: true },
  { key: "mob", name: "龙套", defaultOpen: false },
];

export const ROLE_NAME_MAP: Record<string, string> = {
  protagonist: "主角",
  major: "重要配角",
  antagonist: "反派",
  supporting: "配角",
  mob: "龙套",
};

// 统一主色调与其透明度体系 (单主色调 + 层次透明度)
export const BRAND = {
  primary: "#00b2e0",
  primaryHover: "#009ec8",
  text: "#00839e",
  textDark: "#006c82",
  bgSubtle: "rgba(0, 201, 255, 0.03)",
  bgLight: "rgba(0, 201, 255, 0.08)",
  bgMedium: "rgba(0, 201, 255, 0.14)",
  borderLight: "rgba(0, 201, 255, 0.18)",
  borderMedium: "rgba(0, 201, 255, 0.32)",
};
