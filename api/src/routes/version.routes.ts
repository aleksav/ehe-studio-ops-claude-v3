import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

let cachedVersion: string | undefined;

function getVersion(): string {
  if (cachedVersion === undefined) {
    try {
      const pkgPath = join(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
      cachedVersion = pkg.version ?? '0.0.0';
    } catch {
      cachedVersion = '0.0.0';
    }
  }
  return cachedVersion;
}

router.get('/', (_req: Request, res: Response) => {
  res.json({ version: getVersion() });
});

export default router;
