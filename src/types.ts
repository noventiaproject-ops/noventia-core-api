/**
 * The Noventia core API, version 1: every request and response of the passport, the wallet check,
 * the token check and "Found in your wallets". One source: the server compiles against these types,
 * and every client imports them from this package.
 *
 * Hard rule: EP and levels exist per branch only. A response carries EP or a level only inside a
 * BranchStanding, and no type here has a field for a total across branches. The server checks every
 * response before it leaves (no total across branches, no level without the owner's consent, no fact
 * without a proof, no raw chain text).
 */

/** Plain JSON, as facts carry it. */
import type { PioneerPublicView, PioneerView } from './pioneers.js';

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type NonEmptyArray<T> = readonly [T, ...T[]];

/** Stable id of a subject: `wallet:solana:<address>` or `token:solana:<mint>`. */
export type SubjectId = string;

/** A Solana transaction anyone can open in an explorer. */
export interface SolanaTxProof {
  readonly kind: 'solana-tx';
  readonly signature: string;
  /** The slot the transaction was confirmed in, when the core had the transaction in hand (1.6.0). */
  readonly slot?: number;
}

/** The state of an account at a slot: a mint's authorities, a token account's balance. */
export interface SolanaAccountProof {
  readonly kind: 'solana-account';
  readonly address: string;
  readonly slot: number;
}

export type Proof = SolanaTxProof | SolanaAccountProof;

export const BRANCH_IDS = ['holder', 'trader', 'builder', 'lp', 'early'] as const;
export type BranchId = (typeof BRANCH_IDS)[number];
export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export const API_VERSION = 1;

/** Versions and freshness, the same on every response. */
export interface ResponseMeta {
  readonly apiVersion: typeof API_VERSION;
  /** ISO 8601, UTC: the facts are read up to this moment. */
  readonly asOf: string;
  readonly rulesVersion: string;
  readonly thresholdsVersion: number;
  readonly branchConfigVersion: number;
  /**
   * `hit`: from cache. `topped_up`: cache plus the transactions since. `cold`: read from the source now.
   * `stale` (1.1.0): from the last read, because today's reading budget or cold read cap was reached;
   * newer transactions may be missing. Show it as "Answered from the last read".
   */
  readonly cache: 'hit' | 'topped_up' | 'cold' | 'stale';
  /** True for example data: show it as "Example wallet, illustrative data". */
  readonly example: boolean;
  /** Always true: no answer is for search engines (the check page sets noindex from it; the header says the same). */
  readonly noindex: true;
  /** True in mock mode: recorded answers, not live reads. */
  readonly mock: boolean;
}

/** How much of a wallet's history an answer stands on. */
export interface Coverage {
  readonly subjectId: SubjectId;
  /** False when the limits for large wallets cut the history: EP is then a lower bound. */
  readonly complete: boolean;
  readonly transactionsRead: number;
  /** ISO 8601, UTC, of the oldest and the newest transaction read. Null when none. */
  readonly readFrom: string | null;
  readonly readTo: string | null;
  /**
   * `large_wallet`: the history is longer than the size cap. `request_budget`: this call's page budget
   * ran out; the rest is read in the background. `daily_cap` (1.3.0): the day's credits for this
   * wallet are spent, its own share or the product's share for every wallet (1.4.1); what was read
   * is kept and the rest is read the next day, until it is complete. With `daily_cap` and no
   * facts yet, the app says "Still reading your history, more tomorrow"; with facts, "since at least
   * <readFrom>".
   */
  readonly limitedBy: 'large_wallet' | 'request_budget' | 'daily_cap' | null;
  readonly backfill: 'none' | 'queued' | 'running';
}

/** A fact as the API shows it: always with the transactions behind it. */
export interface FactView {
  readonly factId: string;
  readonly subjectId: SubjectId;
  readonly kind: string;
  readonly value: JsonValue;
  readonly proofs: NonEmptyArray<Proof>;
}

/** One occurrence of a branch event, and the EP it earned in that branch. */
export interface EpEvent {
  readonly event: string;
  readonly ep: number;
  /** ISO 8601, UTC. */
  readonly at: string;
  readonly factIds: NonEmptyArray<string>;
}

/**
 * A wallet in a farm cluster: since when, the case, the cluster's size and the wallet's own funding
 * transaction. The EP earned before stays and the wallet adds no event after `since`; every branch of
 * the passport shows `frozen`, with no level, until the case is decided (owner, 7 November 2026).
 */
