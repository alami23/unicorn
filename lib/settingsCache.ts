/**
 * Global synchronous settings & business cache for ultra-fast instant rendering
 * Eliminates loading delays for invoices, logos, business headers, and receipts.
 */

export interface CachedBusiness {
  name: string
  address: string
  email: string
  phone: string
  secondaryPhone?: string
  logo: string
  logoX?: number
  logoY?: number
  logoZoom?: number
}

let inMemorySettings: any = null
let inMemoryBusiness: CachedBusiness | null = null
const preloadedImages = new Set<string>()

/**
 * Preload an image URL into browser cache immediately so it renders on frame 0
 */
export function preloadImage(url?: string | null) {
  if (!url || typeof window === 'undefined' || typeof Image === 'undefined') return
  const trimmed = url.trim()
  if (!trimmed || preloadedImages.has(trimmed)) return

  preloadedImages.add(trimmed)
  try {
    const img = new Image()
    img.src = trimmed
  } catch (e) {
    // Non-fatal if preloading fails
  }
}

/**
 * Synchronously retrieves cached business profile from memory or localStorage.
 * Guaranteed to return complete profile immediately with 0ms delay.
 */
export function getSynchronousBusiness(fallback?: any): CachedBusiness {
  if (inMemoryBusiness && inMemoryBusiness.name) {
    if (fallback) {
      return {
        ...inMemoryBusiness,
        ...fallback,
        logo: fallback.logo || inMemoryBusiness.logo,
        name: fallback.name || inMemoryBusiness.name,
      }
    }
    return inMemoryBusiness
  }

  // Attempt to restore from localStorage synchronously
  if (typeof window !== 'undefined') {
    try {
      const cachedProfileStr = localStorage.getItem('cached_business_profile')
      if (cachedProfileStr) {
        const parsed = JSON.parse(cachedProfileStr)
        if (parsed && (parsed.name || parsed.logo)) {
          inMemoryBusiness = {
            name: parsed.name || '',
            address: parsed.address || '',
            email: parsed.email || '',
            phone: parsed.phone || '',
            secondaryPhone: parsed.secondaryPhone || '',
            logo: parsed.logo || '',
            logoX: parsed.logoX ?? 50,
            logoY: parsed.logoY ?? 50,
            logoZoom: parsed.logoZoom ?? 100,
          }
          if (inMemoryBusiness.logo) {
            preloadImage(inMemoryBusiness.logo)
          }
          return inMemoryBusiness
        }
      }

      // Fallback to individual keys stored by AuthProvider or settings
      const name = localStorage.getItem('business_name') || ''
      const logo = localStorage.getItem('business_logo') || ''
      const address = localStorage.getItem('business_address') || ''
      const phone = localStorage.getItem('business_phone') || ''
      const secondaryPhone = localStorage.getItem('business_secondary_phone') || ''
      const email = localStorage.getItem('business_email') || ''
      const logoX = parseInt(localStorage.getItem('business_logo_x') || '50') || 50
      const logoY = parseInt(localStorage.getItem('business_logo_y') || '50') || 50
      const logoZoom = parseInt(localStorage.getItem('business_logo_zoom') || '100') || 100

      if (name || logo) {
        inMemoryBusiness = {
          name,
          address,
          email,
          phone,
          secondaryPhone,
          logo,
          logoX,
          logoY,
          logoZoom,
        }
        if (logo) preloadImage(logo)
        return inMemoryBusiness
      }
    } catch (e) {
      console.warn('Failed to parse cached business settings:', e)
    }
  }

  const def: CachedBusiness = {
    name: fallback?.name || '',
    address: fallback?.address || '',
    email: fallback?.email || '',
    phone: fallback?.phone || '',
    secondaryPhone: fallback?.secondaryPhone || '',
    logo: fallback?.logo || '',
    logoX: fallback?.logoX ?? 50,
    logoY: fallback?.logoY ?? 50,
    logoZoom: fallback?.logoZoom ?? 100,
  }

  if (def.logo) preloadImage(def.logo)
  return def
}

/**
 * Synchronously retrieves cached app_settings
 */
export function getSynchronousSettings(): any {
  if (inMemorySettings) return inMemorySettings

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cached_app_settings')
      if (stored) {
        inMemorySettings = JSON.parse(stored)
        return inMemorySettings
      }
    } catch (e) {
      console.warn('Failed to parse cached app_settings:', e)
    }
  }

  return null
}

/**
 * Updates both in-memory cache and localStorage with latest settings.
 * Also preloads logo asset.
 */
export function setSynchronousSettings(settings: any, currentUserId?: string) {
  if (!settings) return

  inMemorySettings = settings

  const globalBusiness = settings.business || {}
  const userBusiness = (currentUserId && settings.business_by_user?.[currentUserId]?.name)
    ? settings.business_by_user[currentUserId]
    : globalBusiness

  const bizName = userBusiness.name || globalBusiness.name || ''
  const bizLogo = userBusiness.logo || globalBusiness.logo || ''
  const bizAddress = userBusiness.address || globalBusiness.address || ''
  const bizPhone = userBusiness.phone || globalBusiness.phone || ''
  const bizSecondaryPhone = userBusiness.secondaryPhone || globalBusiness.secondaryPhone || ''
  const bizEmail = userBusiness.email || globalBusiness.email || ''
  const bizLogoX = userBusiness.logoX ?? globalBusiness.logoX ?? 50
  const bizLogoY = userBusiness.logoY ?? globalBusiness.logoY ?? 50
  const bizLogoZoom = userBusiness.logoZoom ?? globalBusiness.logoZoom ?? 100

  const resolvedBiz: CachedBusiness = {
    name: bizName,
    address: bizAddress,
    email: bizEmail,
    phone: bizPhone,
    secondaryPhone: bizSecondaryPhone,
    logo: bizLogo,
    logoX: bizLogoX,
    logoY: bizLogoY,
    logoZoom: bizLogoZoom,
  }

  inMemoryBusiness = resolvedBiz

  if (bizLogo) {
    preloadImage(bizLogo)
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cached_app_settings', JSON.stringify(settings))
      localStorage.setItem('cached_business_profile', JSON.stringify(resolvedBiz))
      localStorage.setItem('business_name', bizName)
      localStorage.setItem('business_logo', bizLogo)
      localStorage.setItem('business_address', bizAddress)
      localStorage.setItem('business_phone', bizPhone)
      localStorage.setItem('business_secondary_phone', bizSecondaryPhone)
      localStorage.setItem('business_email', bizEmail)
      localStorage.setItem('business_logo_x', bizLogoX.toString())
      localStorage.setItem('business_logo_y', bizLogoY.toString())
      localStorage.setItem('business_logo_zoom', bizLogoZoom.toString())
    } catch (e) {
      console.warn('Failed to save settings cache to localStorage:', e)
    }
  }
}

// Auto-run synchronous cache priming on client script evaluation
if (typeof window !== 'undefined') {
  try {
    getSynchronousBusiness()
    getSynchronousSettings()
  } catch (e) {}
}
