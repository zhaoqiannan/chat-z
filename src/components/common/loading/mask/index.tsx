import React from 'react';
import { Box, Loader } from '@mantine/core';

interface LoadingMaskProps {
    loading?: boolean;
    children: React.ReactNode;
    w?: string;
}

const LoadingMask: React.FC<LoadingMaskProps> = ({ loading = false, children, w = '100%' }) => {
    return (
        <Box style={{ position: 'relative', width: w }} p={0}>
            {children}

            {loading && (
                <Box
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                    }}
                >
                    <Loader />
                </Box>
            )}
        </Box>
    );
};

export default LoadingMask;
