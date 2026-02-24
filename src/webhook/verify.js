import crypto from 'crypto';
import config from '../config/index.js';

export const verifyHMAC = (payload, signature, secret = config.whatsapp.appSecret) => {
    if (!signature || !payload) return false;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    const signatureHash = signature.replace('sha256=', '');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signatureHash)
        );
    } catch (err) {
        return false;
    }
};
