"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Menu, Tooltip } from "@mantine/core";
import {
  FiGrid,
  FiChevronDown,
  FiSearch,
  FiSettings,
  FiBell,
  FiMessageSquare,
  FiCheck,
  FiLogOut,
  FiBook,
  FiArrowLeft,
  FiLayers,
  FiFileText,
  FiDatabase,
  FiEdit3,
  FiBox,
  FiCpu,
  FiClock,
  FiShare2,
  FiSidebar,
} from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { clearUser } from "@/store/userInfo";
import { logoutUser } from "@/rest/user";
import AvatarCircle from "@/components/common/avatar-circle";
import useSessionToken from "@/hooks/useSessionToken";
import styles from "./style.module.scss";

interface MenuLayoutProps {
  children: React.ReactNode;
}

const MenuLayout = ({ children }: MenuLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.userInfo);

  const [collapsed, setCollapsed] = useState(false);
  const [worldExpanded, setWorldExpanded] = useState(true);

  // 路由状态判断
  const isProject = pathname.startsWith("/project");
  const isChat = pathname.startsWith("/home");
  const currentSpaceLabel = isChat ? "AI问答" : "个人创作空间";

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("Error calling logout API:", e);
    }
    localStorage.removeItem("user_info");
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    dispatch(clearUser());
    router.replace("/login");
  };

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const currentTab = searchParams?.get("tab") || "overview";

  const projectMenuItems = [
    {
      key: "overview",
      label: "项目概览",
      icon: <FiLayers size={16} />,
      active: currentTab === "overview",
    },
    {
      key: "outline",
      label: "故事大纲",
      icon: <FiBook size={16} />,
      active: currentTab === "outline",
      disabled: false,
    },
    {
      key: "chapters",
      label: "章节",
      icon: <FiFileText size={16} />,
      active: currentTab === "chapters",
      disabled: false,
    },
    {
      key: "world",
      label: "世界/知识库",
      icon: <FiDatabase size={16} />,
      disabled: true,
      hasSub: true,
      subItems: ["角色", "地点", "阵营", "物品", "规则"],
    },
    { key: "notes", label: "笔记", icon: <FiEdit3 size={16} />, disabled: true },
    { key: "materials", label: "素材", icon: <FiBox size={16} />, disabled: true },
    { key: "ai_analysis", label: "AI 分析", icon: <FiCpu size={16} />, disabled: true },
    { key: "timeline", label: "时间线", icon: <FiClock size={16} />, disabled: true },
    { key: "relation_graph", label: "关系图谱", icon: <FiShare2 size={16} />, disabled: true },
    { key: "settings", label: "项目设置", icon: <FiSettings size={16} />, disabled: true },
  ];

  return (
    <Box>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <div
            className={styles.brand}
            onClick={() => router.push("/workspace")}
          >
            <div className={styles.logoBadge}>N</div>
            <span className={styles.brandText}>Novel Studio</span>
          </div>

          {isProject ? (
            <Menu shadow="md" width={200} position="bottom-start" offset={8}>
              <Menu.Target>
                <div className={styles.projectSwitcher}>
                  <FiBook size={15} color="#00c9ff" />
                  <span>星际迷途</span>
                  <FiChevronDown size={14} color="#94a3b8" />
                </div>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>当前项目</Menu.Label>
                <Menu.Item leftSection={<FiBook size={14} color="#00c9ff" />}>
                  星际迷途
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<FiArrowLeft size={14} />}
                  onClick={() => router.push("/workspace")}
                >
                  返回个人创作空间
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Menu shadow="md" width={180} position="bottom-start" offset={8}>
              <Menu.Target>
                <div className={styles.spaceSwitcher}>
                  <span className={styles.switcherIcon}>
                    {isChat ? <FiMessageSquare size={15} /> : <FiGrid size={15} />}
                  </span>
                  <span>{currentSpaceLabel}</span>
                  <FiChevronDown size={14} className={styles.switcherArrow} />
                </div>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<FiGrid size={15} color={!isChat ? "#00c9ff" : undefined} />}
                  rightSection={!isChat ? <FiCheck size={14} color="#00c9ff" /> : null}
                  onClick={() => router.push("/workspace")}
                  style={{
                    fontWeight: !isChat ? 600 : 400,
                    color: !isChat ? "#00c9ff" : "#334155",
                  }}
                >
                  个人创作空间
                </Menu.Item>
                <Menu.Item
                  leftSection={<FiMessageSquare size={15} color={isChat ? "#00c9ff" : undefined} />}
                  rightSection={isChat ? <FiCheck size={14} color="#00c9ff" /> : null}
                  onClick={() => router.push("/home")}
                  style={{
                    fontWeight: isChat ? 600 : 400,
                    color: isChat ? "#00c9ff" : "#334155",
                  }}
                >
                  AI问答
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>

        <div className={styles.rightSection}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              <FiSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="搜索笔记、设定、章节..."
              className={styles.searchInput}
            />
          </div>

          <button className={styles.iconBtn} type="button" title="设置">
            <FiSettings size={17} />
          </button>

          <button className={styles.iconBtn} type="button" title="通知">
            <FiBell size={17} />
            <span className={styles.bellDot} />
          </button>

          <Menu shadow="md" width={160} position="bottom-end" offset={8}>
            <Menu.Target>
              <div className={styles.userTarget}>
                <AvatarCircle
                  text={user.name || "作家"}
                  size={32}
                  textSize="13px"
                />
                <FiChevronDown size={12} color="#94a3b8" />
              </div>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>{user.name || "用户"}</Menu.Label>
              <Menu.Item
                color="red"
                leftSection={<FiLogOut size={14} />}
                onClick={handleSignOut}
              >
                退出登录
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {isProject ? (
        <div className={styles.workbenchBody}>
          <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
            <div className={styles.menuList}>
              {projectMenuItems.map((item) => {
                const content = (
                  <div
                    key={item.key}
                    className={`${styles.menuItem} ${item.active ? styles.active : ""} ${
                      item.disabled ? styles.disabled : ""
                    } ${collapsed ? styles.collapsed : ""}`}
                    onClick={() => {
                      if (item.disabled) return;
                      if (item.hasSub && !collapsed) {
                        setWorldExpanded(!worldExpanded);
                      } else {
                        router.push(`${pathname}?tab=${item.key}`);
                      }
                    }}
                  >
                    <span>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                    {item.hasSub && !collapsed && (
                      <FiChevronDown
                        size={12}
                        style={{
                          marginLeft: "auto",
                          transform: worldExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s",
                        }}
                      />
                    )}
                  </div>
                );

                return (
                  <React.Fragment key={item.key}>
                    {collapsed ? (
                      <Tooltip label={item.label} position="right" withArrow>
                        {content}
                      </Tooltip>
                    ) : (
                      content
                    )}

                    {item.hasSub && !collapsed && worldExpanded && (
                      <div className={styles.subMenuList}>
                        {item.subItems?.map((sub) => (
                          <div key={sub} className={styles.subMenuItem}>
                            {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div
              className={`${styles.collapseToggle} ${collapsed ? styles.collapsed : ""}`}
              onClick={() => setCollapsed(!collapsed)}
            >
              <FiSidebar size={15} />
              {!collapsed && <span>折叠侧边栏</span>}
            </div>
          </aside>

          <main className={styles.projectMainContent}>
            <GetSession />
            {children}
          </main>
        </div>
      ) : (
        <main className={styles.mainContainer}>
          <GetSession />
          {children}
        </main>
      )}
    </Box>
  );
};

export default MenuLayout;

const GetSession = () => {
  useSessionToken();
  return null;
};
