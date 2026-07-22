import Axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance, CancelTokenSource } from 'axios';
import { UserApi } from '@/rest/user';
import { store } from '@/store';
import { setUser } from '@/store/userInfo';

const DEFAULT_TIMEOUT = 30000;

type RequestConfig = AxiosRequestConfig;

console.log(process.env.NEXT_PUBLIC_API_BASE_URL, 'process.env.NEXT_PUBLIC_API_BASE_URL')

interface UnifiedResponse<T = any> {
    success: boolean;
    message: string;
    result?: T;
}

let accessToken = '';

const getToken = () => {
    return accessToken;
};

const updateSession = (data: any) => {
    const token = data.accessToken || '';
    if (token) {
        accessToken = token;

        if (typeof window !== 'undefined') {
            document.cookie = `auth_token=true; path=/; SameSite=Lax`;
            let name = data.userName || 'user';
            let id = data.userId || '';

            const session = {
                user: {
                    id,
                    name: name
                }
            };
            localStorage.setItem('user_info', JSON.stringify(session));

            store.dispatch(setUser({
                id,
                name: name
            }));
        }
    }
};

const handleLogout = () => {
    accessToken = '';
    if (typeof window !== 'undefined') {
        localStorage.removeItem('user_info');
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = '/login';
    }
};

const refreshSession = async (): Promise<string> => {
    const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await Axios.post(
        `${baseApi}${UserApi.refresh}`,
        {},
        {
            withCredentials: true
        }
    );
    updateSession(response.data);
    console.log('refresh-接口获取结果-->', response.data);

    const token = response.data.accessToken || '';
    return token;
};

const formatResponse = (response: AxiosResponse): UnifiedResponse => {
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data) {
        return {
            success: !!data.success,
            message: data.message || '',
            result: data.result !== undefined ? data.result : data
        };
    }
    return {
        success: response.status === 200 || response.status === 201,
        message: data?.message || '',
        result: data
    };
};

const formatError = (error: any): UnifiedResponse => {
    const response = error.response;
    const data = response?.data;
    const message = data?.message || '请求失败';
    return {
        success: false,
        message,
        result: data?.result !== undefined ? data.result : data
    };
};

const matchRoute = (url: string | undefined, route: string) => {
    if (!url) return false;
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const normalizedRoute = route.endsWith('/') ? route.slice(0, -1) : route;
    return normalizedUrl.endsWith(normalizedRoute);
};

const rest: AxiosInstance = Axios.create({
    timeout: DEFAULT_TIMEOUT,
    headers: {},
    withCredentials: true
});

rest.interceptors.request.use((config) => {
    const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (config.url?.startsWith('/api')) {
        config.baseURL = baseApi;
    }

    const isAuthRoute = matchRoute(config.url, UserApi.register) || matchRoute(config.url, UserApi.login) || matchRoute(config.url, UserApi.refresh);
    if (!isAuthRoute) {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

rest.interceptors.response.use(
    (response: AxiosResponse) => {
        const config = response.config;
        const isLoginOrRefresh = matchRoute(config.url, UserApi.login) || matchRoute(config.url, UserApi.refresh);
        if (isLoginOrRefresh) {
            updateSession(response.data);
        }

        const formatted = formatResponse(response);
        if (!formatted.success) {
            return Promise.reject(formatted);
        }
        return formatted as any;
    },
    async (error) => {
        const { response, config } = error;

        if (response) {
            const originalRequest = config;

            if (response.status === 401 && !originalRequest._retry) {
                if (matchRoute(originalRequest.url, UserApi.refresh)) {
                    handleLogout();
                    return Promise.reject(formatError(error));
                }

                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            return rest(originalRequest);
                        })
                        .catch((err) => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const newAccessToken = await refreshSession();
                    if (newAccessToken) {
                        processQueue(null, newAccessToken);
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        return rest(originalRequest);
                    } else {
                        handleLogout();
                        return Promise.reject(formatError(error));
                    }
                } catch (refreshErr: any) {
                    processQueue(refreshErr, null);
                    handleLogout();
                    return Promise.reject(formatError(refreshErr));
                } finally {
                    isRefreshing = false;
                }
            }

            if (response.status === 403) {
                handleLogout();
                return Promise.reject(formatError(error));
            }

            return Promise.reject(formatError(error));
        }

        return Promise.reject(formatError(error));
    }
);

const request = async (config: RequestConfig): Promise<UnifiedResponse> => {
    const source: CancelTokenSource = Axios.CancelToken.source();
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    try {
        const response: any = await rest({
            ...config,
            cancelToken: source.token,
            timeout: timeout,
        });
        return response;
    } catch (error) {
        return Promise.reject(error);
    }
};

const get = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> => {
    return request({
        ...config,
        url,
        method: 'get',
        params,
    });
};

const post = (url: string, params?: any, config: RequestConfig = {}): Promise<UnifiedResponse> => {
    return request({
        ...config,
        url,
        method: 'post',
        data: params,
        headers: {
            "Content-Type": "application/json",
            ...config.headers,
        },
    });
};

const put = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> => {
    return request({
        ...config,
        url,
        method: 'put',
        data: params || {},
    });
};

const del = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> => {
    return request({
        ...config,
        url,
        method: 'delete',
        data: params || {},
    });
};

export {
    get,
    post,
    put,
    del,
    request,
    refreshSession,
    getToken,
};
