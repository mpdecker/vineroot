import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalAttachmentStorage {
  constructor(private config: ConfigService) {}

  private uploadRoot(): string {
    return this.config.get<string>('UPLOAD_ROOT') ?? path.join(process.cwd(), 'uploads');
  }

  private absPath(relativePath: string): string {
    return path.join(this.uploadRoot(), ...relativePath.split('/'));
  }

  async write(relativePath: string, buffer: Buffer): Promise<void> {
    const abs = this.absPath(relativePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer);
  }

  exists(relativePath: string): boolean {
    return existsSync(this.absPath(relativePath));
  }

  createReadStream(relativePath: string): ReturnType<typeof createReadStream> {
    return createReadStream(this.absPath(relativePath));
  }

  async remove(relativePath: string): Promise<void> {
    const abs = this.absPath(relativePath);
    try {
      await fs.unlink(abs);
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
      if (code !== 'ENOENT') throw e;
    }
  }
}
