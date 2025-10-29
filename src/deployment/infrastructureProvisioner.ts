import { ChatAnthropic } from '@langchain/anthropic';
import axios, { AxiosInstance } from 'axios';
import { DeploymentConfig } from './deploymentTaskDecomposer';

/**
 * Infrastructure as Prompts - Programmatic infrastructure provisioning
 * Integrates with Railway, Vercel, and other platforms to automatically deploy applications
 */

export interface ProvisionResult {
  success: boolean;
  projectId?: string;
  deploymentUrl?: string;
  databaseUrl?: string;
  error?: string;
  details?: Record<string, any>;
}

export interface RailwayProject {
  id: string;
  name: string;
  createdAt: string;
}

export interface RailwayService {
  id: string;
  name: string;
  projectId: string;
  serviceType: 'app' | 'database' | 'redis';
}

export interface VercelDeployment {
  id: string;
  url: string;
  name: string;
  state: 'BUILDING' | 'READY' | 'ERROR';
}

export class InfrastructureProvisioner {
  private model: ChatAnthropic;
  private railwayClient?: AxiosInstance;
  private vercelClient?: AxiosInstance;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });

    // Initialize Railway client
    if (process.env.RAILWAY_API_TOKEN) {
      this.railwayClient = axios.create({
        baseURL: 'https://backboard.railway.app/graphql/v2',
        headers: {
          'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
    }

    // Initialize Vercel client
    if (process.env.VERCEL_TOKEN) {
      this.vercelClient = axios.create({
        baseURL: 'https://api.vercel.com',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Provision complete infrastructure based on config
   */
  public async provisionInfrastructure(
    config: DeploymentConfig
  ): Promise<ProvisionResult> {
    try {
      switch (config.platform) {
        case 'railway':
          return await this.provisionRailway(config);
        case 'vercel':
          return await this.provisionVercel(config);
        default:
          return {
            success: false,
            error: `Platform ${config.platform} not supported for automatic provisioning`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during provisioning',
      };
    }
  }

  /**
   * Provision infrastructure on Railway
   */
  private async provisionRailway(
    config: DeploymentConfig
  ): Promise<ProvisionResult> {
    if (!this.railwayClient) {
      return {
        success: false,
        error: 'Railway API token not configured. Set RAILWAY_API_TOKEN environment variable.',
      };
    }

    try {
      // 1. Create project
      const project = await this.createRailwayProject(config.appName);

      // 2. Add database if needed
      let databaseUrl: string | undefined;
      if (config.hasDatabase) {
        databaseUrl = await this.addRailwayDatabase(
          project.id,
          config.databaseType || 'postgresql'
        );
      }

      // 3. Add Redis if needed
      if (config.hasRedis) {
        await this.addRailwayRedis(project.id);
      }

      // 4. Deploy application
      const deploymentUrl = await this.deployToRailway(project.id, config);

      return {
        success: true,
        projectId: project.id,
        deploymentUrl,
        databaseUrl,
        details: {
          projectName: project.name,
          platform: 'railway',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Railway provisioning failed: ${error.message}`,
      };
    }
  }

  /**
   * Create Railway project using GraphQL API
   */
  private async createRailwayProject(name: string): Promise<RailwayProject> {
    const mutation = `
      mutation CreateProject($name: String!) {
        projectCreate(input: { name: $name }) {
          id
          name
          createdAt
        }
      }
    `;

    const response = await this.railwayClient!.post('', {
      query: mutation,
      variables: { name },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data.projectCreate;
  }

  /**
   * Add PostgreSQL database to Railway project
   */
  private async addRailwayDatabase(
    projectId: string,
    dbType: string
  ): Promise<string> {
    const mutation = `
      mutation DeployPlugin($projectId: String!, $plugin: String!) {
        pluginCreate(input: { projectId: $projectId, plugin: $plugin }) {
          id
          name
        }
      }
    `;

    const pluginMap: Record<string, string> = {
      postgresql: 'postgresql',
      mysql: 'mysql',
      mongodb: 'mongodb',
    };

    const response = await this.railwayClient!.post('', {
      query: mutation,
      variables: {
        projectId,
        plugin: pluginMap[dbType] || 'postgresql',
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    // Get database connection string from environment variables
    const query = `
      query GetServiceVariables($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                variables {
                  edges {
                    node {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const varResponse = await this.railwayClient!.post('', {
      query,
      variables: { projectId },
    });

    const services = varResponse.data.data.project.services.edges;
    for (const serviceEdge of services) {
      const variables = serviceEdge.node.variables.edges;
      for (const varEdge of variables) {
        if (varEdge.node.name === 'DATABASE_URL') {
          return varEdge.node.value;
        }
      }
    }

    return 'DATABASE_URL will be available in Railway dashboard';
  }

  /**
   * Add Redis to Railway project
   */
  private async addRailwayRedis(projectId: string): Promise<void> {
    const mutation = `
      mutation DeployRedis($projectId: String!) {
        pluginCreate(input: { projectId: $projectId, plugin: "redis" }) {
          id
          name
        }
      }
    `;

    const response = await this.railwayClient!.post('', {
      query: mutation,
      variables: { projectId },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }
  }

  /**
   * Deploy application to Railway
   */
  private async deployToRailway(
    projectId: string,
    config: DeploymentConfig
  ): Promise<string> {
    // Railway deploys automatically from connected Git repository
    // This method would configure deployment settings

    const mutation = `
      mutation ConfigureDeployment($projectId: String!, $settings: JSON!) {
        deploymentSettings(projectId: $projectId, settings: $settings) {
          success
        }
      }
    `;

    // Configure build and start commands
    const settings = {
      buildCommand: config.buildCommand || 'npm run build',
      startCommand: config.startCommand || 'npm start',
      envVars: config.envVars || {},
    };

    // Note: Actual Railway API may differ, this is a simplified example
    return `https://${config.appName}.up.railway.app`;
  }

  /**
   * Provision infrastructure on Vercel
   */
  private async provisionVercel(
    config: DeploymentConfig
  ): Promise<ProvisionResult> {
    if (!this.vercelClient) {
      return {
        success: false,
        error: 'Vercel token not configured. Set VERCEL_TOKEN environment variable.',
      };
    }

    try {
      // 1. Create project
      const project = await this.createVercelProject(config.appName);

      // 2. Set environment variables
      if (config.envVars) {
        await this.setVercelEnvVars(project.id, config.envVars);
      }

      // 3. Deploy
      const deployment = await this.deployToVercel(project.id, config);

      return {
        success: true,
        projectId: project.id,
        deploymentUrl: deployment.url,
        details: {
          projectName: project.name,
          deploymentState: deployment.state,
          platform: 'vercel',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Vercel provisioning failed: ${error.message}`,
      };
    }
  }

  /**
   * Create Vercel project
   */
  private async createVercelProject(name: string): Promise<{ id: string; name: string }> {
    const response = await this.vercelClient!.post('/v9/projects', {
      name,
      framework: 'vite',
    });

    return {
      id: response.data.id,
      name: response.data.name,
    };
  }

  /**
   * Set Vercel environment variables
   */
  private async setVercelEnvVars(
    projectId: string,
    envVars: Record<string, string>
  ): Promise<void> {
    for (const [key, value] of Object.entries(envVars)) {
      await this.vercelClient!.post(`/v10/projects/${projectId}/env`, {
        key,
        value,
        type: 'encrypted',
        target: ['production', 'preview', 'development'],
      });
    }
  }

  /**
   * Deploy to Vercel
   */
  private async deployToVercel(
    projectId: string,
    config: DeploymentConfig
  ): Promise<VercelDeployment> {
    // Create deployment from current directory
    // Note: This is simplified - actual implementation would use Vercel CLI or upload files
    const response = await this.vercelClient!.post('/v13/deployments', {
      name: config.appName,
      project: projectId,
      target: 'production',
      gitSource: {
        type: 'github',
        // Would need actual repo details
      },
    });

    return {
      id: response.data.id,
      url: response.data.url,
      name: response.data.name,
      state: response.data.readyState,
    };
  }

  /**
   * Check deployment status
   */
  public async checkDeploymentStatus(
    platform: string,
    deploymentId: string
  ): Promise<{
    status: 'pending' | 'building' | 'ready' | 'error';
    url?: string;
    error?: string;
  }> {
    try {
      if (platform === 'vercel' && this.vercelClient) {
        const response = await this.vercelClient.get(`/v13/deployments/${deploymentId}`);
        return {
          status: response.data.readyState.toLowerCase(),
          url: response.data.url,
        };
      }

      if (platform === 'railway' && this.railwayClient) {
        const query = `
          query GetDeployment($id: String!) {
            deployment(id: $id) {
              status
              url
            }
          }
        `;

        const response = await this.railwayClient.post('', {
          query,
          variables: { id: deploymentId },
        });

        return {
          status: response.data.data.deployment.status.toLowerCase(),
          url: response.data.data.deployment.url,
        };
      }

      return {
        status: 'error',
        error: 'Platform not supported or not configured',
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Generate infrastructure provisioning script
   */
  public async generateProvisioningScript(
    config: DeploymentConfig
  ): Promise<string> {
    const lines: string[] = [];

    lines.push('#!/bin/bash');
    lines.push('# Infrastructure Provisioning Script');
    lines.push(`# Platform: ${config.platform}`);
    lines.push('');
    lines.push('set -e  # Exit on error');
    lines.push('');

    switch (config.platform) {
      case 'railway':
        lines.push('echo "Provisioning on Railway..."');
        lines.push('');
        lines.push('# Install Railway CLI if not installed');
        lines.push('if ! command -v railway &> /dev/null; then');
        lines.push('    npm install -g @railway/cli');
        lines.push('fi');
        lines.push('');
        lines.push('# Login to Railway');
        lines.push('railway login');
        lines.push('');
        lines.push('# Initialize project');
        lines.push(`railway init --name ${config.appName}`);
        lines.push('');
        if (config.hasDatabase) {
          lines.push('# Add PostgreSQL');
          lines.push('railway add postgresql');
          lines.push('');
        }
        if (config.hasRedis) {
          lines.push('# Add Redis');
          lines.push('railway add redis');
          lines.push('');
        }
        lines.push('# Deploy');
        lines.push('railway up');
        lines.push('');
        lines.push('echo "✓ Deployment complete!"');
        lines.push('railway status');
        break;

      case 'vercel':
        lines.push('echo "Provisioning on Vercel..."');
        lines.push('');
        lines.push('# Install Vercel CLI if not installed');
        lines.push('if ! command -v vercel &> /dev/null; then');
        lines.push('    npm install -g vercel');
        lines.push('fi');
        lines.push('');
        lines.push('# Login to Vercel');
        lines.push('vercel login');
        lines.push('');
        lines.push('# Deploy');
        lines.push('vercel --prod');
        lines.push('');
        lines.push('echo "✓ Deployment complete!"');
        break;

      case 'docker':
        lines.push('echo "Building and running with Docker..."');
        lines.push('');
        lines.push('# Build Docker image');
        lines.push(`docker build -t ${config.appName} .`);
        lines.push('');
        lines.push('# Run with docker-compose');
        lines.push('docker-compose up -d');
        lines.push('');
        lines.push('echo "✓ Application started!"');
        lines.push('docker-compose ps');
        break;
    }

    return lines.join('\n');
  }

  /**
   * Rollback deployment
   */
  public async rollbackDeployment(
    platform: string,
    projectId: string,
    previousDeploymentId?: string
  ): Promise<ProvisionResult> {
    try {
      if (platform === 'vercel' && this.vercelClient) {
        // Promote previous deployment
        if (previousDeploymentId) {
          await this.vercelClient.patch(
            `/v13/deployments/${previousDeploymentId}/promote`,
            {}
          );
        }

        return { success: true };
      }

      if (platform === 'railway' && this.railwayClient) {
        // Railway rollback via GraphQL
        const mutation = `
          mutation RollbackDeployment($deploymentId: String!) {
            deploymentRollback(id: $deploymentId) {
              success
            }
          }
        `;

        await this.railwayClient.post('', {
          query: mutation,
          variables: { deploymentId: previousDeploymentId },
        });

        return { success: true };
      }

      return {
        success: false,
        error: 'Platform not supported for rollback',
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Rollback failed: ${error.message}`,
      };
    }
  }

  /**
   * Clean up infrastructure resources
   */
  public async cleanupInfrastructure(
    platform: string,
    projectId: string
  ): Promise<ProvisionResult> {
    try {
      if (platform === 'vercel' && this.vercelClient) {
        await this.vercelClient.delete(`/v9/projects/${projectId}`);
        return { success: true };
      }

      if (platform === 'railway' && this.railwayClient) {
        const mutation = `
          mutation DeleteProject($projectId: String!) {
            projectDelete(id: $projectId) {
              success
            }
          }
        `;

        await this.railwayClient.post('', {
          query: mutation,
          variables: { projectId },
        });

        return { success: true };
      }

      return {
        success: false,
        error: 'Platform not supported for cleanup',
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Cleanup failed: ${error.message}`,
      };
    }
  }
}
