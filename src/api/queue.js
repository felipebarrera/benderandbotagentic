import { Router } from 'express';
import { getQueueStats } from '../queue/index.js';

export const queueRouter = Router();

queueRouter.get('/queue/stats', async (req, res) => {
    try {
        const stats = await getQueueStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get queue stats' });
    }
});