export interface Freeze {
  readonly reason: 'farm_cluster';
  /** ISO 8601, UTC. */
  readonly since: string;
  readonly caseId: string;
  /** Wallets in the cluster. The other wallets are never named. */
  readonly clusterSize: number;
  /** The subject's own funding transaction. */
  readonly proofs: NonEmptyArray<Proof>;
  /** Where the owner answers the case (1.7.0). Null until the appeal flow has a page. */
  readonly appealUrl?: string | null;
  /** The case behind the freeze (1.7.0): open, answered by the owner, under review, appealed, or decided with the freeze kept. */
  readonly caseStatus?: 'open' | 'owner_answering' | 'under_review' | 'decided' | 'appealed';
}

/**
 * `active`: EP and level computed. `frozen`: the EP earned before the freeze, no level until the case is decided.
 * `little_history`: too few facts for a level. `not_configured`: the branch config has no value yet.
 * `private`: the owner has not opened this branch to the viewer. `later`: no rules yet (LP, Early).
 */
export type BranchStatus = 'active' | 'frozen' | 'flagged' | 'little_history' | 'not_configured' | 'private' | 'later';

/**
 * The Trader flag: the wallet's swaps show a pattern no person keeps up. A
 * flagged wallet earns no Trader EP until the owner's appeal is decided. People only ever see the
 * label, never another word for it.
 */
export interface AutomationFlag {
  readonly code: 'looks_automated';
  readonly label: 'Looks automated';
  /** Each limit reached, in which week (ISO date of its Monday), with the value seen. */
  readonly findings: readonly { readonly rule: string; readonly value: number; readonly limit: number; readonly week: string }[];
  /** The week facts behind the findings; they are also in the standing's facts. */
  readonly factIds: readonly string[];
  readonly appealUrl: string | null;
}

/**
 * A level seal (1.7.0): set the moment the branch's EP first reached a level's threshold, with the
 * facts behind every event up to it. Earned once from the facts, it is earned again by every later
 * evaluation; while the branch is frozen it is `suspended`, never removed.
 */
export interface SealView {
  readonly code: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  /** ISO 8601, UTC: the time of the event that reached the threshold. */
  readonly earnedAt: string;
  readonly factIds: NonEmptyArray<string>;
  readonly status: 'earned' | 'suspended';
}

/** The only place EP and a level appear. Both count within this one branch. */
export interface BranchStanding {
  readonly branch: BranchId;
  readonly status: BranchStatus;
  readonly ep: number | null;
  readonly level: LevelNumber | null;
  /** EP this branch needs for its next level. Null at L5, or without config. */
  readonly nextLevelAtEp: number | null;
  readonly events: readonly EpEvent[];
  readonly facts: readonly FactView[];
  readonly freeze: Freeze | null;
  /** Trader only: set when the wallet looks automated and no appeal has cleared it. */
  readonly flag: AutomationFlag | null;
  /** Level seals (1.7.0), L1 upwards in the order earned; suspended while the branch is frozen. */
  readonly seals?: readonly SealView[];
  readonly ruleId: string;
  readonly ruleVersion: number;
}

/** Four warning levels: 1 little history, 2 warning signs, 3 high risk, 4 confirmed fraud (only after a council decision). */
export interface Warning {
  readonly warningLevel: 1 | 2 | 3 | 4;
  readonly code: string;
  /** Token check only: whether the warning is about the token or the wallet that created it. */
  readonly about?: 'token' | 'creator';
  readonly factIds: readonly string[];
  readonly proofs: readonly Proof[];
  /** Every warning can be appealed; an appeal opens a case. */
  readonly appealUrl: string;
}

export interface AttestationRef {
  readonly hash: string;
  readonly sasAccount: string;
  readonly rulesVersion: string;
}

/**
 * POST /v1/passport: the passport of a set of wallets, each linked by a signature. From 1.8.0 the
 * wallets may be left out when `noventiaId` is given: the core then reads the wallets the holder
 * linked through POST /v1/passport/links.
 */
export interface PassportRequest {
  /** 1 to 10 addresses. Absent (1.8.0): the holder's own links.  */
  readonly wallets?: readonly string[];
  readonly noventiaId?: string;
}

/** Who may see a branch: private until the owner opens it (1.8.0). */
export type BranchPrivacy = 'private' | 'public';

/** The holder behind a passport, when the core knows it (1.8.0). */
export interface HolderView {
  /** `person:<Noventia ID>` or `agent:<id>`. */
  readonly holderId: string;
  readonly type: 'person' | 'agent';
  /** Wallets linked today. */
  readonly wallets: number;
}

