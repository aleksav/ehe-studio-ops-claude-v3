import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listHolidaysByTeamMember,
  getPlannedHoliday,
  getHolidayAllowance,
  createPlannedHolidayService,
  updatePlannedHolidayService,
  deletePlannedHolidayService,
  listHolidaysByYear,
} from '../services/planned-holiday.service';
import { HolidayDayType, Prisma } from '../generated/prisma/client';
import { z } from 'zod';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  day_type: z.nativeEnum(HolidayDayType),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  day_type: z.nativeEnum(HolidayDayType).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const teamMemberId = req.params.id;
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    if (yearParam && (isNaN(year!) || year! < 1900 || year! > 2100)) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }
    const holidays = await listHolidaysByTeamMember(teamMemberId, year);
    res.json(holidays);
  } catch (error) {
    console.error('List planned holidays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listAll(req: AuthenticatedRequest, res: Response) {
  try {
    const yearParam = req.query.year as string | undefined;
    if (!yearParam) {
      res.status(400).json({ error: 'year parameter is required' });
      return;
    }
    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }
    const holidays = await listHolidaysByYear(year);
    res.json(holidays);
  } catch (error) {
    console.error('List all planned holidays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const holiday = await getPlannedHoliday(req.params.holidayId);
    if (!holiday) {
      res.status(404).json({ error: 'Planned holiday not found' });
      return;
    }
    res.json(holiday);
  } catch (error) {
    console.error('Get planned holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function allowance(req: AuthenticatedRequest, res: Response) {
  try {
    const teamMemberId = req.params.id;
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (yearParam && (isNaN(year) || year < 1900 || year > 2100)) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }
    const result = await getHolidayAllowance(teamMemberId, year);
    res.json(result);
  } catch (error) {
    console.error('Get holiday allowance error:', error);
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
    const holiday = await createPlannedHolidayService(req.params.id, parsed.data, actorId);
    res.status(201).json(holiday);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A holiday is already planned for that date' });
      return;
    }
    console.error('Create planned holiday error:', error);
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
    const holiday = await updatePlannedHolidayService(req.params.holidayId, parsed.data, actorId);

    if (!holiday) {
      res.status(404).json({ error: 'Planned holiday not found' });
      return;
    }

    res.json(holiday);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A holiday is already planned for that date' });
      return;
    }
    console.error('Update planned holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const holiday = await deletePlannedHolidayService(req.params.holidayId, actorId);

    if (!holiday) {
      res.status(404).json({ error: 'Planned holiday not found' });
      return;
    }

    res.json(holiday);
  } catch (error) {
    console.error('Delete planned holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
