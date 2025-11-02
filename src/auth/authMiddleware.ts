import { Request, Response, NextFunction } from 'express';
import { AuthService } from './authService';

/**
 * Authentication Middleware - Protects routes and verifies JWT tokens or API keys
 */

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to verify JWT token from Authorization header
   */
  public verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get token from Authorization header (Bearer token)
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const { userId } = this.authService.verifyToken(token);

      // Attach user ID to request
      req.userId = userId;

      // Optionally fetch full user details
      const user = await this.authService.getUserById(userId);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      req.user = user;

      next();
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  /**
   * Middleware to verify API key from x-api-key header
   */
  public verifyApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get API key from x-api-key header
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({ error: 'No API key provided' });
        return;
      }

      // Verify API key
      const userId = await this.authService.verifyApiKey(apiKey);

      // Attach user ID to request
      req.userId = userId;

      // Optionally fetch full user details
      const user = await this.authService.getUserById(userId);
      req.user = user;

      next();
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Invalid API key' });
    }
  };

  /**
   * Flexible middleware that accepts either JWT token or API key
   */
  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Try JWT token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return this.verifyToken(req, res, next);
    }

    // Try API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return this.verifyApiKey(req, res, next);
    }

    // No authentication provided
    res.status(401).json({ error: 'No authentication provided. Use Bearer token or x-api-key header.' });
  };

  /**
   * Optional authentication - doesn't fail if no auth provided
   * Useful for endpoints that work for both authenticated and non-authenticated users
   */
  public optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Try JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { userId } = this.authService.verifyToken(token);
        req.userId = userId;
        const user = await this.authService.getUserById(userId);
        req.user = user;
      } else {
        // Try API key
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          const userId = await this.authService.verifyApiKey(apiKey);
          req.userId = userId;
          const user = await this.authService.getUserById(userId);
          req.user = user;
        }
      }
    } catch (error) {
      // Silently fail - optional auth
    }

    next();
  };
}

/**
 * Export singleton instance for easy use
 */
export const authMiddleware = new AuthMiddleware();
