export interface DashboardProposal {
  readonly id: string;
  readonly proposer: string;
  readonly description: string;
  readonly startBlock: number;
  readonly endBlock: number;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  eta: number;
  status: 'Pending' | 'Active' | 'Defeated' | 'Succeeded' | 'Queued' | 'Executed' | 'Canceled' | 'Vetoed' | 'Expired';
}

export interface VotingGaugeData {
  readonly proposalId: string;
  readonly forVotes: bigint;
  readonly againstVotes: bigint;
  readonly abstainVotes: bigint;
  readonly totalTurnout: bigint;
  readonly quorumRequired: bigint;
  readonly quorumMet: boolean;
  readonly forPercentage: number;
  readonly againstPercentage: number;
  readonly abstainPercentage: number;
}

export interface TimelockRadarData {
  readonly proposalId: string;
  readonly eta: number;
  readonly status: 'LOCKED' | 'READY' | 'EXPIRED';
  readonly timeRemainingSeconds: number;
  readonly timeUntilExpirySeconds: number;
}

export interface GuardianStatusData {
  readonly paused: boolean;
  readonly pausedAt: number;
  readonly vetoCount: number;
  readonly recentVetoReason?: string;
}

export interface DashboardTelemetrySummary {
  readonly totalProposals: number;
  readonly activeProposals: number;
  readonly queuedProposals: number;
  readonly executedProposals: number;
  readonly vetoedProposals: number;
  readonly guardian: GuardianStatusData;
  readonly timestamp: number;
}

export class GovernanceDashboardStore {
  private readonly proposals: Map<string, DashboardProposal> = new Map();
  private guardianStatus: GuardianStatusData = {
    paused: false,
    pausedAt: 0,
    vetoCount: 0
  };

  public addProposal(p: DashboardProposal): void {
    this.proposals.set(p.id, {
      ...p,
      forVotes: p.forVotes ?? 0n,
      againstVotes: p.againstVotes ?? 0n,
      abstainVotes: p.abstainVotes ?? 0n,
      eta: p.eta ?? 0
    });
  }

  public updateVotes(proposalId: string, forVotes: bigint, againstVotes: bigint, abstainVotes: bigint): void {
    const p = this.proposals.get(proposalId);
    if (!p) throw new Error('PROPOSAL_NOT_FOUND');
    p.forVotes = forVotes;
    p.againstVotes = againstVotes;
    p.abstainVotes = abstainVotes;
  }

  public updateTimelock(proposalId: string, eta: number, status?: DashboardProposal['status']): void {
    const p = this.proposals.get(proposalId);
    if (!p) throw new Error('PROPOSAL_NOT_FOUND');
    p.eta = eta;
    if (status) p.status = status;
  }

  public setGuardianStatus(status: Partial<GuardianStatusData>): void {
    this.guardianStatus = {
      ...this.guardianStatus,
      ...status
    };
  }

  public getVotingGauge(proposalId: string, quorum: bigint): Readonly<VotingGaugeData> {
    const p = this.proposals.get(proposalId);
    if (!p) throw new Error('PROPOSAL_NOT_FOUND');

    const totalTurnout = p.forVotes + p.againstVotes + p.abstainVotes;
    const quorumMet = p.forVotes + p.abstainVotes >= quorum;

    let forPercentage = 0;
    let againstPercentage = 0;
    let abstainPercentage = 0;

    if (totalTurnout > 0n) {
      forPercentage = Number((p.forVotes * 10000n) / totalTurnout) / 100;
      againstPercentage = Number((p.againstVotes * 10000n) / totalTurnout) / 100;
      abstainPercentage = Number((p.abstainVotes * 10000n) / totalTurnout) / 100;
    }

    return Object.freeze({
      proposalId,
      forVotes: p.forVotes,
      againstVotes: p.againstVotes,
      abstainVotes: p.abstainVotes,
      totalTurnout,
      quorumRequired: quorum,
      quorumMet,
      forPercentage,
      againstPercentage,
      abstainPercentage
    });
  }

  public getTimelockRadar(currentTime: number, gracePeriod: number = 14 * 86400): readonly Readonly<TimelockRadarData>[] {
    const results: TimelockRadarData[] = [];

    for (const p of this.proposals.values()) {
      if (p.eta > 0 && p.status === 'Queued') {
        const expiry = p.eta + gracePeriod;
        let radarStatus: 'LOCKED' | 'READY' | 'EXPIRED';
        let timeRemaining = 0;
        let timeUntilExpiry = 0;

        if (currentTime < p.eta) {
          radarStatus = 'LOCKED';
          timeRemaining = p.eta - currentTime;
          timeUntilExpiry = expiry - currentTime;
        } else if (currentTime > expiry) {
          radarStatus = 'EXPIRED';
        } else {
          radarStatus = 'READY';
          timeUntilExpiry = expiry - currentTime;
        }

        results.push(
          Object.freeze({
            proposalId: p.id,
            eta: p.eta,
            status: radarStatus,
            timeRemainingSeconds: timeRemaining,
            timeUntilExpirySeconds: timeUntilExpiry
          })
        );
      }
    }

    return Object.freeze(results);
  }

  public getTelemetrySummary(currentTime: number): Readonly<DashboardTelemetrySummary> {
    let active = 0;
    let queued = 0;
    let executed = 0;
    let vetoed = 0;

    for (const p of this.proposals.values()) {
      if (p.status === 'Active') active++;
      else if (p.status === 'Queued') queued++;
      else if (p.status === 'Executed') executed++;
      else if (p.status === 'Vetoed') vetoed++;
    }

    return Object.freeze({
      totalProposals: this.proposals.size,
      activeProposals: active,
      queuedProposals: queued,
      executedProposals: executed,
      vetoedProposals: vetoed,
      guardian: Object.freeze({ ...this.guardianStatus }),
      timestamp: currentTime
    });
  }
}
