import { InsurancePolicy } from '../domain/types';
import { config } from '../config';

export type CoverageStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Stand-in for the insurers' eligibility API.
// Member ids starting with TMO simulate a hanging provider, EXP an inactive policy.
async function callProvider(policy: InsurancePolicy): Promise<CoverageStatus> {
  if (policy.memberId.startsWith('TMO')) {
    await sleep(config.insuranceTimeoutMs + 2000);
    return 'ACTIVE';
  }
  await sleep(150 + Math.random() * 200);
  if (policy.memberId.startsWith('EXP')) return 'INACTIVE';
  return 'ACTIVE';
}

export async function verifyCoverage(policy: InsurancePolicy): Promise<CoverageStatus> {
  const timeout = sleep(config.insuranceTimeoutMs).then(() => 'UNKNOWN' as const);
  try {
    return await Promise.race([callProvider(policy), timeout]);
  } catch (e) {
    console.warn('[insurance] provider error', e);
    return 'UNKNOWN';
  }
}
