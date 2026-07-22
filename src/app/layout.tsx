import React from "react";
import type { Metadata } from "next";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from "@mantine/notifications";
import SessionWrapper from "@/components/layout/session-wrapper";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import '@mantine/carousel/styles.css';
import "@/static/global.scss";
import "@/static/mantine.scss";

import theme from "@/static/theme";

export const metadata: Metadata = {
    title: "chat-z",
    description: "chat-z: 您的智能 AI 助手",
};

interface RootLayoutProps {
    children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
    return (
        <html data-mantine-color-scheme="light" suppressHydrationWarning>
            <head>
                <ColorSchemeScript defaultColorScheme="light" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                function setRem() {
                                    var scale = window.innerWidth / 1440;
                                    document.documentElement.style.fontSize = (100 * scale) + 'px';
                                }
                                setRem();
                                window.addEventListener('resize', setRem);
                            })();
                        `
                    }}
                />
            </head>
            <body>
                <SessionWrapper>
                    <MantineProvider theme={theme} defaultColorScheme="light">
                        <ModalsProvider>
                            <Notifications />
                            {children}
                        </ModalsProvider>
                    </MantineProvider>
                </SessionWrapper>
            </body>
        </html>
    );
}
