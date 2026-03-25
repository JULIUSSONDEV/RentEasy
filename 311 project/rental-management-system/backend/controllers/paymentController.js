const db = require('../config/database');
const { initiateSTKPush, queryPaymentStatus } = require('../services/payhero');

const PAYHERO_ENABLED = process.env.PAYHERO_ENABLED === 'true';


async function notify(userId, type, title, body, refId = null, refType = null) {
    try {
        await db.execute(
            'INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type) VALUES (?,?,?,?,?,?)',
            [userId, type, title, body, refId, refType]
        );
    } catch (e) { }
}


async function markVerified(paymentId, bookingId, mpesaReceipt) {
    const txnRef = mpesaReceipt || `MPESA-${Date.now()}`;
    await db.execute(
        `UPDATE payments SET status = 'verified', transaction_reference = ?,
         verified_at = datetime('now') WHERE id = ?`,
        [txnRef, paymentId]
    );
    await db.execute('UPDATE bookings SET is_paid = 1 WHERE id = ?', [bookingId]);
}


async function submitPayment(req, res) {
    try {
        const {
            booking_id, amount, phone_used,
            payment_method = 'send_money',
            payment_period_start, payment_period_end, notes,
            cash_reference
        } = req.body;

        const isCash = payment_method === 'cash';

        if (!booking_id || !amount || !payment_period_start || !payment_period_end) {
            return res.status(400).json({
                error: 'booking_id, amount, and payment period are required.'
            });
        }
        if (!isCash && !phone_used) {
            return res.status(400).json({ error: 'phone_used is required for M-Pesa payments.' });
        }


        const [bookings] = await db.execute(
            `SELECT b.*, p.landlord_id, p.title AS property_title
             FROM bookings b JOIN properties p ON p.id = b.property_id
             WHERE b.id = ? AND b.tenant_id = ? AND b.status = 'approved'`,
            [booking_id, req.user.id]
        );
        if (!bookings.length) {
            return res.status(404).json({ error: 'Active approved booking not found.' });
        }
        const booking = bookings[0];


        if (isCash) {
            const txnRef = cash_reference ? cash_reference.trim() : `CASH-${Date.now()}`;
            const [result] = await db.execute(
                `INSERT INTO payments (booking_id, tenant_id, landlord_id, amount, payment_method,
                 transaction_reference, phone_used, status,
                 payment_period_start, payment_period_end, notes, mpesa_checkout_id)
                 VALUES (?,?,?,?,'cash',?,NULL,'pending',?,?,?,NULL)`,
                [
                    booking_id, req.user.id, booking.landlord_id,
                    parseFloat(amount), txnRef,
                    payment_period_start, payment_period_end,
                    notes || null
                ]
            );
            const paymentId = result.insertId;
            await markVerified(paymentId, booking_id, txnRef).catch(() => { });
            await notify(booking.landlord_id, 'payment_received',
                'Cash Payment Received',
                `Cash payment of KES ${amount} received for ${booking.property_title}.`).catch(() => { });
            return res.status(201).json({ message: 'Cash payment recorded.', payment_id: paymentId });
        }

        let checkoutRequestId = null;
        let externalReference = null;

        if (PAYHERO_ENABLED) {

            const stkResult = await initiateSTKPush(phone_used, amount, booking_id, req.user.full_name);
            console.log('[Payment] PayHero STK result:', JSON.stringify(stkResult).slice(0, 500));


            if (!stkResult || stkResult.error) {
                return res.status(400).json({
                    error: stkResult?.message || stkResult?.error ||
                        'PayHero could not process the request. Check the phone number and try again.'
                });
            }
            checkoutRequestId = stkResult.CheckoutRequestID || stkResult.reference || stkResult.id || null;
            externalReference = stkResult._external_reference || stkResult.external_reference || `RENT-${booking_id}-${Date.now()}`;
        }


        const txnRef = checkoutRequestId ? `PH-${checkoutRequestId}` : `DEMO-${Date.now()}`;
        const trackingRef = externalReference || checkoutRequestId;


        const [result] = await db.execute(
            `INSERT INTO payments (booking_id, tenant_id, landlord_id, amount, payment_method,
             transaction_reference, phone_used, status,
             payment_period_start, payment_period_end, notes, mpesa_checkout_id)
             VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?)`,
            [
                booking_id, req.user.id, booking.landlord_id,
                parseFloat(amount), 'send_money',
                txnRef,
                phone_used,
                payment_period_start, payment_period_end,
                notes || null,
                trackingRef
            ]
        );

        const paymentId = result.insertId;
        const receiptNumber = `RCP-${String(paymentId).padStart(6, '0')}`;

        if (!PAYHERO_ENABLED) {

            setTimeout(async () => {
                try {
                    await markVerified(paymentId, booking_id, `DEMO-${Date.now()}`);
                    await notify(
                        booking.landlord_id, 'payment_received',
                        'Payment Received',
                        `${req.user.full_name} paid KES ${parseFloat(amount).toLocaleString()} for "${booking.property_title}".`,
                        paymentId, 'payment'
                    );
                    await notify(
                        req.user.id, 'payment_verified',
                        'Payment Confirmed',
                        `Your rent payment of KES ${parseFloat(amount).toLocaleString()} was confirmed.`,
                        paymentId, 'payment'
                    );
                } catch (e) { console.error('[Demo payment] Auto-verify error:', e.message); }
            }, 5000);
        }

        res.status(201).json({
            message: PAYHERO_ENABLED
                ? 'M-Pesa payment request sent to your phone. Enter your PIN to confirm.'
                : 'Processing payment... you will be notified shortly.',
            payment_id: paymentId,
            receipt_number: receiptNumber
        });
    } catch (err) {
        console.error('[Payment] Submit error:', err.message, err.stack);
        res.status(500).json({ error: err.message || 'Could not initiate payment. Please try again.' });
    }
}


