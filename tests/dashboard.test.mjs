import test from 'node:test';
import assert from 'node:assert/strict';
import { GovernanceDashboardStore } from '../dist/index.js';

test('Governance Dashboard: Voting Gauge Calculation', () => {
  const store = new GovernanceDashboardStore();
  const quorum = 400_000n * 10n ** 18n;

  store.addProposal({
    id: 'prop-1',
    proposer: '0x1111111111111111111111111111111111111111',
    description: 'Grant Treasury',
    startBlock: 10,
    endBlock: 20,
    forVotes: 300_000n * 10n ** 18n,
    againstVotes: 100_000n * 10n ** 18n,
    abstainVotes: 0n,
    eta: 0,
    status: 'Active'
  });

  const gauge = store.getVotingGauge('prop-1', quorum);
  assert.equal(gauge.proposalId, 'prop-1');
  assert.equal(gauge.totalTurnout, 400_000n * 10n ** 18n);
  assert.equal(gauge.quorumMet, false); // 300k < 400k
});

test('Governance Dashboard: Voting Gauge Quorum Met & Percentages', () => {
  const store = new GovernanceDashboardStore();
  const quorum = 400_000n * 10n ** 18n;

  store.addProposal({
    id: 'prop-2',
    proposer: '0x1111111111111111111111111111111111111111',
    description: 'Protocol Upgrade',
    startBlock: 10,
    endBlock: 20,
    forVotes: 750_000n * 10n ** 18n,
    againstVotes: 250_000n * 10n ** 18n,
    abstainVotes: 0n,
    eta: 0,
    status: 'Active'
  });

  const gauge = store.getVotingGauge('prop-2', quorum);
  assert.equal(gauge.totalTurnout, 1_000_000n * 10n ** 18n);
  assert.equal(gauge.quorumMet, true);
  assert.equal(gauge.forPercentage, 75);
  assert.equal(gauge.againstPercentage, 25);
  assert.equal(gauge.abstainPercentage, 0);
  assert.ok(Object.isFrozen(gauge));
});

test('Governance Dashboard: Timelock Radar', () => {
  const store = new GovernanceDashboardStore();
  const now = 1_000_000;
  const eta1 = now + 5000; // Locked
  const eta2 = now - 5000; // Ready

  store.addProposal({
    id: 'prop-locked',
    proposer: '0x1111',
    description: 'Queued proposal 1',
    startBlock: 10,
    endBlock: 20,
    forVotes: 500_000n * 10n ** 18n,
    againstVotes: 0n,
    abstainVotes: 0n,
    eta: eta1,
    status: 'Queued'
  });

  store.addProposal({
    id: 'prop-ready',
    proposer: '0x2222',
    description: 'Queued proposal 2',
    startBlock: 10,
    endBlock: 20,
    forVotes: 500_000n * 10n ** 18n,
    againstVotes: 0n,
    abstainVotes: 0n,
    eta: eta2,
    status: 'Queued'
  });

  const radar = store.getTimelockRadar(now);
  assert.equal(radar.length, 2);

  const locked = radar.find(r => r.proposalId === 'prop-locked');
  assert.equal(locked?.status, 'LOCKED');
  assert.equal(locked?.timeRemainingSeconds, 5000);

  const ready = radar.find(r => r.proposalId === 'prop-ready');
  assert.equal(ready?.status, 'READY');
  assert.equal(ready?.timeRemainingSeconds, 0);
  assert.ok(Object.isFrozen(radar));
});

test('Governance Dashboard: Telemetry Summary & Guardian Tracking', () => {
  const store = new GovernanceDashboardStore();

  store.setGuardianStatus({
    paused: true,
    pausedAt: 1000,
    vetoCount: 2,
    recentVetoReason: 'Compromised bytecode payload'
  });

  store.addProposal({
    id: 'prop-a',
    proposer: '0x1',
    description: 'A',
    startBlock: 1,
    endBlock: 10,
    forVotes: 0n,
    againstVotes: 0n,
    abstainVotes: 0n,
    eta: 0,
    status: 'Active'
  });

  store.addProposal({
    id: 'prop-b',
    proposer: '0x2',
    description: 'B',
    startBlock: 1,
    endBlock: 10,
    forVotes: 0n,
    againstVotes: 0n,
    abstainVotes: 0n,
    eta: 2000,
    status: 'Queued'
  });

  const summary = store.getTelemetrySummary(1500);
  assert.equal(summary.totalProposals, 2);
  assert.equal(summary.activeProposals, 1);
  assert.equal(summary.queuedProposals, 1);
  assert.equal(summary.guardian.paused, true);
  assert.equal(summary.guardian.vetoCount, 2);
  assert.equal(summary.guardian.recentVetoReason, 'Compromised bytecode payload');
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.guardian));
});
