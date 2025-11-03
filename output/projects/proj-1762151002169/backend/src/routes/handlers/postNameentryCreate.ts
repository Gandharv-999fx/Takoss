import { Request, Response } from 'express';
import { PrismaClient, NameEntry } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken } from '../middleware/authMiddleware'; // Assuming you have an auth middleware

const prisma = new PrismaClient();

// Request/Response interfaces
interface POSTNameEntryRequest {
  name: string;
}

interface POSTNameEntryResponse {
  success: boolean;
  data?: NameEntry;
  error?: string;
}

// Validation schema
const nameentrySchema = z.object({
  name: z.string().min(1, { message: "Name must be at least 1 character." }),
});

/**
 * @route   POST /nameentrys
 * @desc    Create a new NameEntry
 * @access  Private (Authentication required)
 */
export const postNameentryCreate = async (
  req: Request,
  res: Response<POSTNameEntryResponse>
): Promise<void> => {
  try {
    // Authentication check (using middleware)
    authenticateToken(req, res, async () => {

      // Validate request body
      const validatedData = nameentrySchema.safeParse(req.body);

      if (!validatedData.success) {
        res.status(400).json({
          success: false,
          error: validatedData.error.errors.map(e => e.message).join(', '),
        });
        return;
      }

      const { name } = validatedData.data;

      // Create the NameEntry in the database
      const newNameEntry = await prisma.nameentry.create({
        data: {
          name,
        },
      });

      res.status(201).json({ success: true, data: newNameEntry });
    });

  } catch (error: any) {
    console.error("Error creating NameEntry:", error);

    if (error.code === 'P2002') {
      // Unique constraint violation (e.g., name already exists)
      res.status(409).json({
        success: false,
        error: 'Name already exists.',
      });
    } else if (error.name === 'UnauthorizedError') {
      // Authentication error (if the middleware throws this)
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    else {
      // Generic error handling
      res.status(500).json({
        success: false,
        error: 'Failed to create NameEntry.  Please try again later.',
      });
    }
  } finally {
    await prisma.$disconnect();
  }
};
