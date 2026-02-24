import { Router } from 'express';
import express from 'express';
import { Queue } from 'bullmq';
import { verifyHMAC } from './verify.js';
import config from '../config/index.js';
import { resolveTenant } from '../middleware/tenant.js';
import { webhookLimiter } from '../middleware/rateLimit.js';

export const webhookRouter = Router();

const messageQueue = new Queue('message-processing', {
    connection: { url: config.redis.url }
});

webhookRouter.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

const rawBodySaver = (req, res, buf, encoding) => {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
    }
};

webhookRouter.post(
    '/whatsapp',
    webhookLimiter,
    express.json({ verify: rawBodySaver }),
    (req, res, next) => {
        const signature = req.headers['x-hub-signature-256'];
        if (!verifyHMAC(req.rawBody, signature, config.whatsapp.appSecret)) {
            if (process.env.NODE_ENV === 'production' || signature) {
                return res.sendStatus(403);
            }
        }
        next();
    },
    resolveTenant,
    async (req, res) => {
        res.sendStatus(200);

        const body = req.body;
        if (body.object === 'whatsapp_business_account') {
            await messageQueue.add('process-webhook', {
                payload: body,
                tenant: req.tenant
            }, {
                removeOnComplete: true,
                removeOnFail: 100
            });
        }
    }
);
