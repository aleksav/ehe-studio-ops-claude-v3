import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuditAction } from '@prisma/client';
import prisma from '../utils/prisma';

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string, 10) || 25));

    const { entity_type, action, date_from, date_to } = req.query;

    const where: Record<string, unknown> = {};

    if (entity_type && typeof entity_type === 'string') {
      where.entity_type = entity_type;
    }

    if (
      action &&
      typeof action === 'string' &&
      Object.values(AuditAction).includes(action as AuditAction)
    ) {
      where.action = action as AuditAction;
    }

    if (date_from || date_to) {
      const createdAt: Record<string, Date> = {};
      if (date_from && typeof date_from === 'string') {
        createdAt.gte = new Date(date_from);
      }
      if (date_to && typeof date_to === 'string') {
        // Include the entire end date by setting to end of day
        const endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }
      where.created_at = createdAt;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, full_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('List audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
