import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAreaToryTables();
    const { id: storyId } = await props.params;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    // Authenticate user via Supabase session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required to like stories.' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Check existing like
    const existingLike = await prisma.storyLike.findUnique({
      where: {
        storyId_userId: {
          storyId,
          userId,
        },
      },
    }).catch(() => null);

    let nextLiked = false;

    if (existingLike) {
      // Unlike
      await prisma.storyLike.delete({
        where: { id: existingLike.id },
      }).catch(() => null);
      nextLiked = false;
    } else {
      // Like
      const likeId = `like_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await prisma.storyLike.create({
        data: {
          id: likeId,
          storyId,
          userId,
        },
      }).catch((err) => {
        console.error('[StoryLike] Error creating like:', err);
        return null;
      });
      nextLiked = true;
    }

    // Refresh count
    const totalLikes = await prisma.storyLike.count({
      where: { storyId },
    }).catch(() => 0);

    // Update StoryStats cache
    await prisma.storyStats.upsert({
      where: { storyId },
      update: { likesCount: totalLikes },
      create: { storyId, likesCount: totalLikes, viewsCount: 0, commentsCount: 0 },
    }).catch(() => null);

    return NextResponse.json({
      liked: nextLiked,
      likesCount: totalLikes,
    });
  } catch (error: any) {
    console.error('[StoryLike API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
