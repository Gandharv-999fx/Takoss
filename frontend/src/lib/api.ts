import axios, { type AxiosInstance, AxiosError } from 'axios';

/**
 * API Client - Axios instance with authentication and error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  token: string;
}

export interface ProjectRequest {
  projectName: string;
  description: string;
  requirements: string;
  selectedModel?: 'claude' | 'gemini';
  techStack?: {
    frontend?: string;
    backend?: string;
    database?: string;
  };
}

export interface GenerationResult {
  projectId: string;
  success: boolean;
  phases: {
    requirements?: any;
    analysis?: any;
    database?: any;
    frontend?: any;
    backend?: any;
    deployment?: any;
    visualization?: any;
  };
  error?: string;
}

export interface ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: Date;
}

export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  description: string;
  requirements: string;
  generatedAt: string;
  files: string[];
}

class APIClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 300000, // 5 minute timeout for generation
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.token = localStorage.getItem('takoss_token');
    if (this.token) {
      this.setAuthToken(this.token);
    }

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication token
   */
  public setAuthToken(token: string): void {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('takoss_token', token);
  }

  /**
   * Clear authentication
   */
  public clearAuth(): void {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
    localStorage.removeItem('takoss_token');
  }

  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.token;
  }

  // ==================== AUTH ENDPOINTS ====================

  /**
   * Register new user
   */
  public async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/register', {
      email,
      password,
      name,
    });
    this.setAuthToken(response.data.token);
    return response.data;
  }

  /**
   * Login user
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    this.setAuthToken(response.data.token);
    return response.data;
  }

  /**
   * Get current user
   */
  public async getCurrentUser(): Promise<any> {
    const response = await this.client.get('/api/auth/me');
    return response.data.user;
  }

  /**
   * Logout
   */
  public logout(): void {
    this.clearAuth();
  }

  // ==================== API KEY ENDPOINTS ====================

  /**
   * Create API key
   */
  public async createApiKey(name: string, expiresInDays?: number): Promise<ApiKeyResponse> {
    const response = await this.client.post<ApiKeyResponse>('/api/auth/api-keys', {
      name,
      expiresInDays,
    });
    return response.data;
  }

  /**
   * List API keys
   */
  public async listApiKeys(): Promise<ApiKeyResponse[]> {
    const response = await this.client.get<ApiKeyResponse[]>('/api/auth/api-keys');
    return response.data;
  }

  /**
   * Delete API key
   */
  public async deleteApiKey(keyId: string): Promise<void> {
    await this.client.delete(`/api/auth/api-keys/${keyId}`);
  }

  // ==================== PROJECT ENDPOINTS ====================

  /**
   * Generate application
   */
  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    const response = await this.client.post<GenerationResult>('/api/generate', request);
    return response.data;
  }

  /**
   * List all projects
   */
  public async listProjects(): Promise<ProjectMetadata[]> {
    const response = await this.client.get<ProjectMetadata[]>('/api/projects');
    return response.data;
  }

  /**
   * Get project details
   */
  public async getProject(projectId: string): Promise<ProjectMetadata> {
    const response = await this.client.get<ProjectMetadata>(`/api/projects/${projectId}`);
    return response.data;
  }

  /**
   * Get project download URL
   */
  public getProjectDownloadUrl(projectId: string): string {
    return `${API_BASE_URL}/api/projects/${projectId}/download`;
  }

  /**
   * Get project file content
   */
  public async getProjectFile(projectId: string, filePath: string): Promise<string> {
    const response = await this.client.get<string>(
      `/api/projects/${projectId}/files/${filePath}`,
      { responseType: 'text' as any }
    );
    return response.data;
  }

  /**
   * Delete project
   */
  public async deleteProject(projectId: string): Promise<void> {
    await this.client.delete(`/api/projects/${projectId}`);
  }

  /**
   * Get example projects
   */
  public async getExamples(): Promise<any[]> {
    const response = await this.client.get('/api/examples');
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
