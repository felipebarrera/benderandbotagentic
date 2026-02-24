import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

import { authRouter } from './auth.js';
import { conversationsRouter } from './conversations.js';
import { agentsRouter } from './agents.js';
import { tenantsRouter } from './tenants.js';
import { dashboardRouter } from './dashboard.js';
import { queueRouter } from './queue.js';
import { handoverRouter } from './handover.js';
import { telegramWebhookRouter } from './telegram-webhook.js';

export const apiRouter = Router();

// Public routes (no auth)
apiRouter.use(authRouter);
apiRouter.use(telegramWebhookRouter);

// Protected routes
apiRouter.use(conversationsRouter);
apiRouter.use(agentsRouter);
apiRouter.use(tenantsRouter);
apiRouter.use(dashboardRouter);
apiRouter.use(queueRouter);
apiRouter.use(handoverRouter);

export default apiRouter;