async function payheroCallback(req, res) {

    res.json({ status: 'accepted' });

    try {
        const payload = req.body;
        if (!payload) return;

        const reference = payload.external_reference || payload.reference;
        const status = (payload.status || '').toUpperCase();

        if (!reference) return;

        const [payments] = await db.execute(
            'SELECT * FROM payments WHERE mpesa_checkout_id = ?',
            [reference]
        );
        if (!payments.length) return;

        const payment = payments[0];
        if (payment.status !== 'pending') return;

        if (status === 'SUCCESS' || status === 'COMPLETED') {

            const receipt = payload.provider_reference || payload.transaction_id || `PH-${Date.now()}`;

            await markVerified(payment.id, payment.booking_id, receipt);


            await notify(
                payment.landlord_id, 'payment_received',
                'Payment Confirmed',
                `Rent payment of KES ${parseFloat(payment.amount).toLocaleString()} confirmed via M-Pesa. Receipt: ${receipt}`,
                payment.id, 'payment'
            );

            await notify(
                payment.tenant_id, 'payment_verified',
                'Payment Successful',
                `Your M-Pesa payment of KES ${parseFloat(payment.amount).toLocaleString()} was successful. Receipt: ${receipt}`,
                payment.id, 'payment'
            );
        } else if (status === 'FAILED' || status === 'CANCELLED') {

            await db.execute(
                "UPDATE payments SET status = 'failed' WHERE id = ?",
                [payment.id]
            );
            await notify(
                payment.tenant_id, 'payment_failed',
                'Payment Failed',
                `Your M-Pesa payment of KES ${parseFloat(payment.amount).toLocaleString()} could not be completed. Please try again.`,
                payment.id, 'payment'
            );
        }
    } catch (err) {
        console.error('[PayHero Callback] Error:', err.message);
    }
}


