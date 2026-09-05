import { runCampaignProof } from '../src/campaign.js';

const report = runCampaignProof({ campaignId: 'floorborn-v07-campaign' });

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.7 multi-session campaign',
  status: report.status,
  sessions: report.sessions,
  metrics: report.metrics,
  causalLinks: report.causalLinks,
}, null, 2));
