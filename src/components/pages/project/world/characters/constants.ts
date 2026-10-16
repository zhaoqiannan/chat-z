export interface RoleThemeConfig {
  key: string;
  name: string;
  defaultOpen: boolean;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  avatarBg: string;
  avatarBorder: string;
  avatarColor: string;
  accentBar: string;
}

export const ROLE_THEME_MAP: Record<string, RoleThemeConfig> = {
  protagonist: {
    key: "protagonist",
    name: "主角",
    defaultOpen: true,
    color: "amber",
    badgeBg: "#fffbeb",
    badgeBorder: "#fde68a",
    badgeColor: "#b45309",
    avatarBg: "#fef3c7",
    avatarBorder: "#fde68a",
    avatarColor: "#b45309",
    accentBar: "#f59e0b",
  },
  major: {
    key: "major",
    name: "重要配角",
    defaultOpen: true,
    color: "blue",
    badgeBg: "#eff6ff",
    badgeBorder: "#bfdbfe",
    badgeColor: "#1d4ed8",
    avatarBg: "#eff6ff",
    avatarBorder: "#dbeafe",
    avatarColor: "#2563eb",
    accentBar: "#3b82f6",
  },
  antagonist: {
    key: "antagonist",
    name: "反派",
    defaultOpen: true,
    color: "rose",
    badgeBg: "#fff1f2",
    badgeBorder: "#fecdd3",
    badgeColor: "#be123c",
    avatarBg: "#fff1f2",
    avatarBorder: "#fecdd3",
    avatarColor: "#e11d48",
    accentBar: "#f43f5e",
  },
  supporting: {
    key: "supporting",
    name: "配角",
    defaultOpen: true,
    color: "emerald",
    badgeBg: "#f0fdf4",
    badgeBorder: "#bbf7d0",
    badgeColor: "#15803d",
    avatarBg: "#f0fdf4",
    avatarBorder: "#dcfce7",
    avatarColor: "#16a34a",
    accentBar: "#10b981",
  },
  mob: {
    key: "mob",
    name: "龙套",
    defaultOpen: false,
    color: "slate",
    badgeBg: "#f8fafc",
    badgeBorder: "#e2e8f0",
    badgeColor: "#475569",
    avatarBg: "#f1f5f9",
    avatarBorder: "#e2e8f0",
    avatarColor: "#64748b",
    accentBar: "#94a3b8",
  },
};

export const ROLE_LEVELS: RoleThemeConfig[] = [
  ROLE_THEME_MAP.protagonist,
  ROLE_THEME_MAP.major,
  ROLE_THEME_MAP.antagonist,
  ROLE_THEME_MAP.supporting,
  ROLE_THEME_MAP.mob,
];

export const DEFAULT_ROLE_THEME = ROLE_THEME_MAP.supporting;
