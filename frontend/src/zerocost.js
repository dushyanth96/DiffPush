import { ZerocostSDK } from '@zerocost/sdk';

// DiffPush — Zerocost (zero-cost ad + consent) SDK.
// Text/inline placements only; the SDK renders within our theme and never
// interrupts a focus session (no sticky bars, no modals over the editor).
export const zc = new ZerocostSDK({
  appId: '68c7dcb4-874a-42a3-935f-c9017e7bc912',
  // TODO: replace with the real key from https://zerocost.app/
  apiKey: 'zc_live_YOUR_KEY_HERE',
  appName: 'DiffPush',
  debug: true,
  llm: {
    // AI coach lives in the solve workspace; anonymized LLM-data selling
    // (opt-in) is scoped to that route.
    llmPath: '/solve',
  },
  consent: {
    showSettingsButton: true,
  },
  ads: {
    roleTargeting: {
      enabled: false,
      allowedRoles: ['free', 'basic'],
    },
  },
});

// Optional identity hook — flip roleTargeting.enabled to true to use it.
zc.identify('user_123', { role: 'free' });

zc.init().catch(console.error);
