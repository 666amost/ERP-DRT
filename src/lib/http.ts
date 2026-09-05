import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { startRequest, finishRequest } from '../composables/useRequestActivity';

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  startRequest();
  return config;
});

http.interceptors.response.use(
  (res: AxiosResponse<unknown>) => {
    finishRequest();
    return res;
  },
  (err: AxiosError<unknown>) => {
    finishRequest();
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default http;
