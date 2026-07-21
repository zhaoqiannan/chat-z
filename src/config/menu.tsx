import { ReactNode } from "react";
import {
  FiMap,
  FiMapPin,
  FiAlertTriangle,
  FiDatabase,
  FiFileText,
  FiCode,
} from "react-icons/fi";

export interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon?: ReactNode;
  badge?: number | string;
  children?: MenuItem[];
}

export interface MenuGroup {
  key: string;
  label: string;
  children: MenuItem[];
}

export const menuConfig: MenuGroup[] = [
  {
    key: "core-query",
    label: "核心功能",
    children: [
      {
        key: "risk-map-overview",
        label: "新对话",
        path: "/home",
        icon: <FiMap />,
      },
    ],
  }
];
