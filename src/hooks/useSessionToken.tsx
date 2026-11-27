import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/userInfo";
import { getUser, logoutUser } from "@/rest/user";
import { clearSession } from "@/utils/rest";

const useSessionToken = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const hydrateProfile = async () => {
      try {
        const res = await getUser();
        if (cancelled) return;
        if (res.success && res.result) {
          dispatch(
            setUser({
              id: res.result.id || "",
              name: res.result.name || res.result.username || "作家",
              ...res.result,
            })
          );
          return;
        }
        throw new Error(res.message || "Failed to fetch profile");
      } catch {
        if (cancelled) return;
        try {
          await logoutUser();
        } catch {}
        clearSession();
        router.replace("/login/");
      }
    };

    hydrateProfile();
    return () => {
      cancelled = true;
    };
  }, [dispatch, router]);
};

export default useSessionToken;
