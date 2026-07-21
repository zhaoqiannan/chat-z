"use client";

import { Button, Stack, Text, Title, Group } from "@mantine/core";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function NotFoundPage() {

    return (
        <Stack align="center" justify="center" h="100vh" gap="lg">
            <Image src={'/images/404.svg'} alt="404" width={450} height={315} style={{ width: '4.5rem', height: '3.15rem' }} />
            <Text c="#000" size="lg">
                {'哎呀！打不开网页了呢'}
            </Text>
        </Stack>
    );
}
