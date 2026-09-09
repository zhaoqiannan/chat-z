import { notifications, NotificationsProps } from "@mantine/notifications";
import {
    AiOutlineInfoCircle,
    AiOutlineCheckCircle,
    AiOutlineExclamationCircle,
    AiOutlineCloseCircle,
} from "react-icons/ai";

// 图标映射
const icon: any = {
    info: <AiOutlineInfoCircle color="#00c9ff" />,
    success: <AiOutlineCheckCircle color="#00b42a" />,
    warning: <AiOutlineExclamationCircle color="#ff7d00" />,
    error: <AiOutlineCloseCircle color="#f53f3f" />,
};

interface Params extends NotificationsProps {
    message?: string;
}

// 默认配置
const defaultSetting = {
    message: "error",
    color: "transparent",
    withBorder: true,
    autoClose: 2000,
    withCloseButton: false,
    style: {
        maxHeight: '500px',
    }
};
const showNotification = (params: Params, type: string) => {
    const { message = "No message provided" } = params;

    notifications.show({
        ...defaultSetting,
        position: "top-center",
        icon: icon[type],
        message,
    });
};

const info = (message: string | undefined, params?: Params) => showNotification({ message, ...params }, "info");
const success = (message: string | undefined, params?: Params) => showNotification({ message, ...params }, "success");
const error = (message: string | undefined, params?: Params) => showNotification({ message, ...params }, "error");
const warning = (message: string | undefined, params?: Params) => showNotification({ message, ...params }, "warning");

export const useAlert = {
    info,
    success,
    error,
    warning,
};
