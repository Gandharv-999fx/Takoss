import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request/Response interfaces
interface DELETENameEntryRequest {
  params: {
    id: string;
  };
}

interface DELETENameEntryResponse {
  success: boolean;
  data?: void;
  error?: string;
}

// Validation schema (if needed) -  Not needed for DELETE by ID in this case

/**
 * Authentication middleware (replace with your actual authentication logic)
 * @param req
 * @param res
 * @param next
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
 * Delete a NameEntry
 * @route DELETE /nameentrys/:id
 * @param req - Express Request object with NameEntry ID in params
 * @param res - Express Response object
 * @returns A Promise that resolves to void
 */
export const deleteNameentryDelete = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Authentication check
    authenticate(req, res, () => {
      // Proceed if authenticated

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'NameEntry ID is required' });
        return;
      }

      // Delete the NameEntry
      await prisma.nameentry.delete({
        where: {
          id: id,
        },
      });

      // Respond with success
      res.status(204).send(); // 204 No Content - Successful deletion
    });

  } catch (error: any) {
    console.error('Error deleting NameEntry:', error);

    if (error.code === 'P2025') {
      // Prisma error code for record not found
      res.status(404).json({ success: false, error: 'NameEntry not found' });
    } else if (error.code === 'P2003') {
      // Prisma error code for foreign key constraint failure
      res.status(400).json({ success: false, error: 'Foreign key constraint failed.  The NameEntry may be referenced by other records.' });
    }
    else {
      // Generic error handling
      res.status(500).json({ success: false, error: 'Failed to delete NameEntry' });
    }
  } finally {
    await prisma.$disconnect();
  }
};
