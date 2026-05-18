#!/usr/bin/env node
// scripts/redteam.mjs
//
// Standalone CLI red-team runner. Hits the running server's /api/redteam
// endpoint and pretty-prints the four adversarial test outcomes.
//
// Usage:
//   AEGIS_URL=http://localhost npm run redteam

const URL = process.env.AEGIS_URL ?? 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

async function main() {
  console.log(`${colors.bold}🦞 Aegis-RiskGuard — Red Team Suite${colors.reset}`);
  console.log(`${colors.dim}Target: ${URL}${colors.reset}\n`);

  const res = await fetch(`${URL}/api/redteam`, { method: 'POST' }).then((r) => r.json());

  let pass = 0;
  for (const r of res.results) {
    const mark = r.pass ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`${colors.bold}${r.test.id} — ${r.test.name}${colors.reset}  ${mark}`);
    console.log(`  ${colors.dim}${r.test.description}${colors.reset}`);
    console.log(`  Expected:  ${r.test.expectedAction}`);
    console.log(`  Actual:    ${colors.cyan}${r.decision.action}${colors.reset}  (rule: ${r.decision.ruleIdMatched})`);
    if (r.decision.reason) console.log(`  Reason:    ${r.decision.reason}`);
    if (r.decision.detectors?.length)
      console.log(`  Detectors: ${r.decision.detectors.join(', ')}`);
    console.log();
    if (r.pass) pass++;
  }

  console.log(`${colors.bold}Result: ${pass}/${res.results.length} passed${colors.reset}`);
  process.exit(pass === res.results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(2);
});
