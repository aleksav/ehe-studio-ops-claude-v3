import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listPublicHolidays,
  getPublicHoliday,
  createPublicHolidayService,
  updatePublicHolidayService,
  deletePublicHolidayService,
} from '../services/public-holiday.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  name: z.string().min(1).max(255),
});

const updateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  name: z.string().min(1).max(255).optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    if (yearParam && (isNaN(year!) || year! < 1900 || year! > 2100)) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }
    const holidays = await listPublicHolidays(year);
    res.json(holidays);
  } catch (error) {
    console.error('List public holidays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const holiday = await getPublicHoliday(req.params.id);
    if (!holiday) {
      res.status(404).json({ error: 'Public holiday not found' });
      return;
    }
    res.json(holiday);
  } catch (error) {
    console.error('Get public holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const holiday = await createPublicHolidayService(parsed.data, actorId);
    res.status(201).json(holiday);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A public holiday already exists on that date' });
      return;
    }
    console.error('Create public holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const actorId = req.user?.teamMemberId ?? null;
    const holiday = await updatePublicHolidayService(req.params.id, parsed.data, actorId);

    if (!holiday) {
      res.status(404).json({ error: 'Public holiday not found' });
      return;
    }

    res.json(holiday);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A public holiday already exists on that date' });
      return;
    }
    console.error('Update public holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const holiday = await deletePublicHolidayService(req.params.id, actorId);

    if (!holiday) {
      res.status(404).json({ error: 'Public holiday not found' });
      return;
    }

    res.json(holiday);
  } catch (error) {
    console.error('Delete public holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
