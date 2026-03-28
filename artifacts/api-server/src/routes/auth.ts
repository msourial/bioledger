import { Router } from 'express';

const router = Router();

const WHOOP_AUTHORIZE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_CLIENT_ID = process.env['WHOOP_CLIENT_ID'];

/**
 * GET /api/auth/whoop
 * Initiates the Whoop OAuth2 PKCE flow.
 * If WHOOP_CLIENT_ID is not set, returns demo-mode instructions.
 */
router.get('/auth/whoop', (req, res) => {
  if (!WHOOP_CLIENT_ID) {
    res.json({
      mode: 'demo',
      message: 'No Whoop credentials configured — Demo Mode activated.',
      demoData: {
        source: 'WHOOP API V2 (Demo)',
        version: '2.0',
        userId: 'demo-sovereign-user-2026',
        recovery: {
          hrv: 72,
          restingHr: 54,
          sleepPerformance: 88,
          recoveryScore: 84,
        },
        strain: {
          current: 12.4,
          maxHr: 178,
          kilojoules: 2340,
        },
        respiratory: {
          rate: 14.2,
          spo2: 97.8,
        },
        cycle: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: null,
          timezone: 'UTC',
        },
      },
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    response_type: 'code',
    scope: 'read:recovery read:cycles read:workout read:sleep read:profile offline',
    redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/whoop/callback`,
    state: crypto.randomUUID(),
  });

  res.json({
    mode: 'oauth',
    authUrl: `${WHOOP_AUTHORIZE_URL}?${params.toString()}`,
  });
});

/**
 * GET /api/auth/whoop/callback
 * Handles the OAuth2 callback from Whoop. Exchanges code for token.
 * Stub implementation — returns demo data.
 */
router.get('/auth/whoop/callback', (req, res) => {
  const { code, error } = req.query;

  if (error) {
    res.status(400).json({ error: String(error), mode: 'demo' });
    return;
  }

  res.json({
    mode: 'demo',
    code: code ?? null,
    message: 'OAuth2 exchange stub — using Demo Mode data',
    connected: true,
  });
});

export default router;
