import { NextResponse } from 'next/server';

const SMS_ERROR_CODES: Record<string, string> = {
  '202': 'SMS Submitted Successfully',
  '1001': 'Invalid Number',
  '1002': 'Sender ID not correct or disabled',
  '1003': 'Required fields missing. Contact Administrator',
  '1005': 'Internal Error',
  '1006': 'Balance Validity Not Available',
  '1007': 'Balance Insufficient',
  '1011': 'User Id not found',
  '1012': 'Masking SMS must be sent in Bengali',
  '1013': 'Sender Id not found Gateway by api key',
  '1014': 'Sender Type Name not found using this sender by api key',
  '1015': 'Sender Id has not found Any Valid Gateway by api key',
  '1016': 'Sender Type Name Active Price Info not found by this sender id',
  '1017': 'Sender Type Name Price Info not found by this sender id',
  '1018': 'The Owner of this Account is disabled',
  '1019': 'The Price of this Account is disabled',
  '1020': 'The parent of this account is not found.',
  '1021': 'The parent active price of this account is not found.',
  '1031': 'Your Account Not Verified, Please Contact Administrator.',
  '1032': 'IP Not whitelisted',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { number, message, messages, apiKey: bodyApiKey, senderId: bodySenderId } = body;

    const apiKey = bodyApiKey || process.env.SMS_API_KEY;
    const senderId = bodySenderId || process.env.SMS_SENDER_ID;

    if (!apiKey || !senderId) {
      console.error('SMS API Key or Sender ID not configured');
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      );
    }

    let apiUrl = 'http://139.99.39.237/api/smsapimany';
    let payload: any = {
      api_key: apiKey,
      senderid: senderId,
      messages: []
    };

    if (messages && Array.isArray(messages)) {
      payload.messages = messages;
    } else {
      if (!number || !message) {
        return NextResponse.json(
          { error: 'Number and message are required' },
          { status: 400 }
        );
      }
      payload.messages = [{ to: number, message }];
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse SMS API response as JSON. Status:', response.status, 'Response:', responseText);
      return NextResponse.json(
        { 
          error: 'SMS API returned an unexpected response (not JSON)', 
          details: responseText.slice(0, 500), // Increased detail
          status: response.status,
          success: false 
        },
        { status: 200 }
      );
    }

    // Map response code to meaning
    const responseCode = data.response_code?.toString();
    let errorText = '';
    if (responseCode && SMS_ERROR_CODES[responseCode]) {
      errorText = SMS_ERROR_CODES[responseCode];
    } else {
      const rawMsg = data.error_message || data.success_message || data.message;
      if (rawMsg && typeof rawMsg === 'string' && rawMsg.trim() !== '') {
        errorText = rawMsg.trim();
      }
    }

    if (!response.ok || (responseCode && responseCode !== '202')) {
      const finalErrorMsg = errorText !== '' ? errorText : 'Failed to send SMS (Gateway Error)';
      return NextResponse.json(
        { 
          error: finalErrorMsg,
          error_message: finalErrorMsg,
          response_code: responseCode,
          success: false
        },
        { status: 200 } // Return 200 but with error info so client can show popup
      );
    }

    const finalData = { ...data };
    if (finalData.error_message !== undefined) {
      delete finalData.error_message;
    }

    return NextResponse.json({ ...finalData, success: true });
  } catch (error: any) {
    console.error('SMS API Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
