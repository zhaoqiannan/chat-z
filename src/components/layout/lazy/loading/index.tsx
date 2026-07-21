import React from "react";
import styles from "./style.module.scss";
const Loading = () => {
    return (
        <div className={styles.loading}>
            <span className={styles.span}></span>
        </div>
    );
};

export default Loading;
