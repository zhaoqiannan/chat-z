import Axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance, CancelTokenSource } from "axios";
import { store } from "@/store";
import { setUser, clearUser } from "@/store/userInfo";

const DEFAULT_TIMEOUT = 300000;

type RequestConfig = AxiosRequestConfig;

interface UnifiedResponse<T = any> {
  success: boolean;
  message: string;
  result?: T;
}

const updateSession = (data: any) => {
  const userObj = data?.result || data;
  const id = userObj?.userId || "";
  const name = userObj?.userName || "";
  if (id && typeof window !== "undefined") {
    store.dispatch(setUser({ id, name: name || "作家" }));
  }
};

const clearSession = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    store.dispatch(clearUser());
  }
};

let isLoggingOut = false;
const handleLogout = async () => {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    await fetch("/api/logout/", { method: "POST", credentials: "include" });
  } catch {}
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/login/";
  }
};

const REFRESH_API_ROUTE = "/api/refresh";
const AUTH_LOGIN_ROUTE = "/api/login";

const ensureTrailingSlash = (url?: string) => {
  if (!url) return url;
  const [path, query] = url.split("?");
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return query !== undefined ? `${normalizedPath}?${query}` : normalizedPath;
};

const refreshSession = async (): Promise<boolean> => {
  const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const response = await Axios.post(
    `${baseApi}${ensureTrailingSlash(REFRESH_API_ROUTE)}`,
    {},
    { withCredentials: true }
  );
  updateSession(response.data);
  return Boolean(response.data?.success);
};

const formatResponse = (response: AxiosResponse): UnifiedResponse => {
  const data = response.data;
  if (data && typeof data === "object" && "success" in data) {
    return {
      success: !!data.success,
      message: data.message || "",
      result: data.result !== undefined ? data.result : data,
    };
  }
  return {
    success: response.status === 200 || response.status === 201,
    message: data?.message || "",
    result: data,
  };
};

const formatError = (error: any): UnifiedResponse => {
  const response = error?.response;
  const data = response?.data;
  const message = data?.message || "请求失败";
  return {
    success: false,
    message,
    result: data?.result !== undefined ? data.result : data,
  };
};

const matchRoute = (url: string | undefined, route: string) => {
  if (!url) return false;
  const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  const normalizedRoute = route.endsWith("/") ? route.slice(0, -1) : route;
  return normalizedUrl.endsWith(normalizedRoute);
};

const rest: AxiosInstance = Axios.create({
  timeout: DEFAULT_TIMEOUT,
  headers: {},
  withCredentials: true,
});

rest.interceptors.request.use((config) => {
  if (config.url?.startsWith("/api")) {
    config.url = ensureTrailingSlash(config.url);
  }

  const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (baseApi && config.url?.startsWith("/api")) {
    config.baseURL = baseApi;
  }

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (ok: boolean) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, ok = false) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(ok);
    }
  });
  failedQueue = [];
};

rest.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config;
    const isLoginOrRefresh = matchRoute(config.url, AUTH_LOGIN_ROUTE) || matchRoute(config.url, REFRESH_API_ROUTE);
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
        if (matchRoute(originalRequest.url, REFRESH_API_ROUTE) || matchRoute(originalRequest.url, AUTH_LOGIN_ROUTE)) {
          if (matchRoute(originalRequest.url, REFRESH_API_ROUTE)) {
            handleLogout();
          }
          return Promise.reject(formatError(error));
        }

        if (isRefreshing) {
          return new Promise<boolean>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((ok) => (ok ? rest(originalRequest) : Promise.reject(formatError(error))))
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshed = await refreshSession();
          if (refreshed) {
            processQueue(null, true);
            return rest(originalRequest);
          }
          processQueue(error, false);
          handleLogout();
          return Promise.reject(formatError(error));
        } catch (refreshErr: any) {
          processQueue(refreshErr, false);
          handleLogout();
          return Promise.reject(formatError(refreshErr));
        } finally {
          isRefreshing = false;
        }
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
      timeout,
    });
    return response;
  } catch (error) {
    return Promise.reject(error);
  }
};

const get = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> =>
  request({ ...config, url, method: "get", params });

const post = (url: string, params?: any, config: RequestConfig = {}): Promise<UnifiedResponse> =>
  request({
    ...config,
    url,
    method: "post",
    data: params,
    headers: { "Content-Type": "application/json", ...config.headers },
  });

const put = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> =>
  request({ ...config, url, method: "put", data: params || {} });

const patch = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> =>
  request({ ...config, url, method: "patch", data: params || {} });

const del = (url: string, params?: any, config?: RequestConfig): Promise<UnifiedResponse> =>
  request({ ...config, url, method: "delete", data: params || {} });

export type PostStream = (
  url: string,
  data: any,
  onChunk: (text: string) => void,
  signal?: AbortSignal
) => Promise<void>;

const postStream: PostStream = async (url, data, onChunk, signal) => {
  const makeRequest = async (): Promise<Response> => {
    const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const formattedUrl = ensureTrailingSlash(url) || url;
    const fullUrl = baseApi && formattedUrl.startsWith("/api") ? `${baseApi}${formattedUrl}` : formattedUrl;

    return fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
      signal,
    });
  };

  let response = await makeRequest();

  if (response.status === 401) {
    if (isRefreshing) {
      try {
        const ok = await new Promise<boolean>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        if (ok) {
          response = await makeRequest();
        } else {
          handleLogout();
          throw new Error("Unauthorized");
        }
      } catch (err) {
        handleLogout();
        throw err;
      }
    } else {
      isRefreshing = true;
      try {
        const refreshed = await refreshSession();
        if (refreshed) {
          processQueue(null, true);
          response = await makeRequest();
        } else {
          const unauthErr = new Error("Unauthorized");
          processQueue(unauthErr, false);
          handleLogout();
          throw unauthErr;
        }
      } catch (refreshErr: any) {
        processQueue(refreshErr, false);
        handleLogout();
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Request failed with status ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  if (!reader) throw new Error("Response body is not readable");

  let isSSE = false;
  let checkedSSE = false;
  let buffer = "";

  const emitSseLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const dataContent = trimmed.slice(5).trim();
    if (!dataContent || dataContent === "[DONE]") return;
    try {
      const parsed = JSON.parse(dataContent);
      const text = parsed.text || parsed.content || parsed.response || parsed.result || "";
      if (text) onChunk(text);
    } catch {
      onChunk(dataContent);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    if (!checkedSSE) {
      checkedSSE = true;
      if (chunk.includes("data:")) isSSE = true;
    }

    if (isSSE) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(emitSseLine);
    } else {
      onChunk(chunk);
    }
  }

  if (isSSE && buffer) {
    emitSseLine(buffer);
  }
};

export {
  get,
  post,
  put,
  patch,
  del,
  request,
  refreshSession,
  clearSession,
  ensureTrailingSlash,
  postStream,
};
