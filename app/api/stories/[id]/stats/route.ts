import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAreaToryTables();
    const { id: storyId } = await props.params;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    // Try fetching existing stats cache
    let stats = await prisma.storyStats.findUnique({
      where: { storyId },
    }).catch(() => null);

    // If no cached stats record, aggregate counts from the database
    if (!stats) {
      const [likesCount, viewsCount, commentsCount] = await Promise.all([
        prisma.storyLike.count({ where: { storyId } }).catch(() => 0),
        prisma.storyView.count({ where: { storyId } }).catch(() => 0),
        prisma.storyComment.count({ where: { storyId, isDeleted: false } }).catch(() => 0),
      ]);

      stats = await prisma.storyStats.upsert({
        where: { storyId },
        update: { likesCount, viewsCount, commentsCount },
        create: { storyId, likesCount, viewsCount, commentsCount },
      }).catch(() => ({
        storyId,
        likesCount,
        viewsCount,
        commentsCount,
        updatedAt: new Date(),
      }));
    }

    // Check if the requesting user is authenticated and has liked this story
    let isLiked = false;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const likeRecord = await prisma.storyLike.findUnique({
          where: {
            storyId_userId: {
              storyId,
              userId: user.id,
            },
          },
        }).catch(() => null);
        isLiked = !!likeRecord;
      }
    } catch {
      // Guest user — remains isLiked = false
    }

    return NextResponse.json({
      storyId,
      likesCount: stats.likesCount ?? 0,
      viewsCount: stats.viewsCount ?? 0,
      commentsCount: stats.commentsCount ?? 0,
      isLiked,
    });
  } catch (error: any) {
    console.error('[StoryStats API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
