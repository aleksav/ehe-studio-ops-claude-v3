import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authMiddleware,
  AuthenticatedRequest,
} from '../middleware/auth';
import { writeAudit, buildCreateAuditFields } from '../services/audit.service';
import { AuditAction } from '@prisma/client';

const router = Router();

const ALLOWED_EMAIL_DOMAINS = (
  process.env.ALLOWED_EMAIL_DOMAINS || 'ehe.ai,tsf.tech,thestartupfactory.tech'
)
  .split(',')
  .map((d) => d.trim().toLowerCase());

function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role_title } = req.body;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'email, password, and full_name are required' });
      return;
    }

    if (!isAllowedEmailDomain(email)) {
      res.status(403).json({
        error: `Registration restricted to ${ALLOWED_EMAIL_DOMAINS.map((d) => '@' + d).join(', ')} email addresses`,
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const teamMember = await tx.teamMember.create({
        data: { full_name, email, role_title },
      });

      const user = await tx.user.create({
        data: { email, password_hash, team_member_id: teamMember.id },
      });

      await writeAudit(tx, {
        entityType: 'User',
        entityId: user.id,
        action: AuditAction.CREATE,
        actorId: teamMember.id,
        changedFields: buildCreateAuditFields({
          id: user.id,
          email: user.email,
          team_member_id: teamMember.id,
        }),
      });

      await writeAudit(tx, {
        entityType: 'TeamMember',
        entityId: teamMember.id,
        action: AuditAction.CREATE,
        actorId: teamMember.id,
        changedFields: buildCreateAuditFields({
          id: teamMember.id,
          full_name: teamMember.full_name,
          email: teamMember.email,
          role_title: teamMember.role_title,
        }),
      });

      return { user, teamMember };
    });

    const payload = { userId: result.user.id, teamMemberId: result.teamMember.id };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.status(201).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        team_member: {
          id: result.teamMember.id,
          full_name: result.teamMember.full_name,
          email: result.teamMember.email,
          role_title: result.teamMember.role_title,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { team_member: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: user.id, teamMemberId: user.team_member_id };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        team_member: user.team_member
          ? {
              id: user.team_member.id,
              full_name: user.team_member.full_name,
              email: user.team_member.email,
              role_title: user.team_member.role_title,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    const payload = verifyToken(refresh_token);
    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { team_member: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newPayload = { userId: user.id, teamMemberId: user.team_member_id };
    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  // Stateless JWT — client discards tokens. This endpoint exists for API completeness.
  res.json({ message: 'Logged out successfully' });
});

export default router;
