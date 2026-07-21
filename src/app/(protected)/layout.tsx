"use client";
import MenuLayout from '@/components/layout/menu';
import { Provider } from "react-redux";
import { store } from "@/store";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <MenuLayout>
        {children}
      </MenuLayout>
    </Provider>
  );
}