export interface PassportResponse {
  readonly meta: ResponseMeta;
  /** NVT-XXXXXX when the wallets belong to a passport, null for a set that does not. */
  readonly noventiaId: string | null;
  readonly coverage: readonly Coverage[];
  /** One standing per branch, in BRANCH_IDS order. */
  readonly branches: readonly BranchStanding[];
  readonly warnings: readonly Warning[];
  readonly attestation: AttestationRef | null;
  /** The holder, its privacy per branch, the sharing switch and the views of its public card in the last 30 days (1.8.0): only when the core knows the holder. */
  readonly holder?: HolderView;
  readonly privacy?: Readonly<Record<BranchId, BranchPrivacy>>;
  readonly sharing?: boolean;
  readonly views?: { readonly card: number };
  /** The holder's Pioneer status (1.10.0), when earned or kept. */
  readonly pioneer?: PioneerView;
}

/** POST /v1/passport/links (1.8.0): a wallet the holder linked by signing the link message. The core checks the signature again. App key. */
/** A passport holds at most this many wallets (1.18.0 exports it; the core refuses the next with `too_many_wallets`). */
export const MAX_LINKED_WALLETS = 10;

/**
 * How the wallet proved it is the holder's (1.18.0). `signed-message` (the default): the link
 * message that names the wallet and the holder. `sign-in`: the app's own Sign In With Solana
 * message, signed by the wallet when it signed in to the app; the app's backend names the holder.
 */
export type LinkProofKind = 'signed-message' | 'sign-in';

export interface LinkWalletRequest {
  readonly noventiaId?: string;
  /** `person` (default, with `noventiaId`) or `agent` (with `agentId`). */
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly address: string;
  /** The Sign In With Solana text the wallet signed: for `signed-message` it names the wallet and the holder; for `sign-in` the wallet alone, from one of the app's hosts. */
  readonly message: string;
  /** Base58 signature of the message by the wallet. */
  readonly signature: string;
  /** 1.18.0; `signed-message` when absent. */
  readonly proofKind?: LinkProofKind;
}

/**
 * POST /v1/passport/links/keep (1.18.0, app key): a link the app kept before the core kept links,
 * carried over once by the app's backend. No signature travels; the proof kept is `app-record` with
 * the time the app made the link. The same rules as a new link: one wallet one holder, at most
 * MAX_LINKED_WALLETS. Answers `LinkWalletResponse`.
 */
export interface KeepLinkRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly address: string;
  /** ISO 8601, UTC: when the app made the link; now when absent. */
  readonly recordedAt?: string;
}

export interface LinkWalletResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly address: string;
  /** ISO 8601, UTC. */
  readonly linkedAt: string;
  /** True when the wallet was linked to this holder before. */
  readonly already: boolean;
  /** Wallets linked to the holder now. */
  readonly wallets: number;
}

/** POST /v1/passport/links/remove (1.8.0). App key. */
export interface UnlinkWalletRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly address: string;
}

export interface UnlinkWalletResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly address: string;
  readonly unlinked: boolean;
}

/** POST /v1/passport/privacy (1.8.0): the owner opens or closes a branch on the public card, or turns sharing on or off. App key. */
export interface PrivacyRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly branch?: BranchId;
  /** True closes the branch, false opens it. */
  readonly private?: boolean;
  /** 1.9.0: with a project id, the branch is opened or closed to that project (the doors), not to the public. */
  readonly projectId?: string;
  /** Whether the card may be indexed and shared; off by default. */
  readonly sharing?: boolean;
}

export interface PrivacyResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  /** Whose view this is: `public`, or `project:<projectId>` (1.9.0). */
  readonly grantee?: string;
  readonly privacy: Readonly<Record<BranchId, BranchPrivacy>>;
  readonly sharing: boolean;
}

/** A seal as the public card shows it (1.8.0): without the facts behind it. */
export interface PublicSealView {
  readonly code: SealView['code'];
  readonly earnedAt: string;
  readonly status: SealView['status'];
}

/** One branch the owner opened, on the public card. */
export interface PublicCardBranch {
  readonly branch: BranchId;
  readonly status: BranchStatus;
  readonly level: LevelNumber | null;
  readonly seals: readonly PublicSealView[];
}

/**
 * GET /v1/passport/card/{noventiaId} (1.8.0): what anyone sees. No key. Only the branches the owner
 * opened, each with its level and seals; never a wallet, a fact, EP or a total. From stored facts,
 * no chain read.
 */
