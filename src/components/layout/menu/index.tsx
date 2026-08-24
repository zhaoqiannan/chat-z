"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Flex, Text, Menu } from "@mantine/core";
import {
  FiGrid,
  FiChevronDown,
  FiSearch,
  FiSettings,
  FiBell,
  FiMessageSquare,
  FiCheck,
  FiLogOut,
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

      <main className={styles.mainContainer}>
        <GetSession />
        {children}
      </main>
    </Box>
  );
};

export default MenuLayout;

const GetSession = () => {
  useSessionToken();
  return null;
};
