


const PAYHERO_BASE = 'https://backend.payhero.co.ke/api/v2';


function formatPhone(phone) {
    const s = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    if (s.startsWith('254')) return s;
    if (s.startsWith('0')) return '254' + s.slice(1);
    return '254' + s;
}


function getAuthHeader() {
    
    if (process.env.PAYHERO_AUTH_TOKEN) {
        return process.env.PAYHERO_AUTH_TOKEN;
    }
    
    const creds = Buffer.from(
        `${process.env.PAYHERO_API_USERNAME}:${process.env.PAYHERO_API_PASSWORD}`
    ).toString('base64');
    return `Basic ${creds}`;
}


async function initiateSTKPush(phone, amount, bookingId, customerName) {
    const callbackUrl = process.env.PAYHERO_CALLBACK_URL;
    const externalRef = `RENT-${bookingId}-${Date.now()}`;

    const body = {
        amount: Math.ceil(parseFloat(amount)),
        phone_number: formatPhone(phone),
        channel_id: parseInt(process.env.PAYHERO_CHANNEL_ID),
        provider: 'm-pesa',
        external_reference: externalRef,
        customer_name: customerName || 'Tenant'
    };


if (callbackUrl && !callbackUrl.includes('yourdomain.com')) {
        body.callback_url = callbackUrl;
    }

    console.log('[PayHero] STK Push request:', JSON.stringify(body, null, 2));
    console.log('[PayHero] Auth header present:', !!getAuthHeader());

    try {
        const res = await fetch(`${PAYHERO_BASE}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
            },
            body: JSON.stringify(body)
        });

        const rawText = await res.text();
        console.log('[PayHero] Response status:', res.status);
        console.log('[PayHero] Response body:', rawText);

        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error('[PayHero] Invalid JSON response:', rawText.slice(0, 300));
            throw new Error(`PayHero returned non-JSON response (HTTP ${res.status})`);
        }

        if (!res.ok) {
            const errMsg = data.error_message || data.message || data.error
                || JSON.stringify(data).slice(0, 200)
                || `PayHero API error (HTTP ${res.status})`;
            console.error('[PayHero] API error:', errMsg);
            throw new Error(errMsg);
        }


data._external_reference = externalRef;
        return data;
    } catch (err) {
        if (err.message.includes('fetch failed') || err.cause) {
            console.error('[PayHero] Network error:', err.cause || err.message);
            throw new Error('Could not reach PayHero servers. Check your internet connection.');
        }
        throw err;
    }
}


async function queryPaymentStatus(reference) {
    try {
        const res = await fetch(
            `${PAYHERO_BASE}/payments?reference=${encodeURIComponent(reference)}`,
            {
                headers: { 'Authorization': getAuthHeader() }
            }
        );
        const data = await res.json();
        console.log('[PayHero] Status query for', reference, ':', JSON.stringify(data).slice(0, 300));
        return data;
    } catch (err) {
        console.error('[PayHero] Status query error:', err.message);
        return {};
    }
}

module.exports = { initiateSTKPush, queryPaymentStatus, formatPhone };
