"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Badge, Box, Flex, Text, Tooltip } from "@mantine/core";
import useSessionToken from "@/hooks/useSessionToken";
import { menuConfig } from "@/config/menu";
import styles from "./style.module.scss";
import Image from "next/image";
import {
    FiChevronLeft,
    FiChevronRight,
    FiChevronDown,
    FiChevronUp
} from "react-icons/fi";
import MenuUserInfo from "./user-info";

interface MenuLayoutProps {
    children: React.ReactNode;
}

const MenuLayout = ({ children }: MenuLayoutProps) => {
    const router = useRouter();
    const pathname = usePathname();

    const [collapsed, setCollapsed] = useState(false);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        "core-query": true,
        "data-service": true,
    });

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    return (
        <AppShell
            navbar={{
                width: collapsed ? 72 : 260,
                breakpoint: 'sm'
            }}
            padding={0}
            styles={{
                root: {
                    display: "flex",
                    flexDirection: "row",
                    width: "100vw",
                    height: "100vh",
                    overflow: "hidden",
                },
                navbar: {
                    position: "relative",
                    height: "100%",
                    flexShrink: 0,
                    transition: "width 0.2s ease",
                    background: "#ffffff",
                    borderRight: "1px solid #f0f0f0",
                },
                main: {
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: 0,
                    background: "#f5f7fa",
                    boxSizing: "border-box",
                },
            }}
        >
            <AppShell.Navbar className={styles.navbar} w={collapsed ? 72 : 230}>
                <Box h={80} pl={16} pr={16} className={`${styles.logoArea} ${collapsed ? styles.collapsed : ""}`}>
                    {!collapsed ? (
                        <Box h={32} className={styles.logoWrapper}>
                            <Image
                                src="/images/logo.png"
                                alt="YoujiVest Logo"
                                width={120}
                                height={28}
                                style={{ objectFit: 'contain', height: '100%' }}
                                priority
                            />
                        </Box>
                    ) : (
                        <Flex justify="center" align="center" w="100%" h={32}>
                            <Image
                                src="/images/logo-mini.svg"
                                alt="YoujiVest Mini Logo"
                                width={24}
                                height={24}
                                style={{ objectFit: 'contain', height: '100%' }}
                                priority
                            />
                        </Flex>
                    )}
                </Box>

                <Box className={styles.menuList}>
                    {menuConfig.map((group) => {
                        const isGroupExpanded = expandedGroups[group.key] !== false;
                        return (
                            <Box key={group.key} className={styles.menuGroup}>
                                {!collapsed ? (
                                    <div
                                        className={styles.groupHeader}
                                        onClick={() => toggleGroup(group.key)}
                                    >
                                        <Text className={styles.groupTitle}>{group.label}</Text>
                                        {isGroupExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                    </div>
                                ) : null}

                                {(collapsed || isGroupExpanded) && (
                                    <div className={styles.groupItems}>
                                        {group.children.map((item) => {
                                            const isActive = item.path === pathname || pathname.startsWith(item.path + "/");
                                            const itemContent = (
                                                <Box
                                                    className={`${styles.menuItem} ${isActive ? styles.active : ""} ${collapsed ? styles.collapsed : ""}`}
                                                    onClick={() => router.push(item.path)}
                                                >
                                                    <Flex align={'center'} justify={collapsed ? "center" : "flex-start"} gap={6} w="100%">
                                                        <Text className={styles.menuIcon}>{item.icon}</Text>
                                                        {!collapsed && <Text className={styles.menuLabel} size="xs" lh={'inherit'}>{item.label}</Text>}
                                                        {!collapsed && item.badge && <Badge size="xs" lh={'inherit'}>{item.badge}</Badge>}
                                                    </Flex>
                                                </Box>
                                            );

                                            return collapsed ? (
                                                <Tooltip
                                                    key={item.key}
                                                    label={item.label}
                                                    position="right"
                                                    withArrow
                                                    offset={12}
                                                >
                                                    {itemContent}
                                                </Tooltip>
                                            ) : (
                                                <React.Fragment key={item.key}>
                                                    {itemContent}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                <Box className={`${styles.collapseSection} ${collapsed ? styles.collapsed : ""}`} bottom={90}>
                    <div
                        className={styles.collapseBtn}
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? "展开菜单" : "收起菜单"}
                    >
                        {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
                    </div>
                </Box>

                <MenuUserInfo collapsed={collapsed} />
            </AppShell.Navbar>

            <AppShell.Main>
                <GetSession />
                {children}
            </AppShell.Main>
        </AppShell >
    );
};

export default MenuLayout;

const GetSession = () => {
    useSessionToken();
    return null;
};
