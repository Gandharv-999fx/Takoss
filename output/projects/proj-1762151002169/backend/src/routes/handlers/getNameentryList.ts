import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request/Response interfaces
interface GETNameEntryRequest {
  query: {
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
  };
}

interface GETNameEntryResponse {
  data: {
    name: string;
    id: number; // Assuming NameEntry has an 'id' field
    createdAt: Date;
    updatedAt: Date;
  }[];
  total: number;
  page: number;
  limit: number;
}

// Validation schema for query parameters
const getNameEntryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Authentication middleware (replace with your actual authentication logic)
 */
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Example: Check for a valid API key in the header
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== 'YOUR_API_KEY') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};


/**
 * List all NameEntry with pagination
 * @route GET /nameentrys
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - A promise that resolves when the response is sent
 */
export const getNameentryList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Validate query parameters
    const parsedQuery = getNameEntryQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      res.status(400).json({ success: false, error: parsedQuery.error.errors });
      return;
    }

    const { page, limit, sort, order } = parsedQuery.data;

    const currentPage = page || 1;
    const itemsPerPage = limit || 10;
    const skip = (currentPage - 1) * itemsPerPage;

    // 2. Build Prisma query options
    const orderBy = sort ? { [sort]: order || 'asc' } : undefined;

    // 3. Fetch data from the database
    const [data, total] = await Promise.all([
      prisma.nameentry.findMany({
        skip,
        take: itemsPerPage,
        orderBy,
      }),
      prisma.nameentry.count(),
    ]);

    // 4. Construct the response
    const responseData: GETNameEntryResponse = {
      data: data.map(item => ({
        name: item.name,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      total,
      page: currentPage,
      limit: itemsPerPage,
    };

    // 5. Send the response
    res.status(200).json({ success: true, data: responseData });

  } catch (error: any) {
    // 6. Handle errors
    console.error('Error fetching NameEntry list:', error);

    if (error.code === 'P2002') {
      // Unique constraint violation
      res.status(400).json({ success: false, error: 'Unique constraint violation' });
    } else if (error.code === 'P2025') {
      // Record not found
      res.status(404).json({ success: false, error: 'Record not found' });
    } else {
      // Generic error
      res.status(500).json({ success: false, error: 'Failed to fetch NameEntry list' });
    }
  } finally {
    await prisma.$disconnect();
  }
};

export default (app: any) => {
  app.get('/nameentrys', authenticate, getNameentryList);
}
