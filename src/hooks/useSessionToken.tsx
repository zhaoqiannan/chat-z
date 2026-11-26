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
    const forceBackToLogin = async () => {
      try {
        await logoutUser();
      } catch {}
      clearSession();
      router.replace("/login/");
    };

    const fetchProfile = async (userId: string, userName: string) => {
      try {
        const res = await getUser(userId);
        if (res.success && res.result) {
          dispatch(
            setUser({
              id: userId,
              name: res.result.userName || userName || "User",
              ...res.result,
            })
          );
        } else {
          throw new Error(res.message || "Failed to fetch profile");
        }
      } catch (err) {
        console.error("Failed to restore profile:", err);
        await forceBackToLogin();
      }
    };

    const userInfoStr = localStorage.getItem("user_info");
    if (userInfoStr) {
      try {
        const session = JSON.parse(userInfoStr);
        if (session && session.user && session.user.id) {
          fetchProfile(session.user.id, session.user.name);
          return;
        }
      } catch (e) {
        console.error("Error parsing user_info", e);
      }
    }

    forceBackToLogin();
  }, [dispatch, router]);
};

export default useSessionToken;
