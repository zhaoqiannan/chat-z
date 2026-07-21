import Lazy from "@/components/layout/lazy";

const HomePage = () => <Lazy imports={[{ component: () => import("@/components/pages/home") }]} />;

export default HomePage;