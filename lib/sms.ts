import { supabase } from './supabase'
import { toast } from 'sonner'

/**
 * Utility to send SMS via the internal API route
 * @param number - Recipient phone number (or array of messages for bulk)
 * @param message - Message content (optional if bulk)
 * @param config - Optional API configuration (apiKey, senderId) for testing
 * @returns Promise with the API response
 */
export async function sendSMS(
  number: string | { to: string, message: string }[], 
  message?: string,
  config?: { apiKey?: string; senderId?: string }
) {
  const saveToHistory = async (status: 'Delivered' | 'Failed') => {
    try {
      if (typeof number === 'string') {
        const { error } = await supabase.from('sms_history').insert([{
          id: `SMS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          phone: number,
          message: message,
          status: status
        }])
        if (error) throw error
      } else {
        const entries = number.map((item, index) => ({
          id: `SMS-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          phone: item.to,
          message: item.message,
          status: status
        }))
        const { error } = await supabase.from('sms_history').insert(entries)
        if (error) throw error
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sms_history_updated'));
      }
    } catch (e) {
      console.error('Failed to save SMS history to Supabase', e);
    }
  };

  const id = typeof number === 'string' ? number : 'Bulk SMS';

  try {
    const payload: any = typeof number === 'string' 
      ? { number, message } 
      : { messages: number };

    // Try to get config from Supabase if not provided
    let finalApiKey = config?.apiKey;
    let finalSenderId = config?.senderId;

    if (!finalApiKey || !finalSenderId) {
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single();
      
      if (settingsData && settingsData.settings) {
        const settings = settingsData.settings as any;
        if (!finalApiKey) finalApiKey = settings.integrations?.smsApiKey;
        if (!finalSenderId) finalSenderId = settings.integrations?.smsSenderId;
      }
    }

    if (finalApiKey) payload.apiKey = finalApiKey;
    if (finalSenderId) payload.senderId = finalSenderId;

    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send SMS');
    }

    saveToHistory('Delivered');
    toast.success(`SMS sent successfully to ${id}`);
    return data;
  } catch (error: any) {
    console.error('sendSMS Error:', error);
    saveToHistory('Failed');
    const errMsg = error.message === 'Failed to fetch' 
      ? 'Network error. Could not connect to the server.' 
      : error.message || 'Unknown error';
    toast.error(`Failed to send SMS to ${id}: ${errMsg}`);
    throw error;
  }
}
