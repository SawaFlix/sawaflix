import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';

export async function POST(req: NextRequest) {
  try {
    await ensureAreaToryTables();
    const body = await req.json().catch(() => ({}));
    const storyIds: string[] = Array.isArray(body.storyIds) ? body.storyIds : [];

    if (storyIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    // Limit to max 100 IDs per batch
    const sanitizedIds = storyIds.slice(0, 100).map(String);

    const records = await prisma.storyStats.findMany({
      where: {
        storyId: { in: sanitizedIds },
      },
    }).catch(() => []);

    const statsMap: Record<string, { likesCount: number; viewsCount: number; commentsCount: number }> = {};

    records.forEach((r) => {
      statsMap[r.storyId] = {
        likesCount: r.likesCount,
        viewsCount: r.viewsCount,
        commentsCount: r.commentsCount,
      };
    });

    return NextResponse.json({ stats: statsMap });
  } catch (error: any) {
    console.error('[StoryBatchStats API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
