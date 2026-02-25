import axios from 'axios';

// Usar import.meta.env para Vite variables. 
// Para dev, el proxy redirige /api al backend.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Si es 401 y no es la ruta de login o refresh
        if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                // Redirigir al login si no hay refresh token
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return Promise.reject(error);
            }

            try {
                const { data } = await axios.post((import.meta.env.VITE_API_URL || '/api') + '/auth/refresh', { refreshToken });

                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                api.defaults.headers.common['Authorization'] = 'Bearer ' + data.accessToken;
                originalRequest.headers['Authorization'] = 'Bearer ' + data.accessToken;

                processQueue(null, data.accessToken);
                isRefreshing = false;

                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                isRefreshing = false;
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