async function getPaymentStatus(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT id, status, transaction_reference, mpesa_checkout_id, booking_id
             FROM payments WHERE id = ? AND tenant_id = ?`,
            [id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });

        const payment = rows[0];


        if (payment.status === 'pending' && PAYHERO_ENABLED && payment.mpesa_checkout_id) {
            try {
                const qr = await queryPaymentStatus(payment.mpesa_checkout_id);
                const phStatus = (qr.status || '').toUpperCase();

                if (phStatus === 'SUCCESS' || phStatus === 'COMPLETED') {
                    const receipt = qr.provider_reference || qr.transaction_id || null;
                    await markVerified(payment.id, payment.booking_id, receipt);
                    payment.status = 'verified';
                } else if (phStatus === 'FAILED' || phStatus === 'CANCELLED') {
                    await db.execute("UPDATE payments SET status = 'failed' WHERE id = ?", [id]);
                    payment.status = 'failed';
                }
            } catch (_) { }
        }

        res.json({
            status: payment.status,
            receipt: payment.transaction_reference
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not check payment status.' });
    }
}


async function getMyPayments(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT pm.*,
             'RCP-' || printf('%06d', pm.id) AS receipt_number,
             b.start_date, p.title AS property_title, p.city,
             u.full_name AS verified_by_name
             FROM payments pm
             JOIN bookings b ON b.id = pm.booking_id
             JOIN properties p ON p.id = b.property_id
             LEFT JOIN users u ON u.id = pm.verified_by
             WHERE pm.tenant_id = ? ORDER BY pm.created_at DESC`,
            [req.user.id]
        );
        res.json({ payments: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch payment history.' });
    }
}


async function getLandlordPayments(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT pm.*,
             'RCP-' || printf('%06d', pm.id) AS receipt_number,
             p.title AS property_title, p.city,
             t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone
             FROM payments pm
             JOIN bookings b ON b.id = pm.booking_id
             JOIN properties p ON p.id = b.property_id
             JOIN users t ON t.id = pm.tenant_id
             WHERE pm.landlord_id = ? ORDER BY pm.created_at DESC`,
            [req.user.id]
        );
        res.json({ payments: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch payments.' });
    }
}


async function verifyPayment(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['verified', 'failed'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "verified" or "failed".' });
        }
        const [rows] = await db.execute('SELECT * FROM payments WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });
        if (rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Payment has already been processed.' });
        }

        await db.execute(
            "UPDATE payments SET status = ?, verified_by = ?, verified_at = datetime('now') WHERE id = ?",
            [status, req.user.id, id]
        );
        if (status === 'verified') {
            await db.execute('UPDATE bookings SET is_paid = 1 WHERE id = ?', [rows[0].booking_id]);
        }

        await notify(rows[0].tenant_id, 'payment_verified',
            status === 'verified' ? 'Payment Verified' : 'Payment Rejected',
            status === 'verified'
                ? `Your payment of KES ${parseFloat(rows[0].amount).toLocaleString()} has been verified.`
                : `Your payment of KES ${parseFloat(rows[0].amount).toLocaleString()} could not be verified. Please contact admin.`,
            id, 'payment'
        );

        res.json({ message: `Payment marked as ${status}.` });
    } catch (err) {
        console.error('[Payment] Verify error:', err.message);
        res.status(500).json({ error: 'Could not update payment status.' });
    }
}


async function getReceipt(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT pm.*,
             'RCP-' || printf('%06d', pm.id) AS receipt_number,
             p.title AS property_title, p.address, p.city,
             t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone,
             l.full_name AS landlord_name, l.email AS landlord_email, l.phone AS landlord_phone
             FROM payments pm
             JOIN bookings b ON b.id = pm.booking_id
             JOIN properties p ON p.id = b.property_id
             JOIN users t ON t.id = pm.tenant_id
             JOIN users l ON l.id = pm.landlord_id
             WHERE pm.id = ?`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });
        const payment = rows[0];

        if (req.user.role === 'tenant' && payment.tenant_id !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
        if (req.user.role === 'landlord' && payment.landlord_id !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

        res.json({ receipt: payment });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve receipt.' });
    }
}

module.exports = {
    submitPayment, payheroCallback, getPaymentStatus,
    getMyPayments, getLandlordPayments, verifyPayment, getReceipt
};
