import Lazy from "@/components/layout/lazy";

const ProjectDetailPage = () => (
  <Lazy
    imports={[{ component: () => import("@/components/pages/project/overview") }]}
  />
);

export default ProjectDetailPage;
