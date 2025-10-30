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
   * Generate application (non-streaming)
   */
  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    const response = await this.client.post<GenerationResult>('/api/generate', request);
    return response.data;
  }

  /**
   * Generate application with streaming updates (SSE)
   * @param request - Project generation request
   * @param onProgress - Callback for progress events
   * @returns Promise that resolves with the final result
   */
  public async generateApplicationStreaming(
    request: ProjectRequest,
    onProgress: (event: {
      type: 'phase_start' | 'phase_progress' | 'phase_complete' | 'error' | 'complete';
      phase: string;
      message: string;
      progress?: number;
      data?: any;
    }) => void
  ): Promise<GenerationResult> {
    return new Promise((resolve, reject) => {
      const url = `${API_BASE_URL}/api/generate/stream`;

      // Use fetch with SSE (EventSource doesn't support custom headers)
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Response body is not readable');
          }

          let buffer = '';
          let finalResult: GenerationResult | null = null;

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'result') {
                    finalResult = data.data;
                  } else if (data.type === 'error') {
                    reject(new Error(data.message));
                    return;
                  } else {
                    onProgress(data);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE message:', e);
                }
              }
            }
          }

          if (finalResult) {
            resolve(finalResult);
          } else {
            reject(new Error('No result received from server'));
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
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
