"use client";

import dynamic from "next/dynamic";
import LoadingMask from "@/components/common/loading-mask";

const HomePage = dynamic(() => import("@/components/pages/home"), {
  ssr: false,
  loading: () => <LoadingMask visible />,
});

export default function Page() {
  return <HomePage />;
}
