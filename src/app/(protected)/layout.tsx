"use client";
import React, { Suspense } from "react";
import MenuLayout from "@/components/layout/menu";
import { Provider } from "react-redux";
import { store } from "@/store";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Suspense fallback={null}>
        <MenuLayout>
          {children}
        </MenuLayout>
      </Suspense>
    </Provider>
  );
}