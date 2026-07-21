import { get, post } from "@/utils/rest";

export const UserApi = {
    register: '/api/register',  //注册
    refresh: "/api/refresh",    //刷新token
    logout: '/api/logout',      //退出
    login: '/api/login',        //登录
    user: '/api/user/profile'   //获取用户信息
}

export const registerUser = async (data: any) => {
    return post(UserApi.register, data);
}

export const loginUser = async (data: any) => {
    return post(UserApi.login, data);
}

export const getUser = async (id: string) => await get(UserApi.user, { userId: id });

export const logoutUser = async () => {
    return post(UserApi.logout, {});
};

