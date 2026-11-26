"use client";

import dynamic from "next/dynamic";
import LoadingMask from "@/components/common/loading-mask";

const WorkspacePage = dynamic(() => import("@/components/pages/workspace"), {
  ssr: false,
  loading: () => <LoadingMask visible />,
});

export default function Page() {
  return <WorkspacePage />;
}
