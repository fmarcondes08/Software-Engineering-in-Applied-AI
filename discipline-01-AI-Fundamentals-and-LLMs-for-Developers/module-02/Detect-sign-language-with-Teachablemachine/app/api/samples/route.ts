import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const samplesDir = path.join(process.cwd(), 'public', 'samples');
  try {
    const files = fs
      .readdirSync(samplesDir)
      .filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f));
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