export interface PublicCardResponse {
  readonly meta: ResponseMeta;
  readonly found: boolean;
  readonly noventiaId: string;
  readonly branches: readonly PublicCardBranch[];
  /** YYYY-MM-DD of the earliest event among the opened branches. */
  readonly firstFactDate: string | null;
  /** YYYY-MM of the oldest linked wallet's first transaction. */
  readonly onSolanaSince: string | null;
  readonly sharing: boolean;
  readonly attestation: AttestationRef | null;
  /** The Pioneer number and status (1.10.0): the Hall is public, whatever the privacy of the branches. Absent before 1.10.0. */
  readonly pioneer?: PioneerPublicView | null;
}

/** One measured airdrop programme the wallet claimed from. */
export interface AirdropRecordView {
  readonly programme: string;
  /** From the config, never from chain metadata. */
  readonly name: string;
  readonly token: string;
  /** ISO 8601 of the wallet's first claim in the programme. */
  readonly firstClaimAt: string;
  readonly claims: number;
  /** Kept at least half of the claim 30 and 90 days after it, measured as the airdrop reports measure it. */
  readonly held30d: 'held' | 'held_with_deposits' | 'not_held' | 'unknown' | 'not_reached';
  readonly held90d: 'held' | 'held_with_deposits' | 'not_held' | 'unknown' | 'not_reached';
  readonly factIds: readonly string[];
  readonly proofs: readonly Proof[];
}

/**
 * GET /v1/check/wallet/{address}: facts and warnings for the address the user typed, no sign up.
 * No EP and no level: those need the owner's consent and come only through the passport. No other
 * wallet is named, there is no share link and no public page.
 */
export interface WalletCheckResponse {
  readonly meta: ResponseMeta;
  readonly address: string;
  /** Always `none` here: levels come only through the passport, for wallets their owner linked. */
  readonly consent: 'none';
  readonly coverage: Coverage;
  /** The wallet's first transaction: its age. */
  readonly firstTransaction: FactView | null;
  readonly ageDays: number | null;
  /** Tokens launched and what happened on their first days (the developer card), each number with its transactions. */
  readonly card: CreatorCard;
  readonly airdrops: readonly AirdropRecordView[];
  /** Set when the wallet's swaps look automated; shown as "Looks automated" and nothing else. */
  readonly automation: AutomationFlag | null;
  readonly warnings: readonly Warning[];
  /**
   * Notices for the wallet's owner, not warnings about the wallet (1.1.0). Today one kind:
   * `solana.lookalikeDust`, value `{ count, pairs: [{ sender, imitates }] }` (at most 5 pairs), proofs
   * the dust transactions (at most 10, newest first). Shown with: "Look-alike addresses sent dust to
   * this wallet. Always copy addresses from the source, never from history."
   */
  readonly notices?: readonly FactView[];
}

/** An empty token account the owner can close for its rent. */
export interface ReclaimableAccountView {
  readonly address: string;
  readonly lamports: string;
  readonly proofs: readonly Proof[];
}

/** An airdrop the wallet can still claim, from a project's eligibility list. */
export interface UnclaimedAirdropView {
  readonly programme: string;
  readonly name: string;
  readonly token: string;
  /** ISO 8601 end of the claim window. */
  readonly windowEnds: string;
  /** Where the eligibility list comes from: the project's own page. */
  readonly source: string;
  readonly proofs: readonly Proof[];
}

/** One wallet of the passport in "Found in your wallets". */
export interface FoundInWalletView {
  readonly address: string;
  readonly rent: {
    readonly emptyAccounts: number;
    /** Empty accounts the owner can close now, with the lamports each returns. */
    readonly closable: readonly ReclaimableAccountView[];
    /** Lamports as an integer string, and the same in SOL as a decimal string. */
    readonly reclaimableLamports: string;
    readonly reclaimableSol: string;
    /** Empty accounts that cannot be closed now, by reason. */
    readonly blocked: { readonly frozen: number; readonly withheldFees: number; readonly closeAuthority: number };
  };
  /**
   * Airdrops the wallet can still claim, only where a project's published eligibility list names it.
   * Absent when there are none: the app then shows no airdrop block.
   */
  readonly unclaimedAirdrops?: readonly UnclaimedAirdropView[];
}

/** POST /v1/passport/found: "Found in your wallets", for the wallets of one passport. Needs a key with the passport scope. */
export interface FoundResponse {
  readonly meta: ResponseMeta;
  readonly wallets: readonly FoundInWalletView[];
  /** Rent across the passport's wallets, in lamports and SOL. Money to reclaim, not a measure of anyone. */
  readonly reclaimableLamportsAllWallets: string;
  readonly reclaimableSolAllWallets: string;
}

