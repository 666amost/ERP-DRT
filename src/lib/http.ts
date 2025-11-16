import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
let _pendingRequests = 0;

const startProgress = () => {
  if (_pendingRequests === 0) NProgress.start();
  _pendingRequests++;
};

const doneProgress = () => {
  _pendingRequests = Math.max(0, _pendingRequests - 1);
  if (_pendingRequests === 0) NProgress.done();
};

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  startProgress();
  return config;
});

http.interceptors.response.use(
  (res: AxiosResponse<unknown>) => {
    doneProgress();
    return res;
  },
  (err: AxiosError<unknown>) => {
    doneProgress();
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default http;
