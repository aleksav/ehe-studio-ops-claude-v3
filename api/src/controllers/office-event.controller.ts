import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  listOfficeEvents,
  getOfficeEvent,
  createOfficeEventService,
  updateOfficeEventService,
  deleteOfficeEventService,
} from '../services/office-event.service';
import { OfficeEventType } from '../generated/prisma/client';
import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const eventTypeEnum = z.nativeEnum(OfficeEventType);

const createSchema = z
  .object({
    name: z.string().min(1).max(255),
    event_type: eventTypeEnum,
    start_date: z.string().regex(dateRegex, 'start_date must be YYYY-MM-DD format'),
    end_date: z.string().regex(dateRegex, 'end_date must be YYYY-MM-DD format'),
    allow_time_entry: z.boolean().default(false),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  });

const updateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    event_type: eventTypeEnum.optional(),
    start_date: z.string().regex(dateRegex, 'start_date must be YYYY-MM-DD format').optional(),
    end_date: z.string().regex(dateRegex, 'end_date must be YYYY-MM-DD format').optional(),
    allow_time_entry: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
      }
      return true;
    },
    {
      message: 'end_date must be on or after start_date',
      path: ['end_date'],
    },
  );

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    if (yearParam && (isNaN(year!) || year! < 1900 || year! > 2100)) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }
    const events = await listOfficeEvents(year);
    res.json(events);
  } catch (error) {
    console.error('List office events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function get(req: AuthenticatedRequest, res: Response) {
  try {
    const event = await getOfficeEvent(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Office event not found' });
      return;
    }
    res.json(event);
  } catch (error) {
    console.error('Get office event error:', error);
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
    const event = await createOfficeEventService(parsed.data, actorId);
    res.status(201).json(event);
  } catch (error) {
    console.error('Create office event error:', error);
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
    const event = await updateOfficeEventService(req.params.id, parsed.data, actorId);

    if (!event) {
      res.status(404).json({ error: 'Office event not found' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('Update office event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.teamMemberId ?? null;
    const event = await deleteOfficeEventService(req.params.id, actorId);

    if (!event) {
      res.status(404).json({ error: 'Office event not found' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('Delete office event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