/** GET /v1/health. */
export interface HealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly apiVersion: typeof API_VERSION;
  /** The server build (git commit) when known. */
  readonly build: string | null;
  readonly database: 'ok' | 'unreachable';
  /**
   * Not sent since 1.5.1: the credit balance is private to the owner and appears on no endpoint. The
   * field stays in the type so a client written against 1.0.0 still compiles; it is always absent.
   */
  readonly credits?: { readonly dayLeft: number; readonly monthLeft: number } | null;
}

/** A number on the developer card, with the transactions behind it. */
export interface CardNumber {
  readonly value: number;
  readonly proofs: readonly Proof[];
}

/** The developer card of a token's creator: facts, no level. */
export interface CreatorCard {
  /** ISO 8601 date of the wallet's first transaction. */
  readonly onSolanaSince: string | null;
  readonly walletAgeDays: number | null;
  readonly tokensLaunched: CardNumber;
  /** Launches whose liquidity the creator removed within 72 hours. */
  readonly liquidityPulls: CardNumber;
  /** Launches where the creator sold at least half of their own allocation within 24 hours. */
  readonly firstDayDumps: CardNumber;
  /** Launches where the creator moved at least half of their own allocation to other wallets within 24 hours. */
  readonly movedOutFirstDay: CardNumber;
}

/** A listed tokenized asset (stablecoins, xStocks) that this token is, or whose name it uses. */
export interface OfficialAssetView {
  readonly kind: 'stablecoin' | 'tokenized-stock';
  readonly ticker: string;
  readonly name: string;
  /** The official mint. */
  readonly mint: string;
  readonly issuer: string;
  /** The issuer's page that lists the mint. */
  readonly source: string;
  /** True: this token is the listed asset. False: it uses the listed ticker or name under another mint. */
  readonly isThisMint: boolean;
  readonly matchedOn: 'mint' | 'ticker' | 'name';
  /** The version of the official list the match came from (1.11.0). */
  readonly listVersion?: number;
}

/** One checkpoint of the creator's share (1.15.0). */
export interface CreatorShareCheckpointView {
  readonly id: 'launch' | '1h' | '24h' | '7d' | '30d' | 'now';
  /** ISO 8601, UTC. */
  readonly at: string;
  /** The creator's balance of the token then, raw units. */
  readonly heldRaw: string;
  /** Percent of the supply, two decimals; null when not known. */
  readonly sharePct: number | null;
  /** `known`; `not_reached` (the time is still ahead); `unknown` (the creator's history is not read up to it). */
  readonly status: 'known' | 'not_reached' | 'unknown';
  /** The launch and the newest movements up to the checkpoint. */
  readonly proofs: readonly Proof[];
}

/** The creator's share of the supply over time (1.15.0). No warning comes from it; the first day rules keep their thresholds. */
export interface CreatorShareView {
  readonly allocationRaw: string;
  /** The supply the shares are against: the mint's supply at the read. */
  readonly supplyRaw: string;
  readonly checkpoints: readonly CreatorShareCheckpointView[];
  /** True when the creator's history was not read in full: a share may be a lower bound. */
  readonly partial: boolean;
  readonly ruleId: string;
  readonly ruleVersion: number;
}

/** A power of a listed asset's issuer, shown as a fact on that asset's own mint; from 1.11.0 also the top holders' share (`concentration`), a fact there and never a warning. */
export interface IssuerPowerView {
  readonly power: 'mint' | 'freeze' | 'permanentDelegate' | 'transferHook' | 'defaultFrozen' | 'concentration';
  /** For example "Issuer can freeze, as with every regulated stablecoin". */
  readonly text: string;
  readonly factIds: readonly string[];
  readonly proofs: readonly Proof[];
}

/** Whether a part of a check ran. `not_checked`: switched off (for example it needs a paid plan); never guessed. */
export interface CheckStatus {
  readonly status: 'checked' | 'not_checked' | 'not_available';
  readonly reason: string | null;
}

/**
 * How far the creator's own history was read (1.25.1). `history` says what stands behind the creator
 * warnings: `not_read` (no transaction held yet: show "Not read yet"), `in_part` (show "Read in
 * part"), `complete`. The two little-history warnings follow it: `youngWallet` needs the wallet's
 * first transaction, `fewLaunches` needs the complete history. Neither is made from what was not read.
 */
export interface CreatorReadStatus extends CheckStatus {
  readonly history?: 'not_read' | 'in_part' | 'complete';
}

/**
 * GET /v1/check/token/{mint}: "can I trust this token before I buy it", answered with facts and
 * warnings, never with "safe" or "unsafe". The creator gets facts and
 * warnings, no branch level: a level needs the owner's consent.
 */
