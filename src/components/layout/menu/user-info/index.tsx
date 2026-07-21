"use client";

import React from "react";
import { Center, Flex, Menu, Text, Box } from "@mantine/core";
import { useRouter } from "next/navigation";
import styles from "../style.module.scss";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { clearUser } from "@/store/userInfo";
import AvatarCircle from "@/components/common/avatar-circle";
import { logoutUser } from "@/rest/user";

interface MenuUserInfoProps {
  collapsed?: boolean;
}

const MenuUserInfo = ({ collapsed }: MenuUserInfoProps) => {
  const user = useSelector((state: RootState) => state.userInfo);
  const dispatch = useDispatch();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("Error calling logout API:", e);
    }
    localStorage.removeItem("user_info");
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    dispatch(clearUser());
    router.replace('/login');
  };

  return (
    <Box className={styles.user} pl={12} pr={12} pt={16} pb={16}>
      <Menu width={160} shadow="md" position="right-end" offset={10}>
        <Menu.Target>
          <Flex
            align="center"
            gap={collapsed ? 0 : 12}
            justify={collapsed ? "center" : "flex-start"}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <Flex style={{ flexShrink: 0 }}>
              <AvatarCircle
                text={user.name}
                size={collapsed ? 36 : 40}
                textSize={collapsed ? "14px" : "16px"}
              />
            </Flex>
            {!collapsed && (
              <Text
                size="sm"
                fw={600}
                c="#1a202c"
                lineClamp={1}
              >
                {user.name}
              </Text>
            )}
          </Flex>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item onClick={handleSignOut}>
            <Center style={{ fontSize: '14px', fontWeight: 500 }}>
              退出登录
            </Center>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
};

export default MenuUserInfo;
