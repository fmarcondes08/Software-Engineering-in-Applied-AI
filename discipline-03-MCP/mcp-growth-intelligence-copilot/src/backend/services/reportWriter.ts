import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CampaignReport } from '../domain/types.ts';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export async function writeMarkdownReport(reportsDir: string, report: CampaignReport) {
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${report.createdAt.slice(0, 10)}-${slugify(report.title)}-${report.id.slice(0, 8)}.md`;
  const fullPath = join(reportsDir, fileName);
  await writeFile(fullPath, report.markdown, 'utf8');
  return fullPath;
}
