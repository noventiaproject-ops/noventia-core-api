/**
 * The public check API (1.34.0; docs/PUBLIC_API.md): what a wallet, a DEX or an AI agent asks before a
 * transaction is signed. Base path `/v1/public`, a partner key in `Authorization: Bearer`. One envelope for
 * every call: facts and warnings with stable codes, levels and proofs, the rule versions, and what was not
 * read. Never "safe" or "unsafe", no score, no word about intent.
 */

import type { AutomationFlag, CreatorCard, FactView, IssuerPowerView, OfficialAssetView, Proof, ResponseMeta } from './types.js';

/** `held`: answered from what the core holds, no credit spent; `read`: read from the chain now; `stale`: held and older than usual, because today's credits for new reads are spent. */
export type PublicCache = 'held' | 'read' | 'stale';

export interface PublicMeta {
  readonly apiVersion: 1;
  /** ISO 8601, UTC: the facts are read up to this moment. */
  readonly asOf: string;
  /** The versions of the rules that made the answer. */
  readonly rules: { readonly tokenCheck: number; readonly thresholds: number; readonly officialList: number | string; readonly recognized: string };
  readonly cache: PublicCache;
  /** Helius credits this call spent from the partner share. */
  readonly credits: number;
}

/** A warning: a stable code, a level, the facts and proofs it rests on, and English text with its message code. */
export interface PublicWarning {
  /** Stable. New codes are added; a client passes over a code it does not know. */
  readonly code: string;
  /** 1 a note; 2 a power or a cost the holder should know; 3 a record of harm with its transactions. */
  /** Named as in every other answer of the API: a warning's level, never a level of a person or a branch. */
  readonly warningLevel: 1 | 2 | 3;
  readonly about: 'token' | 'creator' | 'wallet' | 'transaction';
  readonly factIds: readonly string[];
  readonly proofs: readonly Proof[];
  /** `warning.<code>` in the message catalog, for a client that shows its own words. */
  readonly messageCode: string;
  readonly text: string;
}

/** Something the answer does not rest on, and why: a warning's absence is never a statement about it. */
export interface PublicNotRead {
  /** `age`, `creator`, `creator_history`, `holders`. */
  readonly what: string;
  /** `depth` (not asked for), `not_proven`, `in_part`, `daily_cap`, `large_wallet`, `request_budget`, `largest_accounts_unavailable`. */
  readonly reason: string;
}

/** GET /v1/public/token/{mint}?depth=mint|full */
export interface PublicTokenResponse {
  readonly meta: PublicMeta;
  readonly subject: { readonly kind: 'token'; readonly address: string };
  /**
   * `mint`: the mint account, its metadata and the top holders, read now or held for at most 10 minutes; the
   * token's age and the creator's record only when the core already holds a full answer. `full`: the same plus
   * the first transaction and the creator's history.
   */
  readonly depth: 'mint' | 'full';
  /** Token facts, each with its proofs: the mint state with its Token-2022 extensions, name and ticker (escaped), holder concentration, the first transaction, the launch. */
  readonly facts: readonly FactView[];
  readonly warnings: readonly PublicWarning[];
  /** On a listed asset's own mint: what its issuer can do, as facts with text and message code, never as warnings. */
  readonly issuerPowers: readonly IssuerPowerView[];
  readonly official: OfficialAssetView | null;
  /** The wallet that signed the launch and its record, when read. */
  readonly creator: { readonly address: string | null; readonly card: CreatorCard | null };
  readonly notRead: readonly PublicNotRead[];
  /** The highest level among `warnings`, 0 when there are none: a maximum over stated facts, for filtering. It is no score. */
  readonly highestWarning: 0 | 1 | 2 | 3;
}

/**
 * GET /v1/public/wallet/{address} (1.35.0): public chain facts about an address. Never in it: a Noventia
 * passport, EP, a level of a person, a Noventia ID, linked accounts, a freeze, a label from a project's list, or
 * whether the address belongs to a Noventia user. An address in a private list reads here as any other.
 */
export interface PublicWalletResponse {
  readonly meta: PublicMeta;
  readonly subject: { readonly kind: 'wallet'; readonly address: string };
  /**
   * What the address is: `wallet` (its history is read); `recognized` (an exchange, a launchpad, a bridge or a
   * named program from GET /v1/recognized: named, nothing read); `other` (a program, a token account or another
   * account that is no wallet: nothing read).
   */
  readonly account: { readonly kind: 'wallet' | 'recognized' | 'other'; readonly recognized: { readonly list: 'exchange' | 'launchpad' | 'bridge' | 'program'; readonly name: string; readonly source: string } | null };
  /** The wallet's first transaction, with its proof; empty when none was read. */
  readonly facts: readonly FactView[];
  /** Days since the first transaction; null when it was not read. */
  readonly ageDays: number | null;
  /** Tokens the wallet launched and what happened on their first days, each number with its transactions. Null when nothing was read. */
  readonly created: CreatorCard | null;
  /** Set when the wallet's swaps look automated, with the measurements behind it; a fact, with no word about intent. */
  readonly automation: AutomationFlag | null;
  readonly warnings: readonly PublicWarning[];
  readonly notRead: readonly PublicNotRead[];
  readonly highestWarning: 0 | 1 | 2 | 3;
}

