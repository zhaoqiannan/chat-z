import Lazy from "@/components/layout/lazy";

const TestCasePage = () => <Lazy imports={[{ component: () => import("@/components/pages/test_case") }]} />;

export default TestCasePage;