import React, { Suspense, ReactNode, ComponentType } from "react";
import Loading from "./loading";

interface importsType {
    component: () => Promise<{ default: ComponentType<any> }>;
    params?: any;
}
interface LazyLayoutProps {
    imports: Array<importsType>;
    fallback?: ReactNode;
}

const delayImport = <T,>(promise: Promise<T>, delayMs = 2000): Promise<T> => {
  return new Promise(resolve => {
    setTimeout(() => {
      promise.then(resolve);
    }, delayMs);
  });
};

const LazyLayout: React.FC<LazyLayoutProps> = ({ imports, fallback = <Loading /> }) => {
    return (
        <div className="layout-container">
            {imports.map(({ component, params = {} }, index) => {
                // const Component = React.lazy(component);
                const Component = React.lazy(() => delayImport(component(), 800));//模拟延迟
                return (
                    <Suspense fallback={fallback} key={index}>
                        <Component {...params} />
                    </Suspense>
                );
            })}
        </div>
    );
};

export default LazyLayout;