/** POST /v1/public/transaction (1.36.0, beta): a transaction to check before it is signed. It is simulated, never sent, never stored, never logged. */
export interface PublicTransactionRequest {
  /** The transaction in base64, signed or unsigned, at most 1,232 bytes. */
  readonly transaction: string;
  /** One of the transaction's signers: the wallet the answer is about. */
  readonly signer: string;
}

/**
 * What the transaction would do to its signer at this moment. A simulation is no promise: the chain can differ a
 * second later, and a program can behave differently on the real run. The answer never says a transaction is safe.
 */
export interface PublicTransactionResponse {
  readonly meta: PublicMeta;
  readonly subject: { readonly kind: 'transaction'; readonly signer: string };
  /** The call is in beta: fields can be added. */
  readonly beta: true;
  /** `error`: the simulation's error in plain parts, for example `err:InstructionError:2:Custom:6001`; null when it ran. */
  readonly simulation: { readonly status: 'ok' | 'failed'; readonly error: string | null; readonly unitsConsumed: number | null; readonly feeLamports: string | null };
  /** The signer's balances before and after, raw integers as decimal strings. `tokens` lists only the mints whose total changes. */
  readonly changes: {
    readonly sol: { readonly before: string; readonly after: string } | null;
    readonly tokens: readonly { readonly mint: string; readonly decimals: number | null; readonly before: string; readonly after: string }[];
    readonly accountsOpened: number;
    readonly accountsClosed: number;
  };
  /** Every program the transaction calls. `listed` with its name when it is one of Solana's own or in the recognized lists; `inner` when it is only called by another program. */
  readonly programs: readonly { readonly address: string; readonly listed: boolean; readonly name: string | null; readonly inner: boolean }[];
  /** Powers the transaction hands to someone else over the signer's accounts. */
  readonly grants: readonly { readonly kind: 'delegate' | 'owner_changed' | 'close_authority_changed' | 'account_assigned'; readonly account: string; readonly to: string | null; readonly amountRaw: string | null }[];
  /** For each mint the signer would hold more of (at most 3): the token check at depth "mint". */
  readonly tokens: readonly { readonly mint: string; readonly highestWarning: 0 | 1 | 2 | 3; readonly warnings: readonly PublicWarning[]; readonly notRead: readonly PublicNotRead[] }[];
  /** Codes `tx.*`. The proof of each is the account it is about, at the slot the simulation ran on. */
  readonly warnings: readonly PublicWarning[];
  readonly notRead: readonly PublicNotRead[];
  readonly highestWarning: 0 | 1 | 2 | 3;
}

/** GET /v1/public/meta: what a client reads once at start. Spends no credit. */
export interface PublicMetaResponse {
  readonly meta: PublicMeta;
  /** Every warning code a token answer can carry, with English text. `severity` is the `warningLevel` a warning with this code carries; it has another name here because this is the list of codes, with no proof to show. */
  readonly warningCodes: readonly { readonly code: string; readonly severity: 1 | 2 | 3; readonly about: 'token' | 'creator' | 'wallet' | 'transaction'; readonly messageCode: string; readonly text: string }[];
  readonly factKinds: readonly string[];
  /** The calling key: its plan, its limits, and what it used today (UTC). */
  readonly key: {
    readonly name: string;
    readonly plan: string;
    readonly limits: { readonly requestsPerMinute: number; readonly creditsPerDay: number; readonly transactionChecksPerDay: number };
    readonly today: { readonly calls: number; readonly credits: number };
  };
}

/** A partner as the owner's calls answer it. The key is never in it. */
export interface PartnerView {
  readonly partnerId: string;
  readonly name: string;
  readonly contactEmail: string;
  readonly plan: string;
  readonly limits: { readonly requestsPerMinute: number; readonly creditsPerDay: number; readonly transactionChecksPerDay: number };
  readonly status: 'active' | 'stopped';
  /** ISO 8601, UTC. */
  readonly createdAt: string;
  readonly stoppedAt: string | null;
  readonly today: { readonly calls: number; readonly credits: number };
}

/** POST /v1/owner/partners (owner key): the new partner and its key, shown this once and never again. */
export interface OwnerPartnerCreatedResponse {
  readonly meta: ResponseMeta;
  readonly partner: PartnerView;
  readonly key: string;
}

/** GET /v1/owner/partners (owner key): every partner with today's use, and the partner share of the day's credits. */
export interface OwnerPartnersResponse {
  readonly meta: ResponseMeta;
  readonly partners: readonly PartnerView[];
  readonly share: { readonly spent: number; readonly cap: number };
}
