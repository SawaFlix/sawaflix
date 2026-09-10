import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    await ensureAreaToryTables();
    const { commentId } = await props.params;

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required to like comments.' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Check existing like
    const existing = await prisma.storyCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    }).catch(() => null);

    let liked = false;
    if (existing) {
      await prisma.storyCommentLike.delete({
        where: { id: existing.id },
      }).catch(() => null);
      liked = false;
    } else {
      const commentLikeId = `cmlike_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await prisma.storyCommentLike.create({
        data: {
          id: commentLikeId,
          commentId,
          userId,
        },
      }).catch((err) => {
        console.error('[StoryCommentLike] Error creating comment like:', err);
        return null;
      });
      liked = true;
    }

    const totalLikes = await prisma.storyCommentLike.count({
      where: { commentId },
    }).catch(() => 0);

    return NextResponse.json({
      liked,
      likesCount: totalLikes,
    });
  } catch (error: any) {
    console.error('[StoryCommentLike API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
