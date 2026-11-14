import { ZerocostSDK } from '@zerocost/sdk';

// DiffPush — Zerocost (zero-cost ad + consent) SDK.
// Text/inline placements only; rendered in our own slots so nothing pops over
// the editor or interrupts an AI coach session.
export const zc = new ZerocostSDK({
  appId: '68c7dcb4-874a-42a3-935f-c9017e7bc912',
  apiKey: 'zc_test_5518c5c996144be0afc3ad87',
  appName: 'DiffPush',
  environment: 'development',
  debug: true,
  // No LLM data selling; ads never attach to the AI coach route.
  consent: {
    showSettingsButton: false,
  },
  ads: {
    // Manual placement only — auto-inject is never called.
    enabled: true,
    placements: [],
    roleTargeting: {
      enabled: false, // everyone is free tier
      allowedRoles: ['free', 'basic'],
    },
  },
});

zc.identify('guest', { role: 'free' });

zc.init().catch(console.error);
