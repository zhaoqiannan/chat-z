import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store";
import { setUser, clearUser } from "@/store/userInfo";
import { getUser } from "@/rest/user";

const useSessionToken = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async (userId: string, userName: string) => {
            try {
                const res = await getUser(userId);
                console.log('getUser-->', res);

                if (res.success && res.result) {
                    dispatch(setUser({
                        id: userId,
                        name: res.result.userName || userName || 'User',
                        ...res.result
                    }));
                } else {
                    throw new Error(res.message || "Failed to fetch profile");
                }
            } catch (err) {
                console.error("Failed to restore profile:", err);
                localStorage.removeItem("user_info");
                dispatch(clearUser());
                document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                router.replace('/login');
            }
        };

        const userInfoStr = localStorage.getItem('user_info');
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

        localStorage.removeItem("user_info");
        dispatch(clearUser());
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.replace('/login');
    }, [dispatch, router]);
};

export default useSessionToken;
