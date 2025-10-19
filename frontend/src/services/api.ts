import axios, { type AxiosInstance } from 'axios';

// Use environment variable or fallback to localhost
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Create a pre-configured Axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define types for API responses
interface ApiResponse {
  success: boolean;
  message: string;
}

// Login request
export const login = async (
  username: string,
  password: string
): Promise<ApiResponse> => {
  const response = await api.post<ApiResponse>('/login', { username, password });
  return response.data;
};

// Update credentials request
export const updateCredentials = async (
  currentUsername: string,
  newUsername: string,
  newPassword: string
): Promise<ApiResponse> => {
  const response = await api.post<ApiResponse>('/update-credentials', {
    currentUsername,
    newUsername,
    newPassword,
  });
  return response.data;
};

export default api;
