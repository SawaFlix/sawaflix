import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BACKEND_URL } from '@/lib/apiConfig';
import { getVideoDetailsAction } from '@/app/actions/youtube';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;


  if (!id) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
  }

  try {
    // 1. Handle YouTube ID (11 characters)
    if (id.length === 11) {
      console.log(`[API] Fetching YouTube video details for: ${id}`);
      try {
        const details = await getVideoDetailsAction(id);
        // Map to a common format
        return NextResponse.json({
          id: details.id,
          title: details.title,
          description: '',
          thumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
          channelTitle: details.channelTitle,
          channelId: details.channelId,
          viewCount: details.viewCount,
          likeCount: details.likeCount,
          publishedAt: details.publishedAt,
          type: 'video',
          origin: 'youtube'
        });
      } catch (ytError) {
        console.error(`[API] YouTube fetch failed for ${id}:`, ytError);
        // Continue to check if it's actually a SawaFlix ID (unlikely for 11 chars but possible)
      }
    }

    // 2. Handle SawaFlix Native Content
    console.log(`[API] Fetching SawaFlix video details for: ${id}`);
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // We call the unified feed first as it's the most reliable source of enriched data
    // In a real production app, we would have a dedicated GET /api/content/:id
    const res = await fetch(`${BACKEND_URL}/api/content`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (res.ok) {
      const data = await res.json();
      const allContent = data.data || data || [];
      const video = allContent.find((v: any) => v.id === id);

      if (video) {
        return NextResponse.json({
          id: video.id,
          title: video.title,
          description: video.description,
          thumbnail: video.cover_url || video.thumbnail,
          videoUrl: video.media_url,
          channelTitle: video.creator_name || 'SawaFlix',
          channelId: video.creator_id || 'sawaflix',
          type: video.category || video.content_type || 'video',
          origin: 'sawaflix',
          publishedAt: video.created_at
        });
      }
    }

    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  } catch (error: any) {
    console.error(`[API] Error fetching video ${id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
