import { Request, Response } from 'express';
import { PrismaClient, NameEntry } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request/Response interfaces
interface PUTNameEntryRequest {
  params: { id: string };
  body: { name?: string };
}

interface PUTNameEntryResponse {
  success: boolean;
  data?: NameEntry;
  error?: string;
}

// Validation schema
const nameentrySchema = z.object({
  name: z.string().optional(),
});

/**
 * Update a NameEntry
 * @route PUT /nameentrys/:id
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Promise representing the asynchronous operation
 */
export const putNameentryUpdate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Authentication check (replace with your actual authentication logic)
    if (!req.isAuthenticated()) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Validate request body
    const validatedData = nameentrySchema.safeParse(req.body);

    if (!validatedData.success) {
      res.status(400).json({
        success: false,
        error: `Validation error: ${validatedData.error.message}`,
      });
      return;
    }

    const data = validatedData.data;

    // Check if data is empty. If so, return a 400 error.
    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, error: 'Request body cannot be empty' });
      return;
    }


    // Update the NameEntry in the database
    const updatedNameEntry = await prisma.nameentry.update({
      where: { id },
      data,
    });

    // Return success response
    const response: PUTNameEntryResponse = {
      success: true,
      data: updatedNameEntry,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error updating NameEntry:', error);

    if (error.code === 'P2025') {
      // Prisma error code for "An operation failed because it depends on one or more records that were required but not found"
      res.status(404).json({ success: false, error: 'NameEntry not found' });
    } else if (error.code === 'P2002') {
      // Prisma error code for "Unique constraint failed"
      res.status(400).json({ success: false, error: 'Unique constraint violation' });
    }
    else if (error.code === 'P2003') {
      // Prisma error code for "Foreign key constraint failed"
      res.status(400).json({ success: false, error: 'Foreign key constraint violation' });
    }
    else {
      // Generic error handling
      res.status(500).json({ success: false, error: 'Failed to update NameEntry' });
    }
  } finally {
    await prisma.$disconnect();
  }
};

// Mock authentication middleware (replace with your actual middleware)
declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
    }
  }
}

// Mock implementation for demonstration purposes
(Request.prototype as any).isAuthenticated = function () {
  // Replace with your actual authentication logic
  return true; // Or false, depending on your authentication status
};
