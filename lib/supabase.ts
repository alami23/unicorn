import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (typeof window !== 'undefined') {
  const isUnexpectedPrefix = supabaseAnonKey && supabaseAnonKey.startsWith('sb_');
  const looksLikeProjectRef = supabaseAnonKey && supabaseAnonKey.length < 50;
  
  console.log('Supabase Config Check:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasPublishableKey: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    urlStart: supabaseUrl ? supabaseUrl.slice(0, 15) : 'None',
    keyLength: supabaseAnonKey?.length || 0,
    isUnexpectedFormat: isUnexpectedPrefix || looksLikeProjectRef
  });

  if (isUnexpectedPrefix) {
    console.warn('CRITICAL: Your Supabase API key starts with "sb_". This is usually a "Publishable Key" for different integrations. For the Supabase JS client, you MUST use the "anon public" key found in your Dashboard (it starts with "eyJ").');
  }
  if (looksLikeProjectRef && supabaseAnonKey) {
    console.warn('CRITICAL: Your Supabase API key is very short. It looks like you might have pasted the "Project Ref" instead of the "anon public" Key. The correct key is a very long string starting with "eyJ".');
  }
}

// Fallback to empty strings if missing, AuthProvider will handle the missing key error gracefully

class MemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const getStorage = () => {
  if (typeof window === 'undefined') return undefined; // Supabase handles this natively
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn('localStorage is not available, falling back to memory storage for Safari/iframe');
    return new MemoryStorage();
  }
};

function headersToPlainObject(headers: any): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!headers) return obj;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      obj[key] = value;
    });
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      obj[key] = value;
    });
  } else if (typeof headers === 'object') {
    Object.keys(headers).forEach(key => {
      obj[key] = headers[key];
    });
  }
  return obj;
}

const rawSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: getStorage(),
    },
    global: {
      fetch: (input, init) => {
        let options = { ...init };
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('db-fetch-start'));
          try {
            const storedUser = localStorage.getItem('custom_user');
            if (storedUser) {
              const userObj = JSON.parse(storedUser);
              const plainHeaders = headersToPlainObject(options.headers);
              const orgId = userObj.org_id || userObj.id || '';
              if (orgId) {
                plainHeaders['x-org-id'] = orgId;
              }
              if (userObj.id) {
                plainHeaders['x-user-id'] = String(userObj.id);
              }
              if (userObj.role) {
                plainHeaders['x-user-role'] = String(userObj.role);
              }
              if (userObj.email) {
                plainHeaders['x-user-email'] = String(userObj.email);
              }
              if (userObj.phone) {
                plainHeaders['x-user-phone'] = String(userObj.phone);
              }
              options.headers = plainHeaders;
            }
          } catch (e) {
            console.warn('Error reading custom_user in global.fetch:', e);
          }
        }
        return fetch(input, {
          ...options,
          cache: 'no-store',
        }).finally(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('db-fetch-end'));
          }
        });
      },
    },
  }
);

export function getTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('custom_user');
    if (stored) {
      const u = JSON.parse(stored);
      return u.org_id || u.id || null;
    }
  } catch (e) {}
  return null;
}

export function getCurrentUser(): { id?: string; name?: string; username?: string; role?: string; org_id?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('custom_user');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  return null;
}

const TENANT_TABLES = [
  'customer',
  'staff',
  'bills',
  'furniture_inventory',
  'wood_inventory',
  'furniture_invoices',
  'wood_invoices',
  'furniture_invoice_items',
  'wood_invoice_items',
  'transactions',
  'furniture_category',
  'wood_category',
  'wood_category_car',
  'wood_category_tag',
  'sms_history',
  'make_excel_file',
];

export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (tableName: string) => {
        const queryBuilder = target.from(tableName);
        const orgId = getTenantId();

        if (!orgId) {
          return queryBuilder;
        }

        if (tableName === 'app_settings') {
          return new Proxy(queryBuilder, {
            get(builderTarget, builderProp) {
              const originalMethod = Reflect.get(builderTarget, builderProp);
              if (typeof originalMethod === 'function') {
                return (...args: any[]) => {
                  if (builderProp === 'insert' || builderProp === 'upsert') {
                    let data = args[0];
                    if (data) {
                      if (Array.isArray(data)) {
                        data = data.map(item => ({
                          ...item,
                          id: (item.id === 'global' || !item.id) ? orgId : item.id
                        }));
                      } else {
                        data = {
                          ...data,
                          id: (data.id === 'global' || !data.id) ? orgId : data.id
                        };
                      }
                      args[0] = data;
                    }
                  }
                  
                  const result = originalMethod.apply(builderTarget, args);
                  
                  return new Proxy(result, {
                    get(resultTarget, resultProp) {
                      const resultMethod = Reflect.get(resultTarget, resultProp);
                      if (resultProp === 'eq') {
                        return (column: string, value: any) => {
                          if (column === 'id' && value === 'global') {
                            return resultMethod.call(resultTarget, 'id', orgId);
                          }
                          return resultMethod.call(resultTarget, column, value);
                        };
                      }
                      if (typeof resultMethod === 'function') {
                        return (...resultArgs: any[]) => {
                          const resVal = resultMethod.apply(resultTarget, resultArgs);
                          return resVal;
                        };
                      }
                      return resultMethod;
                    }
                  });
                };
              }
              return originalMethod;
            }
          });
        }

        if (!TENANT_TABLES.includes(tableName)) {
          return queryBuilder;
        }

        return new Proxy(queryBuilder, {
          get(builderTarget, builderProp) {
            const originalMethod = Reflect.get(builderTarget, builderProp);
            if (typeof originalMethod === 'function') {
              return (...args: any[]) => {
                if (builderProp === 'insert' || builderProp === 'upsert') {
                  let data = args[0];
                  if (data) {
                    if (Array.isArray(data)) {
                      data = data.map(item => ({ ...item, org_id: orgId }));
                    } else {
                      data = { ...data, org_id: orgId };
                    }
                    args[0] = data;
                  }
                  return originalMethod.apply(builderTarget, args);
                }

                if (builderProp === 'select' || builderProp === 'update' || builderProp === 'delete') {
                  const result = originalMethod.apply(builderTarget, args);
                  return result.eq('org_id', orgId);
                }

                return originalMethod.apply(builderTarget, args);
              };
            }
            return originalMethod;
          }
        });
      };
    }

    const value = Reflect.get(target, prop);
    if (typeof value === 'function') {
      return (...args: any[]) => value.apply(target, args);
    }
    return value;
  }
});

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export { rawSupabase };

export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('customer').select('id').limit(1);
    if (error) {
      console.error('Supabase Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        url: supabaseUrl,
        keyUsed: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 10)}...` : 'None'
      });
      
      if (error.message.includes('Invalid API key')) {
        console.error('TROUBLESHOOTING: Your Supabase API key is invalid. This usually means you have either: \n1. Copy-pasted the wrong key (you need "anon public", not "service_role")\n2. Have a typo in the key\n3. Are using the "Project Ref" instead of the Key.\nThe key should be a long string starting with "eyJ".');
      }
      
      throw error;
    }
    return { success: true };
  } catch (error: any) {
    console.error('Supabase Connection Test Failed:', error);
    return { success: false, error: error.message };
  }
}

