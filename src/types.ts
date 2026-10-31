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
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type NonEmptyArray<T> = readonly [T, ...T[]];

/** Stable id of a subject: `wallet:solana:<address>` or `token:solana:<mint>`. */
export type SubjectId = string;

/** A Solana transaction anyone can open in an explorer. */
export interface SolanaTxProof {
  readonly kind: 'solana-tx';
  readonly signature: string;
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
  /** `hit`: from cache. `topped_up`: cache plus the transactions since. `cold`: read from the source now. */
  readonly cache: 'hit' | 'topped_up' | 'cold';
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
  readonly limitedBy: 'large_wallet' | 'request_budget' | null;
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

/** A wallet in a farm cluster earns no new EP until a review case is decided. */
export interface Freeze {
  readonly reason: 'farm_cluster';
  /** ISO 8601, UTC. */
  readonly since: string;
  readonly caseId: string;
  /** Wallets in the cluster. The other wallets are never named. */
  readonly clusterSize: number;
  /** The subject's own funding transaction. */
  readonly proofs: NonEmptyArray<Proof>;
}

/**
 * `active`: EP and level computed. `frozen`: EP as it stood when the freeze began.
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

/** POST /v1/passport: the passport of a set of wallets, each linked by a signature. */
export interface PassportRequest {
  /** 1 to 10 addresses. */
  readonly wallets: readonly string[];
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
  /** Chain reading credits left today and this month under the server's budget; null when unknown. */
  readonly credits: { readonly dayLeft: number; readonly monthLeft: number } | null;
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
}

/** A power of a listed asset's issuer, shown as a fact on that asset's own mint. */
export interface IssuerPowerView {
  readonly power: 'mint' | 'freeze' | 'permanentDelegate' | 'transferHook' | 'defaultFrozen';
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
  /** This launch: creation, liquidity removed, first day sales and moves. */
  readonly launch: readonly FactView[];
  readonly warnings: readonly Warning[];
}

export type ApiErrorCode = 'invalid_address' | 'not_a_wallet' | 'too_many_wallets' | 'not_found' | 'rate_limited' | 'unauthorized' | 'source_unavailable';

export interface ApiError {
  readonly error: { readonly code: ApiErrorCode; readonly message: string };
}

export type ApiResponse = PassportResponse | WalletCheckResponse | TokenCheckResponse | FoundResponse;
