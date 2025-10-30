import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * AuthService - Handles user authentication, registration, and API key management
 */

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  token: string;
}

export interface ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: Date;
}

export class AuthService {
  private prisma: PrismaClient;
  private jwtSecret: string;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    this.prisma = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET || 'takoss-secret-change-in-production';

    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using default (not secure for production)');
    }
  }

  /**
   * Register a new user with email and password
   */
  public async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  /**
   * Login user with email and password
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  /**
   * OAuth login/registration (Google, GitHub)
   */
  public async oauthLogin(
    provider: 'google' | 'github',
    providerId: string,
    email: string,
    name?: string
  ): Promise<AuthResponse> {
    // Try to find existing user by provider ID
    let user = await this.prisma.user.findUnique({
      where: provider === 'google' ? { googleId: providerId } : { githubId: providerId },
    });

    // If not found, try by email
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      // Update with provider ID if user exists
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: provider === 'google' ? { googleId: providerId } : { githubId: providerId },
        });
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleId: provider === 'google' ? providerId : null,
          githubId: provider === 'github' ? providerId : null,
          password: '', // No password for OAuth users
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: '7d' } // Token expires in 7 days
    );
  }

  /**
   * Verify JWT token and return user ID
   */
  public verifyToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(userId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        // Exclude password and OAuth IDs
        password: false,
        googleId: false,
        githubId: false,
      },
    }) as User | null;
  }

  /**
   * Create API key for programmatic access
   */
  public async createApiKey(userId: string, name: string, expiresInDays?: number): Promise<ApiKeyResponse> {
    // Generate secure random API key
    const apiKey = `tk_${crypto.randomBytes(32).toString('hex')}`;

    // Calculate expiration date if provided
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create API key in database
    const createdKey = await this.prisma.apiKey.create({
      data: {
        key: apiKey,
        name,
        userId,
        expiresAt,
      },
    });

    return {
      id: createdKey.id,
      key: createdKey.key,
      name: createdKey.name,
      createdAt: createdKey.createdAt,
    };
  }

  /**
   * Verify API key and return user ID
   */
  public async verifyApiKey(apiKey: string): Promise<string> {
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!key) {
      throw new Error('Invalid API key');
    }

    // Check if expired
    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new Error('API key has expired');
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return key.userId;
  }

  /**
   * List all API keys for a user
   */
  public async listApiKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      id: key.id,
      key: `${key.key.substring(0, 12)}...`, // Only show first 12 characters for security
      name: key.name,
      createdAt: key.createdAt,
    }));
  }

  /**
   * Delete API key
   */
  public async deleteApiKey(userId: string, keyId: string): Promise<boolean> {
    try {
      await this.prisma.apiKey.delete({
        where: {
          id: keyId,
          userId, // Ensure user owns the key
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close Prisma connection
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
