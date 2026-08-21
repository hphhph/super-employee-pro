import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
});

// 请求拦截器 - 附加 Token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器 - 统一处理
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    // 二进制响应（视频/文件下载等）直接透传，不做业务码校验
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
      return res;
    }
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败');
      return Promise.reject(new Error(res.message));
    }
    return res.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || '服务器错误';

      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        window.location.hash = '#/login';
        ElMessage.error('登录已过期，请重新登录');
      } else {
        ElMessage.error(message);
      }
    } else {
      ElMessage.error('网络连接失败，请检查网络');
    }
    return Promise.reject(error);
  },
);

/**
 * 类型化封装：响应拦截器已在运行时把 axios 响应解包为业务数据（res.data），
 * 这里将 Promise<AxiosResponse> 收窄为 Promise<T>，与运行时行为一致，
 * 避免调用方到处写 `as any[]` 之类的强转。
 */
export interface HttpClient {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

const request = instance as unknown as HttpClient;

export default request;