export interface TokenCheckResponse {
  readonly meta: ResponseMeta;
  readonly mint: string;
  /**
   * Facts about the token: mint state (authorities, Token-2022 extensions), first transaction,
   * name and ticker (HTML-escaped, invisible characters removed), holder concentration, and funding
   * clusters once checked. Each with its proofs: a transaction, or an account and the slot it was read at.
   */
  readonly token: readonly FactView[];
  readonly holders: CheckStatus;
  readonly fundingClusters: CheckStatus;
  readonly official: OfficialAssetView | null;
  /**
   * On a listed asset's own mint (`official.isThisMint`): what its issuer can do (mint, freeze,
   * permanent delegate, transfer hook, default frozen), as facts with the text to show, never as
   * warnings. Empty for every other token, whose same facts raise level 2 warnings.
   */
  readonly issuerPowers: readonly IssuerPowerView[];
  /** The wallet that signed the launch (the Pump.fun creator, else the initial mint authority, never the fee payer alone); null when it cannot be proven. */
  readonly creator: string | null;
  readonly creatorCoverage: Coverage | null;
  readonly creatorCard: CreatorCard | null;
  /**
   * How far the creator's history was read (1.12.0): `checked` with `reason` the coverage limit
   * (`large_wallet` past the creator cap, `request_budget` while the rest is read, `daily_cap`, or null),
   * or `not_checked` with `reason: "listed_asset"` on a listed asset's own mint, where no creator history
   * is read at all. Absent when no creator could be proven.
   */
  readonly creatorRead?: CreatorReadStatus;
  /**
   * The creator's share of the supply over time (1.15.0): at launch and at each checkpoint after it, from
   * the creator's own movements, each with the transactions behind it. Null when no creator was proven, the
   * creator's facts hold no launch of this mint, or no creator history is read (a listed asset's own mint).
   */
  readonly creatorShare?: CreatorShareView | null;
  /** This launch: creation, liquidity removed, first day sales and moves. */
  readonly launch: readonly FactView[];
  readonly warnings: readonly Warning[];
}

/**
 * `rate_limited` (429): too many calls or new wallets from this client; Retry-After gives the seconds
 * until the window frees. `busy_today` (503, 1.1.0): today's reading budget or cap on new wallets is
 * used up; Retry-After gives the seconds until 00:00 UTC; wallets read before still answer.
 * `source_unavailable` (502 or 503): the chain read failed or the service is restarting; no Retry-After.
 */
export type ApiErrorCode =
  | 'invalid_address'
  | 'not_a_wallet'
  | 'too_many_wallets'
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized'
  | 'source_unavailable'
  | 'busy_today'
  /** 1.2.0, the relay: the method is not on the allowlist (403); the call has the wrong shape or the transaction is not fully signed (400). Nothing was forwarded. */
  | 'method_not_allowed'
  | 'invalid_rpc'
  /** 1.2.1 (403): the request came from a browser page whose origin is not allowed. Nothing was done. */
  | 'origin_not_allowed'
  /** 1.2.0, the relay (502): the call was forwarded and the RPC did not answer. A sent transaction may still have reached the network: check its signature status, never send it again. */
  | 'upstream_failed'
  /** 1.16.0, Telegram and Discord links: see LinkErrorCode in links.ts. */
  | 'code_expired'
  | 'code_used'
  | 'wrong_channel'
  | 'already_linked'
  /** 1.4.0, Noventia for Projects: see ProjectsErrorCode in projects.ts. */
  | 'not_a_member'
  | 'not_authority'
  | 'no_authority'
  | 'challenge_expired'
  | 'invalid_signature'
  | 'session_expired'
  | 'forbidden_role'
  | 'list_too_large'
  | 'review_pending'
  | 'review_declined'
  | 'authority_held_by_wallet'
  | 'authority_held_by_unknown_program'
  | 'not_creator'
  | 'quota_exceeded'
  | 'list_not_ready'
  | 'report_not_ready'
  | 'campaign_closed'
  | 'campaign_full';

// ─── the cleanup RPC relay (1.2.0) ──────────────────────────────────────────

/**
 * The chain RPC methods the relay forwards, the ones the wallet cleanup needs. Account reads, the
 * latest blockhash, simulation, sending a transaction that is already signed, signature status.
 * Everything else is refused with method_not_allowed.
 */
export const RPC_METHODS = ['getGenesisHash', 'getTokenAccountsByOwner', 'getLatestBlockhash', 'simulateTransaction', 'sendTransaction', 'getSignatureStatuses', 'getMultipleAccounts', 'getAccountInfo'] as const;
export type RpcMethod = (typeof RPC_METHODS)[number];

/** One JSON-RPC 2.0 call. No batches. */
export interface RpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: RpcMethod;
  readonly params?: readonly unknown[];
}

