import React, { useMemo } from "react";
import { Center, Loader } from "@mantine/core";
import styles from './style.module.scss';

interface Props {
    loading: boolean;
    children: React.ReactNode;
    h?: number | string;
    type?: string;
    className?: string;
    style?:React.CSSProperties;
}

const Loading: React.FC<Props> = ({ loading, children, h = 200, type = 'normal', className = '',style }) => {
    const load = useMemo(() => {
        switch (type) {
            case 'spin':
                return <div className={styles.spin}></div>;
            case 'point':
                return <div className={styles.point}></div>;
            default:
                return <Loader />;
        }
    }, [type]);

    return (
        <>
            {loading ? (
                <Center h={h} className={className} style={style}>
                    {load}
                </Center>
            ) : (
                children
            )}
        </>
    );
};

export default Loading;
