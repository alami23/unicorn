import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SMS_ERROR_CODES: Record<string, string> = {
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
    const { phone, isDemo } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone to standard 13-digit format (8801XXXXXXXXX) for BulkSMSBD.net
    let formattedPhone = phone.replace(/\+/g, '').replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('8800')) {
      formattedPhone = '880' + formattedPhone.substring(4);
    } else if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
      formattedPhone = '88' + formattedPhone;
    } else if (formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '880' + formattedPhone;
    }

    // Generate a 6-digit OTP (for demo, we can support 123456 as a backup/test)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // Generate a secure verification token containing phone, OTP and expiry
    const secret = process.env.SMS_API_KEY || 'default-otp-secret-key';
    const dataToSign = `${formattedPhone}:${otpCode}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
    const otpToken = Buffer.from(`${formattedPhone}:${expiresAt}:${hmac}`).toString('base64');

    const messageContent = `Your POS Account verification OTP is: ${otpCode}. Valid for 5 minutes.`;

    if (isDemo) {
      console.log(`[DEMO MODE] Skip sending SMS. Phone: ${formattedPhone}, Code: ${otpCode}`);
      return NextResponse.json({
        success: true,
        isDemo: true,
        otpToken,
        message: 'Demo mode: SMS sent successfully (simulated).'
      });
    }

    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;

    if (!apiKey || !senderId) {
      console.warn('SMS core API Key or Sender ID is missing. Falling back to Demo mode.');
      return NextResponse.json({
        success: true,
        isDemo: true,
        otpToken,
        message: 'SMS Gateway credentials not configured. Temporary fallback code is generated.'
      });
    }

    try {
      const response = await fetch('http://bulksmsbd.net/api/smsapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          senderid: senderId,
          number: formattedPhone,
          message: messageContent,
        }),
      });

      const responseText = await response.text();
      let parseResult: any;
      try {
        parseResult = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse bulksmsbd response as JSON:', responseText);
        // Fallback or bubble error
      }

      console.log('BulkSMSBD API response:', parseResult || responseText);

      // check success criteria for bulk SMS BD response (usually response_code is 202 for success)
      const responseCode = parseResult?.response_code?.toString();
      if (responseCode !== '202') {
        console.warn('BulkSMSBD returned non-success response code:', responseCode);
        
        let errText = '';
        if (responseCode && SMS_ERROR_CODES[responseCode]) {
          errText = SMS_ERROR_CODES[responseCode];
        } else {
          let errDetail = parseResult?.error_message || parseResult?.message || parseResult?.success_message;
          if (typeof errDetail === 'object') {
            errDetail = JSON.stringify(errDetail);
          }
          if (errDetail && typeof errDetail === 'string' && errDetail.trim() !== '') {
            errText = errDetail.trim();
          }
        }
        
        const gatewayErr = errText !== '' ? errText : 'Gateway error or empty response';
        
        return NextResponse.json({
          success: true,
          isDemo: true,
          otpToken,
          message: `SMS gateway: ${gatewayErr}. Fallback active.`
        });
      }

      return NextResponse.json({
        success: true,
        isDemo: false,
        otpToken,
        message: 'OTP has been successfully sent to your mobile phone number.'
      });
    } catch (smsErr: any) {
      console.error('Failed sending SMS through BulkSMSBD service:', smsErr);
      return NextResponse.json({
        success: true,
        isDemo: true,
        otpToken,
        message: 'Unable to reach SMS gateway. Running in Backup verification mode.'
      });
    }
  } catch (err: any) {
    console.error('Send OTP route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
