'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  ImageIcon,
  Save,
  X,
  RotateCcw,
  Palette,
  Trash2,
  Sparkles,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import NextImage from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { addNotification } from '@/lib/notifications';

interface OnboardingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  forceOpen?: boolean;
}

export default function OnboardingModal({ isOpen: externalIsOpen, onClose, forceOpen = false }: OnboardingModalProps) {
  const { user } = useAuth();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [logo, setLogo] = useState('');
  const [logoX, setLogoX] = useState(50);
  const [logoY, setLogoY] = useState(50);
  const [logoZoom, setLogoZoom] = useState(100);
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [defaultWoodPrice, setDefaultWoodPrice] = useState<string>('');

  const [showLogoAdjust, setShowLogoAdjust] = useState(false);

  const resetFormFields = () => {
    setBusinessName('');
    setLogo('');
    setLogoX(50);
    setLogoY(50);
    setLogoZoom(100);
    setPhone('');
    setSecondaryPhone('');
    setWhatsapp('');
    setEmail('');
    setAddress('');
    setDefaultWoodPrice('');
    setShowLogoAdjust(false);
  };

  const loadExistingData = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.from('app_settings').select('settings').eq('id', 'global').single();
      if (data && data.settings) {
        const settings = data.settings as any;
        const userBusiness = settings.business_by_user?.[userId] || settings.business || {};

        if (userBusiness.name) setBusinessName(userBusiness.name);
        else if (user?.name) setBusinessName(user.name);

        if (userBusiness.logo) setLogo(userBusiness.logo);
        if (userBusiness.logoX !== undefined) setLogoX(userBusiness.logoX);
        if (userBusiness.logoY !== undefined) setLogoY(userBusiness.logoY);
        if (userBusiness.logoZoom !== undefined) setLogoZoom(userBusiness.logoZoom);

        if (userBusiness.phone) setPhone(userBusiness.phone);
        else if (user?.phone) setPhone(user.phone);

        if (userBusiness.secondaryPhone) setSecondaryPhone(userBusiness.secondaryPhone);
        if (userBusiness.whatsapp) setWhatsapp(userBusiness.whatsapp);

        if (userBusiness.email) setEmail(userBusiness.email);
        else if (user?.email) setEmail(user.email);

        if (userBusiness.address) setAddress(userBusiness.address);

        if (settings.system?.defaultWoodPrice !== undefined && settings.system?.defaultWoodPrice !== null && settings.system?.defaultWoodPrice !== '') {
          setDefaultWoodPrice(settings.system.defaultWoodPrice.toString());
        } else {
          setDefaultWoodPrice('');
        }

        return settings;
      }
    } catch (err) {
      console.warn('Error loading existing business settings:', err);
    }
    return null;
  }, [user]);

  // Check if modal should open automatically
  useEffect(() => {
    if (!user) {
      setInternalIsOpen(false);
      setIsLoading(false);
      return;
    }

    const checkOnboardingNeeded = async () => {
      setIsLoading(true);
      try {
        const userId = user.id;
        const localStatus = localStorage.getItem(`onboarding_status_${userId}`);
        const justSignedUp = localStorage.getItem(`just_signed_up_${userId}`) === 'true';

        // Populate fields with existing records if available
        resetFormFields();
        const settings = await loadExistingData(userId);

        // Identify creator ID (if set in settings, or first user in users array)
        const creatorId = settings?.creator_id || settings?.org_creator_id || settings?.users?.[0]?.id;
        
        // Determine if current logged-in user is the organization's creator
        const isCreator = !settings || !settings.users || settings.users.length === 0 || (creatorId ? userId === creatorId : true);

        // Check DB onboarding completion flags (only user-specific)
        const dbCompleted = settings?.onboarding_completed_by_user?.[userId];
        const dbSkipped = settings?.onboarding_skipped_by_user?.[userId];

        if (forceOpen) {
          // Explicit manual button click
          setInternalIsOpen(true);
        } else if (justSignedUp && isCreator && !dbCompleted && !dbSkipped && !localStatus) {
          // ONLY open automatically for the user on their VERY FIRST login after signup
          setInternalIsOpen(true);
        } else {
          // Do NOT pop up for subsequent logins, nor for any other users added to the organization later
          setInternalIsOpen(false);
        }
      } catch (err) {
        console.warn('Onboarding check error:', err);
        if (forceOpen) setInternalIsOpen(true);
        else setInternalIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingNeeded();

    const handleOpenEvent = () => {
      if (user?.id) {
        resetFormFields();
        loadExistingData(user.id);
      }
      setInternalIsOpen(true);
    };
    window.addEventListener('open_onboarding_modal', handleOpenEvent);
    return () => {
      window.removeEventListener('open_onboarding_modal', handleOpenEvent);
    };
  }, [user, forceOpen, loadExistingData]);

  const modalVisible = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleCloseModal = () => {
    setInternalIsOpen(false);
    if (user?.id) {
      try {
        localStorage.removeItem(`just_signed_up_${user.id}`);
        localStorage.setItem(`onboarding_status_${user.id}`, 'closed');
      } catch (e) {
        console.warn('localStorage error:', e);
      }
    }
    if (onClose) onClose();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${user?.id || 'anon'}-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      setLogo(urlData.publicUrl);
    } catch (error: any) {
      console.warn('Storage upload fallback to base64 encoding:', error);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setLogo(reader.result as string);
          }
        };
        reader.readAsDataURL(file);
      } catch (encodeError) {
        console.error('Failed to read image file:', encodeError);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setAlertMsg(null);

    try {
      const userId = user.id;

      // 1. Fetch current global settings from Supabase
      const { data: settingsRow } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();

      const currentSettings = (settingsRow?.settings as any) || {
        business: {},
        business_by_user: {},
        system: { lowStockThreshold: 5, autoLogoutTime: 5, theme: 'light' },
        onboarding_completed_by_user: {}
      };

      const updatedBusiness = {
        name: businessName.trim(),
        logo: logo,
        logoX: logoX,
        logoY: logoY,
        logoZoom: logoZoom,
        phone: phone.trim(),
        secondaryPhone: secondaryPhone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim()
      };

      if (!currentSettings.business_by_user) {
        currentSettings.business_by_user = {};
      }
      currentSettings.business_by_user[userId] = updatedBusiness;
      currentSettings.business = updatedBusiness;

      const parsedWoodPrice = defaultWoodPrice === '' ? null : parseFloat(defaultWoodPrice);

      if (!currentSettings.system) {
        currentSettings.system = {};
      }
      currentSettings.system.defaultWoodPrice = parsedWoodPrice;

      if (!currentSettings.creator_id) {
        currentSettings.creator_id = userId;
      }
      currentSettings.onboarding_completed = true;

      if (!currentSettings.onboarding_completed_by_user) {
        currentSettings.onboarding_completed_by_user = {};
      }
      currentSettings.onboarding_completed_by_user[userId] = true;

      // 2. Save settings back to Supabase
      const { error: upsertErr } = await supabase.from('app_settings').upsert({
        id: 'global',
        settings: currentSettings,
        updated_at: new Date().toISOString()
      });

      if (upsertErr) throw upsertErr;

      // 3. Update localStorage for client cache
      try {
        localStorage.setItem('business_name', businessName.trim());
        localStorage.setItem('business_logo', logo);
        localStorage.setItem('business_logo_x', logoX.toString());
        localStorage.setItem('business_logo_y', logoY.toString());
        localStorage.setItem('business_logo_zoom', logoZoom.toString());

        if (parsedWoodPrice !== null && !isNaN(parsedWoodPrice)) {
          localStorage.setItem('defaultWoodPrice', parsedWoodPrice.toString());
        } else {
          localStorage.removeItem('defaultWoodPrice');
        }

        localStorage.setItem(`onboarding_status_${userId}`, 'completed');
        localStorage.removeItem(`just_signed_up_${userId}`);
      } catch (e) {
        console.warn('localStorage update failed:', e);
      }

      addNotification('settings_update', 'Business Onboarding Complete', 'Your business details and system configuration have been updated.');

      // Dispatch custom events for real-time header/sidebar sync
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('settings_updated'));

      setAlertMsg({ type: 'success', text: 'Onboarding completed! Business profile saved successfully.' });

      setTimeout(() => {
        handleCloseModal();
      }, 800);
    } catch (err: any) {
      console.error('Failed to save onboarding settings:', err);
      setAlertMsg({ type: 'error', text: err.message || 'Failed to save information. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    const userId = user.id;

    try {
      localStorage.setItem(`onboarding_status_${userId}`, 'skipped');
      localStorage.removeItem(`just_signed_up_${userId}`);

      // Persist skip status in DB
      const { data: settingsRow } = await supabase.from('app_settings').select('settings').eq('id', 'global').maybeSingle();
      if (settingsRow && settingsRow.settings) {
        const settings = { ...settingsRow.settings } as any;
        if (!settings.creator_id) settings.creator_id = userId;
        settings.onboarding_skipped = true;
        if (!settings.onboarding_skipped_by_user) settings.onboarding_skipped_by_user = {};
        settings.onboarding_skipped_by_user[userId] = true;

        await supabase.from('app_settings').upsert({
          id: 'global',
          settings: settings,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Skip onboarding status save error:', e);
    }

    handleCloseModal();
  };

  if (!modalVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
        >
          {/* Header Banner */}
          <div className="relative px-6 py-6 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md shrink-0">
                <Sparkles size={24} className="text-amber-100" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Welcome! Setup Your Business</h2>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Skip setup"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
            {alertMsg && (
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium ${
                  alertMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-700 dark:text-rose-400'
                }`}
              >
                {alertMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{alertMsg.text}</span>
              </div>
            )}

            {/* Logo & Business Name Section */}
            <div className="flex flex-col sm:flex-row gap-6 items-start p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              {/* Logo Upload Box */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Business Logo
                </label>
                <div className="relative group w-28 h-28">
                  <label className="cursor-pointer block w-full h-full rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden relative shadow-sm hover:border-amber-500 transition-colors">
                    {logo ? (
                      <NextImage
                        src={logo}
                        alt="Logo Preview"
                        fill
                        sizes="112px"
                        unoptimized={logo.startsWith('data:') || logo.startsWith('blob:')}
                        className="object-cover"
                        style={{
                          objectPosition: `${logoX}% ${logoY}%`,
                          transform: `translate(${logoX - 50}%, ${logoY - 50}%) scale(${logoZoom / 100})`,
                          transformOrigin: 'center'
                        }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 hover:text-amber-500 transition-colors">
                        <ImageIcon size={28} />
                        <span className="text-[10px] font-bold">Upload Logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo('')}
                      className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-full text-rose-500 hover:text-rose-700 shadow-md transition-all"
                      title="Remove Logo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {logo && (
                  <button
                    type="button"
                    onClick={() => setShowLogoAdjust(!showLogoAdjust)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <Palette size={12} />
                    {showLogoAdjust ? 'Hide Position' : 'Adjust Position'}
                  </button>
                )}
              </div>

              {/* Business Name Field */}
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 size={15} className="text-amber-600" />
                    Business Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Royal Furniture Ltd."
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-900 dark:text-slate-100 text-sm transition-all"
                  />
                </div>

                {/* Logo Adjustment Controls */}
                {logo && showLogoAdjust && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Logo Offset</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoX(50);
                          setLogoY(50);
                          setLogoZoom(100);
                        }}
                        className="text-[11px] text-amber-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 font-medium">Position X ({logoX}%)</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={logoX}
                          onChange={(e) => setLogoX(parseInt(e.target.value))}
                          className="w-full accent-amber-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Position Y ({logoY}%)</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={logoY}
                          onChange={(e) => setLogoY(parseInt(e.target.value))}
                          className="w-full accent-amber-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Zoom ({logoZoom}%)</span>
                        <input
                          type="range"
                          min="50"
                          max="200"
                          value={logoZoom}
                          onChange={(e) => setLogoZoom(parseInt(e.target.value))}
                          className="w-full accent-amber-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Contact Phone Numbers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone size={14} className="text-amber-600" />
                  Primary Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1700-000000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone size={14} className="text-amber-600" />
                  Secondary Phone
                </label>
                <input
                  type="text"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  placeholder="Optional phone number"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-600" />
                    WhatsApp
                  </label>
                  {phone && (
                    <button
                      type="button"
                      onClick={() => setWhatsapp(phone)}
                      className="text-[10px] text-amber-600 hover:underline font-semibold"
                    >
                      Same as phone
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp number"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all font-medium"
                />
              </div>
            </div>

            {/* Email and Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail size={14} className="text-amber-600" />
                  Business Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="business@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-600" />
                  Default Wood Price (৳ / cft)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
                  <input
                    type="number"
                    step="any"
                    value={defaultWoodPrice}
                    onChange={(e) => setDefaultWoodPrice(e.target.value)}
                    placeholder="e.g. 0"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Address Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin size={14} className="text-amber-600" />
                Physical Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Furniture Market, Highway Road, Dhaka"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 dark:text-slate-100 transition-all resize-none font-medium"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="w-full sm:w-auto px-5 py-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold text-sm transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-center"
              >
                Skip for Now
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/25 transition-all text-sm"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save & Continue
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
