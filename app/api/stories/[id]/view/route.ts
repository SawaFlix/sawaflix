import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAreaToryTables();
    const { id: storyId } = await props.params;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    // Optional user ID from session
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch {
      // Guest
    }

    // Fingerprint: IP + User-Agent + Current Date (UTC YYYY-MM-DD)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'anonymous';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const today = new Date().toISOString().slice(0, 10);

    const hashInput = `${storyId}-${userId || ip}-${userAgent}-${today}`;
    const viewHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // Attempt to insert view record
    const existingView = await prisma.storyView.findUnique({
      where: {
        storyId_viewHash: {
          storyId,
          viewHash,
        },
      },
    }).catch(() => null);

    let isNewView = false;

    if (!existingView) {
      try {
        await prisma.storyView.create({
          data: {
            storyId,
            userId,
            viewHash,
          },
        });
        isNewView = true;
      } catch {
        // Handled race condition: unique constraint already met
      }
    }

    // If new view, increment stats counter
    let viewsCount: number;
    if (isNewView) {
      const updatedStats = await prisma.storyStats.upsert({
        where: { storyId },
        update: { viewsCount: { increment: 1 } },
        create: { storyId, likesCount: 0, viewsCount: 1, commentsCount: 0 },
      }).catch(() => null);
      viewsCount = updatedStats?.viewsCount ?? 1;
    } else {
      const currentStats = await prisma.storyStats.findUnique({
        where: { storyId },
      }).catch(() => null);
      viewsCount = currentStats?.viewsCount ?? 0;
    }

    return NextResponse.json({
      success: true,
      isNewView,
      viewsCount,
    });
  } catch (error: any) {
    console.error('[StoryView API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
