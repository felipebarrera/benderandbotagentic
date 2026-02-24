import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDashboardMetrics, getActivity, getRealtime } from '../services/metrics.js';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

dashboardRouter.get('/dashboard/metrics', async (req, res) => {
    const { periodo = 'hoy' } = req.query;
    const metrics = await getDashboardMetrics(req.tenantId, periodo);
    res.json(metrics);
});

dashboardRouter.get('/dashboard/activity', async (req, res) => {
    const activity = await getActivity(req.tenantId);
    res.json(activity);
});

dashboardRouter.get('/dashboard/realtime', async (req, res) => {
    const realtime = await getRealtime(req.tenantId);
    res.json(realtime);
});
