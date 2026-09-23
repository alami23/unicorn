import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function generateSlug(length = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoiceNumber, invoiceDate, code, targetUrl } = body

    if (!invoiceNumber || !invoiceDate || !code) {
      return NextResponse.json(
        { error: 'invoiceNumber, invoiceDate, and code are required.' },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()
    const slug = body.slug || generateSlug(6)

    if (client) {
      // 1. Try to insert into public.short_links table
      try {
        const { error: insertError } = await client
          .from('short_links')
          .insert({
            slug,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            code,
            target_url: targetUrl || '',
            clicks: 0,
            created_at: new Date().toISOString()
          })

        if (!insertError) {
          return NextResponse.json({
            success: true,
            slug,
            invoiceNumber,
            invoiceDate,
            code
          })
        }

        // If insert error is not missing table (e.g. unique constraint collision), retry with longer slug
        if (insertError.code === '23505') {
          const newSlug = generateSlug(7)
          await client.from('short_links').insert({
            slug: newSlug,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            code,
            target_url: targetUrl || '',
            clicks: 0,
            created_at: new Date().toISOString()
          })
          return NextResponse.json({
            success: true,
            slug: newSlug,
            invoiceNumber,
            invoiceDate,
            code
          })
        }
      } catch (err) {
        console.warn('Error inserting to short_links table, falling back:', err)
      }

      // 2. Fallback: store in app_settings if short_links table is not yet created
      try {
        const { data: existingSettings } = await client
          .from('app_settings')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle()

        const currentSettings = existingSettings?.settings || {}
        const shortLinksMap = currentSettings.short_links || {}
        shortLinksMap[slug] = {
          invoiceNumber,
          invoiceDate,
          code,
          targetUrl,
          createdAt: new Date().toISOString()
        }

        await client
          .from('app_settings')
          .upsert({
            id: 'global',
            settings: {
              ...currentSettings,
              short_links: shortLinksMap
            }
          })

        return NextResponse.json({
          success: true,
          slug,
          invoiceNumber,
          invoiceDate,
          code
        })
      } catch (fallbackErr) {
        console.warn('Fallback app_settings store failed:', fallbackErr)
      }
    }

    // Return generated slug regardless
    return NextResponse.json({
      success: true,
      slug,
      invoiceNumber,
      invoiceDate,
      code
    })
  } catch (error: any) {
    console.error('URL Shortener POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error while shortening URL.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug parameter is required.' }, { status: 400 })
    }

    const client = getSupabaseClient()
    if (!client) {
      return NextResponse.json({ error: 'Database service is unavailable.' }, { status: 500 })
    }

    // 1. Try to read from short_links table
    try {
      const { data: link, error: linkError } = await client
        .from('short_links')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (!linkError && link) {
        // Increment clicks asynchronously
        client.from('short_links').update({ clicks: (link.clicks || 0) + 1 }).eq('slug', slug).then()

        return NextResponse.json({
          success: true,
          slug: link.slug,
          invoiceNumber: link.invoice_number,
          invoiceDate: link.invoice_date,
          code: link.code,
          targetUrl: link.target_url
        })
      }
    } catch (e) {
      console.warn('Error reading from short_links table:', e)
    }

    // 2. Try to read from app_settings fallback
    try {
      const { data: existingSettings } = await client
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle()

      const item = existingSettings?.settings?.short_links?.[slug]
      if (item) {
        return NextResponse.json({
          success: true,
          slug,
          invoiceNumber: item.invoiceNumber,
          invoiceDate: item.invoiceDate,
          code: item.code,
          targetUrl: item.targetUrl
        })
      }
    } catch (e) {
      console.warn('Error reading fallback settings:', e)
    }

    return NextResponse.json({ error: 'Short link not found.' }, { status: 404 })
  } catch (error: any) {
    console.error('URL Shortener GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error while resolving slug.' },
      { status: 500 }
    )
  }
}
