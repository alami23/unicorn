import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey') || process.env.SMS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ balance: '0.00', error: 'API Key not configured' }, { status: 200 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(`http://139.99.39.237/api/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        // If the gateway returned raw number/text or HTML
        data = { balance: text.trim() };
      }

      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.warn('SMS Balance fetch gateway warning:', fetchError?.message || fetchError);
      return NextResponse.json({ balance: '0.00', error: 'Gateway unavailable' }, { status: 200 });
    }
  } catch (error: any) {
    console.error('SMS Balance API Error:', error?.message || error);
    return NextResponse.json({ balance: '0.00', error: error?.message || 'Internal server error' }, { status: 200 });
  }
}