/**
 * The RPC's own answer, unchanged: `result`, or `error` when the node refused the call. Both come
 * with HTTP 200. The relay's own refusals and failures come as ApiError with the codes above.
 */
export interface RpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
}

export interface ApiError {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    /** 1.17.0: named facts behind the refusal, for a screen to show (which authority, which wallet, which field). Present on some codes only. */
    readonly details?: Readonly<Record<string, string>>;
  };
}

/**
 * POST /v1/passport/airdrops (1.5.0): "Your airdrops" for wallets their owner linked. For each of the
 * measured programmes: whether the wallet claimed, what it received, when, what it did after (held,
 * sold within 24 hours or 7 days, moved to another wallet, deposited into a program), measured with
 * the same rules as the published reports, every fact with its transactions; what the tokens were
 * worth when sold or moved and what they would be worth today if held, with the price source and
 * its time; and an open claim window the wallet has not claimed from. Needs the app's key.
 * No EP and no level anywhere in it.
 */
export interface YourAirdropsRequest {
  /** 1 to 10 addresses. */
  readonly wallets: readonly string[];
}

/** The programme's claim window from its config; `open` when the end is still ahead. */
export interface AirdropWindowView {
  readonly start: string | null;
  readonly end: string | null;
  readonly open: boolean;
}

/** A USD value with the price it was made from: the price's source and time, never a guess. */
export interface AirdropMoneyView {
  /** USD with two decimals, for example "12.50". */
  readonly usd: string;
  /** The token's USD price used, as the source gave it. */
  readonly priceUsd: string;
  /** ISO 8601 of the price point. */
  readonly priceAt: string;
  readonly source: 'defillama';
}

/**
 * What the tokens were worth. A field is null when there is no reliable price for that moment
 * (`note` says so), never an estimate.
 */
export interface AirdropValueView {
  /** What was received, at the price of the first claim. */
  readonly received: AirdropMoneyView | null;
  /** What was sold or moved to another wallet within 7 days of the first claim, each at the price of its own day. */
  readonly soldOrMoved: AirdropMoneyView | null;
  /** What was received, at today's price: what it would be worth if every token had been kept. */
  readonly ifHeldToday: AirdropMoneyView | null;
  /** Why a value is missing, for example "no price". */
  readonly note: string | null;
}

/** A fixed stamp per programme, chosen as the airdrop record chooses it. */
export type AirdropStamp = 'Held 90 days' | 'Held 30 days' | 'Sold on day one' | 'Moved out on day one' | 'Not held at 30 days' | 'Not claimed';

export type AirdropHeldView = 'held' | 'held_with_deposits' | 'not_held' | 'unknown' | 'not_reached';

/** One thing the wallet did with the tokens, with the transactions that show it. */
export interface AirdropMoveView {
  readonly happened: boolean;
  /** False when the history or the clock does not reach the end of the window. */
  readonly known: boolean;
  readonly raw: string;
  readonly amount: string;
  readonly proofs: readonly Proof[];
}

export interface AirdropCheckpointView {
  readonly status: AirdropHeldView;
  readonly balanceRaw: string | null;
  readonly withDepositsRaw: string | null;
  readonly proofs: readonly Proof[];
}

/** What the wallet did after the claim, by the published method (thresholds in `meta`). */
export interface AirdropAfterView {
  readonly stamp: AirdropStamp | null;
  readonly soldWithin24h: AirdropMoveView;
  readonly soldWithin7d: AirdropMoveView;
  /** Moved to another owner within 24 hours without a sale; `destination` names where the largest part went. */
  readonly movedOut24h: AirdropMoveView & { readonly destination: 'program' | 'exchange' | 'wallet' | 'unknown' | null };
  /** The largest day one move went into a program (a pool, a vault, staking): counted as kept by the method. */
  readonly deposited24h: boolean;
  readonly held30d: AirdropCheckpointView;
  readonly held90d: AirdropCheckpointView;
}

export interface AirdropReceivedView {
  readonly raw: string;
  readonly amount: string;
  /** The locked part the claims recorded, paid out as it unlocks; null when the programme has none. */
  readonly lockedRaw: string | null;
  readonly lockedAmount: string | null;
  readonly claims: number;
  readonly firstClaimAt: string;
  readonly lastClaimAt: string;
}

