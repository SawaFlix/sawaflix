import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/prisma';
import { ensureAreaToryTables } from '@/lib/prisma/ensureAreaToryTables';
import { createClient } from '@/utils/supabase/server';

// In-memory rate limiting map: IP/UserID -> timestamp[]
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(key: string, limit = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

// Simple HTML/script tag sanitizer
function sanitizeContent(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/onload=/gi, '')
    .replace(/onerror=/gi, '')
    .trim();
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAreaToryTables();
    const { id: storyId } = await props.params;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const sort = searchParams.get('sort') || 'top'; // 'top' | 'newest'

    // Optional user session for isLikedByMe
    let currentUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) currentUserId = user.id;
    } catch {
      // Guest
    }

    // Fetch top-level comments with replies and likes
    const comments = await prisma.storyComment.findMany({
      where: {
        storyId,
        parentId: null,
        isDeleted: false,
      },
      include: {
        likes: true,
        replies: {
          where: { isDeleted: false },
          include: {
            likes: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: sort === 'newest' 
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' }, // We will sort 'top' in-memory by likes count
    }).catch(() => []);

    // Format comments and replies
    const formatted = comments.map(c => {
      const likesCount = c.likes.length;
      const isLikedByMe = currentUserId ? c.likes.some(l => l.userId === currentUserId) : false;

      const formattedReplies = (c.replies || []).map(r => ({
        id: r.id,
        storyId: r.storyId,
        userId: r.userId,
        userName: r.userName,
        userAvatar: r.userAvatar,
        userRole: r.userRole,
        content: r.content,
        parentId: r.parentId,
        isPinned: r.isPinned,
        createdAt: r.createdAt,
        likesCount: r.likes.length,
        isLikedByMe: currentUserId ? r.likes.some(l => l.userId === currentUserId) : false,
      }));

      return {
        id: c.id,
        storyId: c.storyId,
        userId: c.userId,
        userName: c.userName,
        userAvatar: c.userAvatar,
        userRole: c.userRole,
        content: c.content,
        parentId: c.parentId,
        isPinned: c.isPinned,
        createdAt: c.createdAt,
        likesCount,
        isLikedByMe,
        replies: formattedReplies,
        repliesCount: formattedReplies.length,
      };
    });

    if (sort === 'top') {
      formatted.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.likesCount + b.repliesCount * 2) - (a.likesCount + a.repliesCount * 2);
      });
    }

    return NextResponse.json({
      comments: formatted,
      totalCount: formatted.length,
    });
  } catch (error: any) {
    console.error('[StoryComments GET API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

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

    // Authenticate user via Supabase session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required to comment on stories.' },
        { status: 401 }
      );
    }

    // Rate limit check
    const clientKey = `${user.id}-${req.headers.get('x-forwarded-for') || 'local'}`;
    if (!checkRateLimit(clientKey, 6, 60000)) {
      return NextResponse.json(
        { error: 'You are posting comments too fast. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawContent = (body.content || '').trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;

    if (!rawContent) {
      return NextResponse.json({ error: 'Comment content cannot be empty.' }, { status: 400 });
    }

    if (rawContent.length > 1500) {
      return NextResponse.json({ error: 'Comment is too long (maximum 1500 characters).' }, { status: 400 });
    }

    const content = sanitizeContent(rawContent);

    // Fetch user profile info from Supabase public.users if available, or metadata
    let userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Community Member';
    let userAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    let userRole = 'member';

    try {
      const { data: profile } = await supabase
        .from('users')
        .select('username, profile_image_url, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.username) userName = profile.username;
        if (profile.profile_image_url) userAvatar = profile.profile_image_url;
        if (profile.role) userRole = profile.role;
      }
    } catch {
      // Fallback to metadata
    }

    // If parentId provided, verify parent exists
    if (parentId) {
      const parentComment = await prisma.storyComment.findUnique({
        where: { id: parentId },
      }).catch(() => null);

      if (!parentComment || parentComment.isDeleted) {
        return NextResponse.json({ error: 'Original comment no longer exists.' }, { status: 404 });
      }
    }

    // Create comment
    const commentId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const created = await prisma.storyComment.create({
      data: {
        id: commentId,
        storyId,
        userId: user.id,
        userName,
        userAvatar,
        userRole,
        content,
        parentId,
      },
    });

    // Increment denormalized StoryStats
    await prisma.storyStats.upsert({
      where: { storyId },
      update: { commentsCount: { increment: 1 } },
      create: { storyId, likesCount: 0, viewsCount: 0, commentsCount: 1 },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      comment: {
        id: created.id,
        storyId: created.storyId,
        userId: created.userId,
        userName: created.userName,
        userAvatar: created.userAvatar,
        userRole: created.userRole,
        content: created.content,
        parentId: created.parentId,
        isPinned: created.isPinned,
        createdAt: created.createdAt,
        likesCount: 0,
        isLikedByMe: false,
        replies: [],
        repliesCount: 0,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[StoryComments POST API Error]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
