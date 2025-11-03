import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request/Response interfaces
interface GETNameEntryRequest {
  params: {
    id: string;
  };
}

interface GETNameEntryResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
  };
  error?: string;
}

// Validation schema (if needed) - Not needed for GET by ID, but included for completeness
const nameentrySchema = z.object({
  id: z.string().uuid(), // Validate ID as UUID
});

/**
 * Authentication middleware (replace with your actual authentication logic)
 */
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Example: Check for an API key in the header
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== 'your-secret-api-key') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};


/**
 * Get a NameEntry by ID
 * @route GET /nameentrys/:id
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - A promise that resolves when the response is sent
 */
export const getNameentryRead = [
  authenticate, // Apply authentication middleware
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate the ID using Zod
      try {
        nameentrySchema.parse({ id });
      } catch (error: any) {
        console.error("Validation Error:", error.errors);
        res.status(400).json({ success: false, error: "Invalid ID format" });
        return;
      }

      const nameEntry = await prisma.nameentry.findUnique({
        where: { id },
      });

      if (!nameEntry) {
        res.status(404).json({ success: false, error: 'NameEntry not found' });
        return;
      }

      const responseData: GETNameEntryResponse = {
        success: true,
        data: {
          id: nameEntry.id,
          name: nameEntry.name,
        },
      };

      res.status(200).json(responseData);
    } catch (error: any) {
      console.error('Prisma Error:', error);

      if (error.code === 'P2002') {
        // Unique constraint violation
        res.status(400).json({ success: false, error: 'Unique constraint violation' });
      } else if (error.code === 'P2025') {
        // Record not found (although we already check for this)
        res.status(404).json({ success: false, error: 'NameEntry not found' });
      } else {
        // Generic error
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    } finally {
      await prisma.$disconnect();
    }
  },
];
