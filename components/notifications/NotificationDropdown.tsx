import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';
import NotificationPanel from '../Dashboard/NotificationPanel';

export const NotificationDropdown: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    isSubscribed,
    subscribe,
    unsubscribe,
    deleteNotification,
    markAllRead,
    handleNotificationClick
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();

  return (
    <div className="relative dropdown dropdown-end group">
      <label 
        tabIndex={0} 
        className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all relative cursor-pointer group flex items-center justify-center"
        onClick={(e) => {
          if (!isAuthenticated) {
            e.preventDefault();
            e.stopPropagation();
            openAuthModal('to view notifications');
            return;
          }
          setIsOpen(!isOpen);
        }}
      >
        <Bell size={20} className="group-hover:text-white transition-colors" />
        {isAuthenticated && isSubscribed && unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 bg-[#E50914] text-white font-black rounded-full flex items-center justify-center text-[9px] shadow-[0_0_10px_rgba(229,9,20,0.7)] animate-in zoom-in duration-300">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </label>

      <div 
        tabIndex={0} 
        className="dropdown-content z-[100] mt-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <NotificationPanel 
          title="Notifications"
          subtitle={`${unreadCount} new updates`}
          notifications={notifications.slice(0, 15).map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            read: n.read,
            timestamp: (n as any).createdAt || (n as any).timestamp,
            thumbnail: (n as any).thumbnail,
            contentId: (n as any).contentId,
            category: (n as any).category
          }))}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onClose={() => {
            const elem = document.activeElement as HTMLElement;
            if (elem) elem.blur();
            setIsOpen(false);
          }}
          onItemClick={(id) => {
            const notification = notifications.find(n => n.id === id);
            if (notification) {
              handleNotificationClick(notification);
            }
            setIsOpen(false);
          }}
          onDismissItem={(id) => {
            deleteNotification(id);
          }}
          isSubscribed={isSubscribed}
          onSubscribe={subscribe}
          onUnsubscribe={unsubscribe}
          accentColor="red"
          viewAllHref="/dashboard/notification"
        />
      </div>
    </div>
  );
};

