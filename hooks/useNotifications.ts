import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Notification, NotificationType } from '@/types/notification';
import { getStories } from '@/lib/sanity/queries';
import { urlFor } from '@/lib/sanity/client';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNotification, setNewNotification] = useState<Notification | null>(null);

  // Subscription state: true only if user subscribed in browser or via local opt-in
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const local = localStorage.getItem('sawaflix_subscribed_notifications');
    const perm = 'Notification' in window ? Notification.permission : 'default';
    return local === 'true' || perm === 'granted';
  });

  // Keep subscription status synchronized
  useEffect(() => {
    const updateSubStatus = () => {
      if (typeof window === 'undefined') return;
      const local = localStorage.getItem('sawaflix_subscribed_notifications');
      const perm = 'Notification' in window ? Notification.permission : 'default';
      const sub = local === 'true' || perm === 'granted';
      setIsSubscribed(sub);
    };

    updateSubStatus();
    window.addEventListener('sawaflix_subscription_changed', updateSubStatus);
    window.addEventListener('storage', updateSubStatus);
    return () => {
      window.removeEventListener('sawaflix_subscription_changed', updateSubStatus);
      window.removeEventListener('storage', updateSubStatus);
    };
  }, []);

  // Use a stable ref for supabase client to prevent re-renders triggering new subscriptions
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const channelRef = useRef<any>(null);
  const teardownRef = useRef<Promise<unknown> | null>(null);

  const mapNotification = (n: any): Notification => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    actorName: n.actor_name || n.data?.actorName,
    actorImage: n.actor_image || n.data?.actorImage,
    type: n.type as NotificationType,
    title: n.title,
    message: n.message,
    contentId: n.content_id || n.data?.contentId || n.data?.videoId,
    contentType: n.content_type || n.data?.contentType,
    category: n.category || n.data?.category,
    thumbnail: n.thumbnail || n.data?.thumbnail,
    read: n.is_read,
    createdAt: new Date(n.created_at).getTime(),
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      // Users should ONLY see notifications if they subscribed to notifications
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('sawaflix_subscribed_notifications');
        const perm = 'Notification' in window ? Notification.permission : 'default';
        if (local !== 'true' && perm !== 'granted') {
          setNotifications([]);
          setUnreadCount(0);
          setLoading(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      // Guest / unauthenticated users must never receive notifications or unread badges
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // 1. Fetch Supabase notifications
      let supabaseNotifs: Notification[] = [];
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

        if (!fetchError && data) {
          supabaseNotifs = data.map(mapNotification);
        }

      // 2. Fetch latest Sanity stories to ensure no stories are missed
      let sanityNotifs: Notification[] = [];
      try {
        const stories = await getStories();
        if (stories && Array.isArray(stories)) {
          const recentStories = stories.slice(0, 10);
          sanityNotifs = recentStories
            .filter((story: any) => {
              const slug = story.slug?.current || story._id;
              // Check if user has dismissed or clicked this story — take it down!
              const isDismissed = typeof window !== 'undefined' && (
                localStorage.getItem(`dismissed_sanity_story_${story._id}`) === 'true' ||
                localStorage.getItem(`read_sanity_story_${story._id}`) === 'true'
              );
              if (isDismissed) return false;
              // Avoid duplicates if already recorded in Supabase notifications
              return !supabaseNotifs.some((sn) => sn.contentId === slug || sn.contentId === story._id);
            })
            .map((story: any) => {
              let thumbUrl: string | undefined = undefined;
              if (story.mainImage) {
                try {
                  thumbUrl = urlFor(story.mainImage).url();
                } catch {
                  thumbUrl = undefined;
                }
              }

              let authorAvatar: string | undefined = undefined;
              if (story.author?.avatar) {
                try {
                  authorAvatar = urlFor(story.author.avatar).url();
                } catch {
                  authorAvatar = undefined;
                }
              }

              return {
                id: `sanity-story-${story._id}`,
                userId: user?.id || 'guest',
                actorId: story.author?._id || 'sanity-editorial',
                actorName: story.author?.name || 'SawaFlix Editorial',
                actorImage: authorAvatar,
                type: 'story' as NotificationType,
                title: `New Story: ${story.title || 'Untitled'}`,
                message: story.excerpt || 'Read the latest story on Sawaflix!',
                contentId: story.slug?.current || story._id,
                contentType: 'story',
                category: story.category?.title || 'Story',
                thumbnail: thumbUrl,
                read: false,
                createdAt: story.publishedAt ? new Date(story.publishedAt).getTime() : Date.now(),
              };
            });
        }
      } catch (sanityErr) {
        console.warn("Could not fetch Sanity stories for notifications:", sanityErr);
      }

      // Merge and sort by timestamp descending
      const merged = [...supabaseNotifs, ...sanityNotifs].sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(merged);

      const unread = merged.filter((n) => !n.read).length;
      setUnreadCount(unread);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchUnreadCount = useCallback(async () => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      if (id.startsWith('sanity-story-')) {
        const storyId = id.replace('sanity-story-', '');
        if (typeof window !== 'undefined') {
          localStorage.setItem(`dismissed_sanity_story_${storyId}`, 'true');
          localStorage.setItem(`read_sanity_story_${storyId}`, 'true');
        }
      } else {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      // Mark all local sanity stories as read in localStorage
      notifications.forEach((n) => {
        if (n.id.startsWith('sanity-story-') && typeof window !== 'undefined') {
          const storyId = n.id.replace('sanity-story-', '');
          localStorage.setItem(`read_sanity_story_${storyId}`, 'true');
        }
      });

      if (user) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (updateError) throw updateError;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const subscribe = async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          try {
            if ('serviceWorker' in navigator) {
              const readyReg = await navigator.serviceWorker.ready;
              const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
              if (vapidKey && readyReg.pushManager) {
                const sub = await readyReg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidKey)
                });
                const { data: { session } } = await supabase.auth.getSession();
                await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscription: sub, userId: session?.user?.id || 'anonymous' })
                });
              }
            }
          } catch (pushErr) {
            console.warn('[useNotifications] Push registration notice:', pushErr);
          }
          localStorage.setItem('sawaflix_subscribed_notifications', 'true');
          setIsSubscribed(true);
          window.dispatchEvent(new Event('sawaflix_subscription_changed'));
          await fetchNotifications();
          return true;
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('sawaflix_subscribed_notifications', 'true');
        setIsSubscribed(true);
        window.dispatchEvent(new Event('sawaflix_subscription_changed'));
        await fetchNotifications();
      }
      return true;
    } catch (e) {
      console.error('[useNotifications] Subscribe error:', e);
      return false;
    }
  };

  const unsubscribe = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sawaflix_subscribed_notifications');
    }
    setIsSubscribed(false);
    setNotifications([]);
    setUnreadCount(0);
    window.dispatchEvent(new Event('sawaflix_subscription_changed'));
  };

  const deleteNotification = async (id: string) => {
    try {
      if (id.startsWith('sanity-story-')) {
        const storyId = id.replace('sanity-story-', '');
        if (typeof window !== 'undefined') {
          localStorage.setItem(`dismissed_sanity_story_${storyId}`, 'true');
          localStorage.setItem(`read_sanity_story_${storyId}`, 'true');
        }
      } else {
        const { error: deleteError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);

        if (deleteError) {
          console.warn('[useNotifications] Supabase update notice:', deleteError.message);
        }
      }

      const deletedNotification = notifications.find(n => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    let isMounted = true;

    const setupRealtime = async () => {
      // Wait for any in-flight teardown — from this call or a previous
      // instance's cleanup — before doing anything else. supabase-js can
      // hand back the SAME (already-subscribed) channel object from
      // .channel() if a prior channel with this exact topic name hasn't
      // finished being removed yet, and calling .on() on an
      // already-subscribed channel throws "cannot add postgres_changes
      // callbacks ... after subscribe()". This happens on any remount that
      // reuses the same topic (`notifications-${user.id}`) — most visibly
      // during dev via React Fast Refresh, but the race exists regardless of
      // what triggers the remount.
      if (teardownRef.current) {
        await teardownRef.current;
      }
      if (!isMounted) return;

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !isMounted) return;

      if (channelRef.current) {
        const toRemove = channelRef.current;
        channelRef.current = null;
        await supabase.removeChannel(toRemove);
      }
      if (!isMounted) return;

      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newNotif = mapNotification(payload.new);
            setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
            setUnreadCount((prev) => prev + 1);
            setNewNotification(newNotif);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const updatedNotif = mapNotification(payload.new);
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
            fetchUnreadCount();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const deletedId = payload.old.id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
            fetchUnreadCount();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to notifications realtime');
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('Realtime subscription error:', err || 'Check if Realtime is enabled for "notifications" table in Supabase dashboard');
          }
        });

      channelRef.current = channel;
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        const toRemove = channelRef.current;
        channelRef.current = null;
        // Can't await inside a cleanup function, so track the promise
        // instead — the next setupRealtime() call (if any) awaits it.
        teardownRef.current = supabase.removeChannel(toRemove).finally(() => {
          teardownRef.current = null;
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — fetchNotifications/fetchUnreadCount are stable useCallbacks

  return {
    notifications,
    unreadCount,
    loading,
    error,
    newNotification,
    isSubscribed,
    subscribe,
    unsubscribe,
    setNewNotification,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

