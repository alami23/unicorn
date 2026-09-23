import { supabase } from './supabase';

export type NotificationType = 'sale' | 'invoice_update' | 'inventory_update' | 'settings_update' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

// Keep backward compatibility naming in component mapping
export const getNotifications = async (): Promise<AppNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

export const addNotification = async (type: NotificationType, title: string, message: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{ type, title, message }]);
      
    if (error) {
      // Table removed or unavailable - fail silently
      return;
    }
  } catch {
    // Fail silently
  }
}

export const markAllNotificationsRead = async () => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
      
    if (error) {
      return;
    }
  } catch {
    // Fail silently
  }
}

export const markNotificationRead = async (id: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
      
    if (error) {
      return;
    }
  } catch {
    // Fail silently
  }
}

export const subscribeToNotifications = (callback: (payload: any) => void) => {
  try {
    const channel = supabase.channel('custom-all-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

