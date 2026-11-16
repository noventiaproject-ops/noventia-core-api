/**
 * The public check API (1.34.0; docs/PUBLIC_API.md): what a wallet, a DEX or an AI agent asks before a
 * transaction is signed. Base path `/v1/public`, a partner key in `Authorization: Bearer`. One envelope for
 * every call: facts and warnings with stable codes, levels and proofs, the rule versions, and what was not
 * read. Never "safe" or "unsafe", no score, no word about intent.
 */

import type { AutomationFlag, CreatorCardRead, CreatorHistoryView, FactView, IssuerPowerView, OfficialAssetView, Proof, ResponseMeta, TokenAssessment } from './types.js';

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
  /** 1.41.0: the numbers the text names, by the placeholder names of the catalog text. Empty when it has none. */
  readonly params?: Readonly<Record<string, number>>;
  /** The English text, built from the catalog text and `params`. */
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
  /** 1.48.0: each count of the card has its read state (ReadCount): null means not read, not zero. */
  readonly creator: { readonly address: string | null; readonly card: CreatorCardRead | null };
  readonly notRead: readonly PublicNotRead[];
  /**
   * The highest level among `warnings`, 0 when there are none: a maximum over stated facts, for filtering. It is no score.
   * 1.47.0: null while `assessment.state` is `unknown`: a part was not read (the creator's history above all), so no
   * level is given; `assessment.atLeast` is the highest found so far.
   */
  readonly highestWarning: 0 | 1 | 2 | 3 | null;
  /** 1.47.0: whether the warnings are final, what is missing, and what to show meanwhile (TokenAssessment). */
  readonly assessment: TokenAssessment;
  /**
   * 1.48.0: every part the warnings need was read. Treat `complete: false` as not checked yet. Null means not read,
   * not zero. With `complete` false, `highestWarning` is the highest real warning found when it is level 2 or 3
   * (it stands; the answer stays incomplete), else null.
   */
  readonly complete: boolean;
  /** 1.48.0: the parts not read (`creator_history`, `creator`, `holders`, `first_transaction`, `depth`). */
  readonly unread: readonly TokenAssessment['missing'][number][];
  /** 1.47.0: the creator's history behind the creator warnings. */
  readonly creatorHistory: CreatorHistoryView;
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
  readonly created: CreatorCardRead | null;
  /** Set when the wallet's swaps look automated, with the measurements behind it; a fact, with no word about intent. */
  readonly automation: AutomationFlag | null;
  readonly warnings: readonly PublicWarning[];
  readonly notRead: readonly PublicNotRead[];
  /** 1.48.0: with `complete` false, the highest real warning found when it is level 2 or 3, else null. */
  readonly highestWarning: 0 | 1 | 2 | 3 | null;
  /** 1.48.0: the wallet's whole history was read. Treat `complete: false` as not checked yet. Null means not read, not zero. */
  readonly complete: boolean;
  /** 1.48.0: `history` when the wallet's history was not read whole. */
  readonly unread: readonly 'history'[];
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
  /**
   * The signer's balances before and after, raw integers as decimal strings. `tokens` lists only the mints whose total changes.
   *
   * `sol.depositsReturned` (1.38.0): lamports of account deposits (rent) that come back to the signer because the
   * transaction closes token accounts of the signer. They are inside `after`. A returned deposit is the signer's own
   * money put down when the account was opened; it is no gain. So `after - before` is: what the transaction moves,
   * plus `depositsReturned`, plus wrapped SOL unwrapped from closed accounts, less the fee.
   *
   * `closed` (1.38.0): each closed token account of the signer. `tokenBefore`: raw tokens it holds now.
   * `lamportsBefore`: all lamports it holds now. `depositLamports`: the deposit the closing pays out, which is
   * `lamportsBefore` less the wrapped SOL the account holds when `mint` is wrapped SOL. `to`: where the closing sends
   * the lamports, null when the transaction does not say. Transfers to a closed account's address fail until it is
   * opened again; a closed account that holds tokens now carries the note `tx.token_account_closed`.
   */
  readonly changes: {
    readonly sol: { readonly before: string; readonly after: string; readonly depositsReturned?: string } | null;
    readonly tokens: readonly { readonly mint: string; readonly decimals: number | null; readonly before: string; readonly after: string }[];
    readonly accountsOpened: number;
    readonly accountsClosed: number;
    readonly closed?: readonly { readonly account: string; readonly mint: string; readonly tokenBefore: string; readonly lamportsBefore: string | null; readonly depositLamports: string | null; readonly to: string | null }[];
  };
  /** Every program the transaction calls. `listed` with its name when it is one of Solana's own or in the recognized lists; `inner` when it is only called by another program. */
  /** `namedBy` (1.37.0): `jupiter_routing` when the program's own project publishes no address and the name is Jupiter's official map from program to DEX name; null otherwise. */
  readonly programs: readonly { readonly address: string; readonly listed: boolean; readonly name: string | null; readonly inner: boolean; readonly namedBy?: 'jupiter_routing' | null }[];
  /** Powers the transaction hands to someone else over the signer's accounts. */
  readonly grants: readonly { readonly kind: 'delegate' | 'owner_changed' | 'close_authority_changed' | 'account_assigned'; readonly account: string; readonly to: string | null; readonly amountRaw: string | null }[];
  /**
   * For each mint the signer would hold more of (at most 3): the token check at depth "mint". 1.47.0: `highestWarning`
   * null and `assessment.state` `unknown` while that token's level is not known (its creator not read, or only its
   * mint read); the found warnings are then the warnings found so far.
   */
  readonly tokens: readonly { readonly mint: string; readonly highestWarning: 0 | 1 | 2 | 3 | null; readonly warnings: readonly PublicWarning[]; readonly notRead: readonly PublicNotRead[]; readonly assessment?: TokenAssessment }[];
  /** Codes `tx.*`. The proof of each is the account it is about, at the slot the simulation ran on. */
  readonly warnings: readonly PublicWarning[];
  readonly notRead: readonly PublicNotRead[];
  /** 1.47.0: null while a received token's level is not known and no level 3 warning was found (`notRead` names `received_token_level`). */
  readonly highestWarning: 0 | 1 | 2 | 3 | null;
}

