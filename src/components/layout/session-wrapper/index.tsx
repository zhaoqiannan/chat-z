import React from "react";

export default function SessionWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
