import Lazy from "@/components/layout/lazy";

const WorkspacePage = () => (
  <Lazy imports={[{ component: () => import("@/components/pages/workspace") }]} />
);

export default WorkspacePage;