/** How far the measurement got: a partial one says why and whether it goes on. */
export interface AirdropMeasuredView {
  /** ISO 8601 up to when the claim accounts' history is known; null when not measured. */
  readonly completeUntil: string | null;
  readonly partial: boolean;
  /**
   * `daily_cap`: the day's credits for this wallet ran out before the claim accounts were read; the
   * rest comes the next day. `large_wallet`: a claim account's history is longer than the size cap.
   * `window_not_ended`: a checkpoint lies in the future. `not_measured`: the wallet's history has
   * not been read yet.
   */
  readonly reason: 'daily_cap' | 'large_wallet' | 'window_not_ended' | 'not_measured' | null;
}

export interface AirdropOutcomeView {
  readonly programme: string;
  /** From the config, never from chain metadata. */
  readonly name: string;
  readonly token: string;
  readonly mint: string;
  readonly decimals: number;
  readonly window: AirdropWindowView;
  /**
   * `yes` when the wallet claimed. Without a public eligibility list for the programme a wallet that
   * did not claim is `unknown`: the core never guesses eligibility.
   */
  readonly eligible: 'yes' | 'unknown';
  readonly claimed: boolean;
  /** The window is still open and the wallet has not claimed: "you may still claim until `window.end`". */
  readonly openAndUnclaimed: boolean;
  readonly received: AirdropReceivedView | null;
  readonly after: AirdropAfterView | null;
  readonly value: AirdropValueView | null;
  readonly measured: AirdropMeasuredView;
  readonly factIds: readonly string[];
  /** The claim transactions; present only when the wallet claimed. */
  readonly proofs?: NonEmptyArray<Proof>;
}

/** One row of the shareable "Airdrop Record" card: the data, the app or the engine draws it. */
export interface AirdropCardRow {
  readonly programme: string;
  readonly name: string;
  readonly token: string;
  readonly claimed: boolean;
  readonly stamp: AirdropStamp | null;
  /** Whole tokens received, formatted; null when not claimed. */
  readonly amount: string | null;
}

export interface AirdropCardView {
  /** The wallet shortened to its first and last four characters, as the card prints it. */
  readonly wallet: string;
  readonly measured: number;
  readonly claimed: number;
  /** Programmes stamped "Held 90 days" or "Held 30 days": the card's one strong number. */
  readonly held: number;
  readonly rows: readonly AirdropCardRow[];
  /** The "On Solana" lines (name and value), when the wallet's history was read. */
  readonly onSolana: readonly { readonly name: string; readonly value: string }[];
}

export interface YourAirdropsWalletView {
  readonly address: string;
  readonly coverage: Coverage;
  readonly programmes: readonly AirdropOutcomeView[];
  readonly summary: {
    readonly measured: number;
    readonly claimed: number;
    readonly held: number;
    readonly openAndUnclaimed: number;
  };
  readonly card: AirdropCardView;
}

export interface YourAirdropsResponse {
  readonly meta: ResponseMeta;
  readonly wallets: readonly YourAirdropsWalletView[];
  /** The thresholds the outcomes were measured with, as the reports print them. */
  readonly method: { readonly dayOneHours: number; readonly dayOneMinPct: number; readonly heldMinPct: number; readonly checkpointDays: readonly number[]; readonly soldWithinDays: readonly number[] };
}

/** One rule the core runs, as GET /v1/rules lists it (1.7.0). */
export interface RuleView {
  readonly ruleId: string;
  /** Bumped on every change of logic or thresholds; recorded next to every result. */
  readonly version: number;
  readonly modelVersion: number;
  /** The fact kinds the rule reads. */
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly description: string;
  /** Set on the branch rules. */
  readonly branch?: BranchId;
}

/** A branch's EP table and thresholds as the core applies them (1.7.0). */
export interface BranchRulesView {
  readonly branch: BranchId;
  readonly stage: 'now' | 'later';
  readonly events: readonly { readonly event: string; readonly when: string; readonly facts: readonly string[]; readonly ep: number | null; readonly cap: { readonly count: number; readonly per: string } | null }[];
  /** EP needed for L1 to L5; null while not set. */
  readonly thresholds: readonly (number | null)[];
}

/** GET /v1/rules (1.7.0): the rules, open and versioned. No key. */
export interface RulesResponse {
  readonly meta: ResponseMeta;
  readonly modelVersion: number;
  readonly rules: readonly RuleView[];
  readonly branches: readonly BranchRulesView[];
  /** What every answer keeps, checked before it leaves the server. */
  readonly invariants: readonly string[];
  /** The freeze in plain words: what it does, until when, how the owner answers. */
  readonly freeze: { readonly what: string; readonly until: string; readonly appeal: string };
}

export type ApiResponse = PassportResponse | WalletCheckResponse | TokenCheckResponse | FoundResponse | YourAirdropsResponse | RulesResponse | LinkWalletResponse | UnlinkWalletResponse | PrivacyResponse | PublicCardResponse;
