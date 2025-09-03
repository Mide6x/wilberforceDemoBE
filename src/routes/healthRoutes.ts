import { Router } from 'express';

const router = Router();

// Health check endpoint for server warm-up
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
