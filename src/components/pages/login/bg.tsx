"use client";

import styles from './style.module.scss';

export default function BG() {

    return (
        <svg className={styles.svgBackground} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" fill="none">
            <line x1="960" y1="0" x2="960" y2="1080" stroke="rgba(0, 201, 255, 0.2)" strokeWidth="1" />
            <line x1="0" y1="540" x2="1920" y2="540" stroke="rgba(0, 201, 255, 0.2)" strokeWidth="1" />

            <circle cx="960" cy="540" r="180" stroke="rgba(0, 201, 255, 0.25)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="960" cy="540" r="320" stroke="rgba(0, 201, 255, 0.2)" strokeWidth="1" />
            <circle cx="960" cy="540" r="480" stroke="rgba(0, 201, 255, 0.15)" strokeWidth="1.5" strokeDasharray="20 40" />
            <circle cx="960" cy="540" r="640" stroke="rgba(0, 201, 255, 0.1)" strokeWidth="1" />
            <circle cx="960" cy="540" r="800" stroke="rgba(0, 201, 255, 0.05)" strokeWidth="1" strokeDasharray="5 15" />

            <line x1="0" y1="0" x2="1920" y2="1080" stroke="rgba(0, 201, 255, 0.08)" strokeWidth="0.5" />
            <line x1="1920" y1="0" x2="0" y2="1080" stroke="rgba(0, 201, 255, 0.08)" strokeWidth="0.5" />

            <g stroke="rgba(0, 201, 255, 0.4)" strokeWidth="1.5">
                <path d="M960 360h-5v5m10-5h-5v-5" fill="none" />
                <path d="M960 720h-5v5m10-5h-5v-5" fill="none" />
                <path d="M640 540h-5v5m10-5h-5v-5" fill="none" />
                <path d="M1280 540h-5v5m10-5h-5v-5" fill="none" />
            </g>

            <g fill="rgba(0, 201, 255, 0.4)" fontSize="10" fontFamily="monospace" letterSpacing="1">
                <text x="975" y="40">35° 00' 00" N</text>
                <text x="975" y="1050">34° 59' 00" N</text>
                <text x="20" y="530">119° 58' 00" E</text>
                <text x="1800" y="530">120° 02' 00" E</text>
                <text x="975" y="530">CENTER POINT (GCJ-02)</text>
            </g>
        </svg>

    );
}