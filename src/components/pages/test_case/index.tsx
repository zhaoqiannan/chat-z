"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mantine/core';
import { useAppSelector } from '@/store';

export default function TestCasePage() {
    const user = useAppSelector((state) => state.userInfo);

    return (<Box bg={'#fff'} p={30}>
        test_case
    </Box>);
}
