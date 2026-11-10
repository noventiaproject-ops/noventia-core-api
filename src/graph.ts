/**
 * The funding graph (1.22.0): who first funded which wallet, as nodes and edges a diagram can draw.
 * An edge is a wallet's first incoming SOL transfer, with the transaction behind it. It states a
 * fact, "this wallet's first SOL came from that address at that time", and nothing about why.
 *
 * Two views. A project sees the full graph of its own list: addresses and transactions
 * (`GET /v1/projects/{projectId}/lists/{listId}/graph`, the project's session). Anyone sees the
 * graph of a token's largest holders as aggregates with short addresses only and no transaction
 * (`GET /v1/graph/token/{mint}`, no key).
 */
import type { EvidenceLevel, ListLabelCode } from './projects.js';
import type { ResponseMeta, SolanaTxProof } from './types.js';

/**
 * `source`: a wallet that first funded at least one wallet of the set. `funded`: a wallet of the
 * set whose first SOL came from a source that also funded another wallet of the set. `independent`:
 * a wallet of the set that shares its first funder with no other wallet of the set, was funded by
 * infrastructure, or has no funding found. `infrastructure`: an exchange wallet, a launchpad or a
 * program account: it funds many unrelated people, so sharing it links nobody.
 */
export type GraphRole = 'source' | 'funded' | 'independent' | 'infrastructure';

/** An amount with its unit: the raw integer, the decimals, the symbol, and the value with the decimals applied. */
export interface AmountView {
  readonly raw: string;
  readonly decimals: number;
  readonly symbol: string;
  /** `raw` with the decimals applied, as a decimal string, for example "0.25". */
  readonly value: string;
}

/** What is known about the times around the set; null when not known. ISO 8601, UTC. */
export interface GraphEvents {
  /** When the list was checked: the snapshot the labels describe. */
  readonly snapshotAt: string | null;
  /** When the claim opened: the start of the distribution linked to the list. */
  readonly claimAt: string | null;
  /** The first sale after the claim, once a report measured it. */
  readonly firstSellAt: string | null;
}

export interface GraphInfrastructure {
  /** `bridge` since 1.23.0. */
  readonly kind: 'exchange' | 'launchpad' | 'bridge' | 'program';
  /** The exchange's, launchpad's or bridge's name from the sourced list; null for a program account. */
  readonly name: string | null;
}

/** A node of a project's own list graph: with the address. */
export interface FundingNode {
  /** Stable inside one answer: `n1`, `n2`, … */
  readonly id: string;
  readonly address: string;
  /** First four and last four characters. */
  readonly short: string;
  readonly role: GraphRole;
  /** True for a wallet of the list; false for a funder outside it. */
  readonly inList: boolean;
  /** Wallets of the list this node first funded. */
  readonly fundedCount: number;
  readonly infrastructure?: GraphInfrastructure;
  /** 1.24.0, a wallet of the list: its labels now, lifted ones left out. Absent before the list is done. */
  readonly labels?: readonly NodeLabel[];
  /** 1.24.0, a source that is the funder of a cluster of this list: the cluster and how much stands behind it. */
  readonly clusterId?: string;
  readonly evidence?: EvidenceLevel;
}

/** A label of a wallet node: the code, and for a cluster label how much stands behind it. */
export interface NodeLabel {
  readonly code: ListLabelCode;
  readonly evidence?: EvidenceLevel;
}

/**
 * 1.24.0: wallets outside the list that a cluster's source sent SOL to inside the cluster's window.
 * No address: each is one transfer with its transaction. Whether a transfer was that wallet's first
 * SOL is not read.
 */
export interface OutsideListView {
  /** The source's node id. */
  readonly source: string;
  readonly clusterId: string;
  readonly count: number;
  /** `checked`: the whole window was read. `partial`: the count is a lower bound. `not_read`: nothing is known. */
  readonly read: 'checked' | 'partial' | 'not_read';
  readonly edges: readonly { readonly amount: AmountView; readonly proof: SolanaTxProof; readonly at: string }[];
}

/** An edge of a project's own list graph: the first incoming SOL transfer, with its transaction. */
export interface FundingEdge {
  readonly from: string;
  readonly to: string;
  readonly amount: AmountView;
  readonly proof: SolanaTxProof;
  /** Block time, ISO 8601, UTC. */
  readonly at: string;
}

/** GET /v1/projects/{projectId}/lists/{listId}/graph (members). */
export interface ListFundingGraphResponse {
  readonly meta: ResponseMeta;
  readonly listId: string;
  readonly nodes: readonly FundingNode[];
  readonly edges: readonly FundingEdge[];
  readonly events: GraphEvents;
  /** Wallets of the list, those with a first funding found, and those whose history is not read far enough to know it. */
  readonly coverage: { readonly wallets: number; readonly withFunding: number; readonly withoutFunding: number };
  /** 1.24.0: one entry per cluster of the list. */
  readonly outsideList?: readonly OutsideListView[];
  readonly infrastructureVersion: string;
}

/** A node of the public token view: no address, the short form only. */
export interface PublicFundingNode {
  readonly id: string;
  readonly short: string;
  readonly role: GraphRole;
  /** For a holder: its share of the supply, percent with two decimals. */
  readonly sharePct?: number;
  readonly fundedCount: number;
  readonly infrastructure?: GraphInfrastructure;
}

/** An edge of the public token view: amount and time, no transaction. */
export interface PublicFundingEdge {
  readonly from: string;
  readonly to: string;
  readonly amount: AmountView;
  readonly at: string;
}

/** Holders whose first SOL came from one source: an aggregate. */
export interface SharedSourceView {
  /** The source's node id. */
  readonly source: string;
  readonly holders: number;
  /** Their combined share of the supply, percent with two decimals. */
  readonly sharePct: number;
  /** The first and the last of those fundings. */
  readonly window: { readonly from: string; readonly to: string };
}

/**
 * GET /v1/graph/token/{mint} (no key): the first funding of the token's largest holder wallets
 * (pools, exchanges and programs are left out of the holders, as in the token check). Aggregates
 * and short addresses only.
 */
export interface TokenFundingGraphResponse {
  readonly meta: ResponseMeta;
  readonly mint: string;
  /** `not_available` when the source could not list the largest accounts (a very large mint): the graph is empty and says nothing. */
  readonly holdersRead: 'checked' | 'not_available';
  readonly nodes: readonly PublicFundingNode[];
  readonly edges: readonly PublicFundingEdge[];
  readonly aggregates: {
    readonly holders: number;
    readonly withFunding: number;
    readonly fundedByInfrastructure: number;
    readonly independent: number;
    readonly sharedSources: readonly SharedSourceView[];
  };
  readonly events: GraphEvents;
  readonly infrastructureVersion: string;
}
