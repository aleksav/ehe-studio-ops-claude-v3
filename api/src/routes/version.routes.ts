import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';

const router = Router();

let cachedVersion: string | undefined;

function getVersion(): string {
  if (cachedVersion === undefined) {
    try {
      cachedVersion = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      cachedVersion = 'unknown';
    }
  }
  return cachedVersion;
}

router.get('/', (_req: Request, res: Response) => {
  res.json({ version: getVersion() });
});

export default router;