/** GET /v1/public/meta: what a client reads once at start. Spends no credit. */
export interface PublicMetaResponse {
  readonly meta: PublicMeta;
  /** Every warning code a token answer can carry, with English text. `warningLevel` (named `severity` until 1.40.0) is the level a warning with this code carries. A row here is a code of the list and shows no proof, unlike a warning in an answer; this is the list of codes, with no proof to show. */
  /** 1.41.0: `text` is the sentence as the catalog holds it; where a sentence names numbers they stand as placeholders (`{pct}`, `{hours}`, `{launches}`), filled in the `text` of a warning in an answer from its `params`. */
  readonly warningCodes: readonly { readonly code: string; readonly warningLevel: 1 | 2 | 3; readonly about: 'token' | 'creator' | 'wallet' | 'transaction'; readonly messageCode: string; readonly text: string }[];
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
  /** An email, or since 1.42.0 for a partner made from an invite code: an email or a handle the partner gave, or empty. */
  readonly contactEmail: string;
  readonly plan: string;
  readonly limits: { readonly requestsPerMinute: number; readonly creditsPerDay: number; readonly transactionChecksPerDay: number };
  readonly status: 'active' | 'stopped';
  /** ISO 8601, UTC. */
  readonly createdAt: string;
  readonly stoppedAt: string | null;
  readonly today: { readonly calls: number; readonly credits: number };
}

/** 1.42.0. An invite code as the owner's calls answer it. The code is never in it. */
export interface PartnerInviteView {
  readonly inviteId: string;
  /** The owner's own label: the partner made from the code takes it as its name. */
  readonly label: string;
  readonly plan: string;
  readonly status: 'open' | 'used' | 'expired' | 'revoked';
  /** ISO 8601, UTC. */
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedAt: string | null;
  /** The partner made from it, once it is used. */
  readonly partnerId: string | null;
}

/** 1.42.0. POST /v1/owner/invites (owner key), body `{ label, days?, plan? }`: the new invite and its code, shown this once and never again. */
export interface OwnerInviteCreatedResponse {
  readonly meta: ResponseMeta;
  readonly invite: PartnerInviteView;
  readonly code: string;
}

/** 1.42.0. GET /v1/owner/invites (owner key). `POST /v1/owner/invites/{inviteId}/revoke` answers `{ meta, invite }`. */
export interface OwnerInvitesResponse {
  readonly meta: ResponseMeta;
  readonly invites: readonly PartnerInviteView[];
}

/**
 * 1.42.0. POST /v1/public/invites/activate, no key, body `{ code, contact? }` (`contact`: an email or a handle, up
 * to 200 characters, optional). Answers the new partner's key this once; the core keeps its sha256 only. A code
 * works once. A code that is unknown, used, withdrawn or past its time gets one answer: 404 `invite_not_valid`.
 * 429 `rate_limited` with `Retry-After` after 5 tries in 10 minutes or 20 in a UTC day from one address. A
 * browser may call it from https://noventia.xyz only. `Cache-Control: no-store`.
 */
export interface InviteActivatedResponse {
  readonly meta: ResponseMeta;
  readonly key: string;
  readonly partner: {
    readonly partnerId: string;
    readonly name: string;
    readonly plan: string;
    readonly limits: { readonly requestsPerMinute: number; readonly creditsPerDay: number; readonly transactionChecksPerDay: number };
  };
}

/**
 * 1.43.0. GET /v1/public/status, no key. Whether the core, the Telegram bot, the Discord bot and the app work,
 * and when each was last seen. `unknown`: not seen since the core last started. A bot is seen when it reports to
 * the core, every 15 minutes, and reads `down` when its last report is older than 35 minutes. The app's front
 * page is asked every 5 minutes. The answer is reused for 60 seconds (`Cache-Control: public, max-age=60`). A
 * browser may call it from https://noventia.xyz only. 429 `rate_limited` with `Retry-After` past 60 calls a
 * minute from one address.
 */
export interface PublicStatusResponse {
  readonly meta: ResponseMeta;
  /** When this answer was made, ISO 8601 UTC. */
  readonly checkedAt: string;
  readonly services: readonly {
    readonly id: 'core' | 'telegram' | 'discord' | 'app';
    readonly state: 'up' | 'down' | 'unknown';
    /** When the service was last seen or asked; null while `unknown`. */
    readonly checkedAt: string | null;
  }[];
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
