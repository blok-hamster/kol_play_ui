import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiResponse } from '@/types';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api', // Change this URL to match your backend
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadTokenFromStorage();
  }

  private setupInterceptors(): void {
    // Request interceptor to add JWT token
    this.client.interceptors.request.use(
      config => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
          console.log(
            '🚀 API Request - Adding Authorization header:',
            `Bearer ${this.token.substring(0, 50)}...`
          );
        } else {
          console.log(
            '🚀 API Request - No token available, no Authorization header added'
          );
        }
        console.log('🚀 API Request - URL:', config.url);
        console.log('🚀 API Request - Method:', config.method?.toUpperCase());
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken();
          // Redirect to login or show auth modal
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private loadTokenFromStorage(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
      console.log(
        '🔑 API Client - Loading token from storage:',
        this.token ? this.token.substring(0, 50) + '...' : 'No token found'
      );
    }
  }

  public setToken(token: string): void {
    console.log(
      '🔑 API Client - Setting new token:',
      token.substring(0, 50) + '...'
    );
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      console.log('🔑 API Client - Token stored in localStorage');
    }
  }

  public clearToken(): void {
    console.log('🔑 API Client - Clearing token');
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  public getToken(): string | null {
    console.log(
      '🔑 API Client - Getting token:',
      this.token ? this.token.substring(0, 50) + '...' : 'No token'
    );
    return this.token;
  }

  // Generic API methods
  public async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  public async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  // Raw methods for endpoints that don't follow ApiResponse format
  public async postRaw<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  public async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data);
    return response.data;
  }

  public async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url);
    return response.data;
  }

  // Utility method to handle API errors
  public handleError(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

// Create a singleton instance
const apiClient = new ApiClient();

export default apiClient;
