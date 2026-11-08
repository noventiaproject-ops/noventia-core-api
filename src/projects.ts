/**
 * Noventia for Projects (core-api 1.4.0): sign in with the authority wallet or a Firebase Auth
 * email link, the team, list checks with labels that carry proofs, appeals, the live report after a
 * distribution, and the public project page with its badge. Agreed with the web cabinet on 1
 * November 2026 (the engine's docs/PROJECTS.md is the written agreement).
 *
 * Method rules carried by the types:
 * - A label is a fact with its proofs and the rule that produced it. No type has a score, a rank
 *   or a total across labels, and no label is called "scam".
 * - A list and its labels are private to the project's members and, for each wallet, to the
 *   person who holds it (through the passport). Nothing here is public except PublicProjectView.
 * - The project never decides an appeal. The Noventia team decides by the published rule.
 * - One rule set for the whole engine: a list label uses the same rule id and thresholds version
 *   as the token check, the passport freeze and the public reports.
 */

import type { AutomationFlag, Coverage, FactView, NonEmptyArray, Proof, ResponseMeta, SolanaAccountProof, SolanaTxProof, TokenCheckResponse } from './types.js';

// ─── project, sign in, sessions ─────────────────────────────────────────────

/** What the project signs in with: its token's mint, or its program. */
export interface ProjectSubject {
  readonly kind: 'mint' | 'program';
  readonly address: string;
}

/**
 * `mint_authority`: the mint's mint authority. `metadata_update_authority`: the update authority
 * of the mint's Metaplex metadata (works after the mint authority is revoked). `program_upgrade_authority`:
 * the upgrade authority in the program's ProgramData account.
 */
export type AuthorityKind = 'mint_authority' | 'freeze_authority' | 'metadata_update_authority' | 'program_upgrade_authority' | 'deployer' | 'manual_review';
/**
 * 1.17.0. `freeze_authority`: the mint's freeze authority, read with the mint authority. For a
 * subject whose authorities are revoked or held by a known launchpad: `deployer` is the wallet that
 * signed the token's creation (the token check's proven creator), `manual_review` a wallet the
 * Noventia team approved through a review request (`POST /v1/projects/reviews`). Both sign the same
 * challenge. While any authority is held by a wallet, only that wallet can sign in; an authority
 * held by a program the core does not know as a launchpad goes to the team's review.
 */
export const AUTHORITY_KINDS: readonly AuthorityKind[] = ['mint_authority', 'freeze_authority', 'metadata_update_authority', 'program_upgrade_authority', 'deployer', 'manual_review'];

/** The account read that shows the signer holds the authority, at the slot it was read. */
export interface AuthorityProofView {
  readonly kind: AuthorityKind;
  readonly subject: ProjectSubject;
  readonly authority: string;
  /** The subject's account at the slot read; for `deployer` and `manual_review` the account the subject lives in. */
  readonly proofs: NonEmptyArray<SolanaAccountProof>;
  /** `deployer` (1.17.0): the transaction that created the token, signed by this wallet. */
  readonly transaction?: string;
  /** `manual_review` (1.17.0): the approved review request. */
  readonly reviewId?: string;
}

export type ProjectRole = 'owner' | 'admin' | 'viewer';

export interface ProjectView {
  readonly projectId: string;
  /** Lowercase, [a-z0-9-], 3 to 40 characters: the public page is /projects/p/{slug}. */
  readonly slug: string;
  readonly name: string;
  /** Every subject the project has signed in with, each with its authority proof. */
  readonly subjects: readonly AuthorityProofView[];
  /** ISO 8601, UTC. */
  readonly createdAt: string;
  /** Wallets the project may check this month and how many it has used. */
  readonly quota: { readonly walletsPerMonth: number; readonly walletsUsedThisMonth: number };
  /**
   * Set by the core's config. Until a paid data plan (owner, 1 November 2026): at most 500 wallets
   * per list, read inside the engine's credit guard.
   */
  readonly limits: { readonly maxWalletsPerList: number; readonly maxWalletsPerCall: number };
}

/** POST /v1/projects/auth/challenge (no session). */
export interface ProjectChallengeRequest {
  readonly authority: string;
  readonly subject: ProjectSubject;
  /**
   * 1.17.0: `deployer` or `manual_review` when the subject's authorities are revoked. Without it the
   * core checks the three on-chain authorities; with it, the on-chain check still comes first and the
   * named kind is the fallback.
   */
  readonly kind?: AuthorityKind;
}

/**
 * The text to sign, in the Sign In With Solana message format, and the same fields as a
 * `solana:signIn` input. Valid for 10 minutes, one use. Signing it moves nothing and costs nothing.
 */
export interface ProjectChallengeResponse {
  readonly challengeId: string;
  readonly message: string;
  readonly signInInput: {
    readonly domain: string;
    readonly address: string;
    readonly statement: string;
    readonly uri: string;
    readonly version: '1';
    readonly chainId: 'mainnet';
    readonly nonce: string;
    readonly issuedAt: string;
    readonly expirationTime: string;
  };
  readonly expiresAt: string;
}

/** POST /v1/projects/auth/verify (no session). */
export interface ProjectVerifyRequest {
  readonly challengeId: string;
  readonly authority: string;
  /** Base58, 64 bytes, over the exact bytes of `signedMessage` (or of `message` when absent). */
  readonly signature: string;
  /** Base64. Set when the wallet's `solana:signIn` returned its own message bytes. */
  readonly signedMessage?: string;
}

/** Who acts: the authority wallet, or a team member by email. */
export type ProjectIdentity = { readonly kind: 'wallet'; readonly address: string } | { readonly kind: 'email'; readonly email: string };

/**
 * Sent as `Authorization: Bearer <token>` on every /v1/projects call below. A random 32 byte token;
 * the core stores only its sha256. 12 hours, never refreshed silently, never logged. Every answer
 * that carries it has `Cache-Control: no-store`.
 */
export interface ProjectSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly role: ProjectRole;
  readonly who: ProjectIdentity;
}

/**
 * POST /v1/projects/auth/firebase (no session): a team member signs in with a Firebase Auth email
 * link (owner, 1 November 2026: no separate mail provider). The browser sends the link with the
 * Firebase JS SDK and trades the ID token here; the core verifies it, requires `email_verified`, and
 * matches the email to a member or an open invite (an invite becomes a member on first sign in).
 * The cabinet signs out of Firebase right after: it keeps only the project session.
 */
export interface ProjectFirebaseSignInRequest {
  readonly idToken: string;
  /** From the invite link's continue URL, when there is one. Membership is decided by the email. */
  readonly inviteId?: string;
}

/** Answer to verify, to the Firebase sign in, and GET /v1/projects/me (session). */
export interface ProjectSessionResponse {
  readonly meta: ResponseMeta;
  readonly session: ProjectSession;
  readonly project: ProjectView;
}

// ─── team ───────────────────────────────────────────────────────────────────

export interface MemberView {
  readonly memberId: string;
  readonly role: ProjectRole;
  /** The owner is the authority wallet; everyone else is an email. */
  readonly who: ProjectIdentity;
  readonly addedAt: string;
  readonly lastSeenAt: string | null;
}

export interface InviteView {
  readonly inviteId: string;
  readonly email: string;
  readonly role: Exclude<ProjectRole, 'owner'>;
  readonly sentAt: string;
  readonly expiresAt: string;
  /** Mock mode only (meta.mock): the link the email would carry, so the flow can be tried without mail. */
  readonly mockLink?: string;
}

/** Where an invite or sign in email link returns to. `invite` is optional. */
export const JOIN_PATH = '/projects/app/join';

/** GET /v1/projects/{projectId}/members. */
export interface MembersResponse {
  readonly meta: ResponseMeta;
  readonly members: readonly MemberView[];
  readonly invites: readonly InviteView[];
}

/**
 * POST /v1/projects/{projectId}/invites (owner or admin). The core records the invite; the browser
 * then has Firebase Auth send the email link (continue URL JOIN_PATH?invite={inviteId}).
 */
export interface InviteRequest {
  readonly email: string;
  readonly role: Exclude<ProjectRole, 'owner'>;
}

// ─── list checks ────────────────────────────────────────────────────────────

/**
 * The labels a list check gives a wallet. A wallet carries one or more; `clean` and `not_read`
 * only alone. Shown with these exact texts (LABEL_TEXT) and the rule's definition.
 */
export const LIST_LABELS = ['farm_cluster', 'looks_automated', 'fresh', 'sold_past_airdrops', 'moved_out_past_airdrops', 'clean', 'not_read'] as const;
export type ListLabelCode = (typeof LIST_LABELS)[number];

/** The fixed words each label is shown with. */
export const LABEL_TEXT: Readonly<Record<ListLabelCode, string>> = {
  farm_cluster: 'Farm cluster',
  looks_automated: 'Looks automated',
  fresh: 'Fresh wallet',
  sold_past_airdrops: 'Sold past airdrops',
  moved_out_past_airdrops: 'Moved out past airdrops',
  clean: 'Clean',
  not_read: 'Not read',
};

/** `case_kept` and `case_released` (1.7.0): the decision on the case behind a freeze. */
export type AppealStatus = 'open' | 'in_review' | 'label_kept' | 'label_lifted' | 'case_kept' | 'case_released';

export interface AppealRef {
  readonly appealId: string;
  readonly status: AppealStatus;
}

export interface ListLabel {
  readonly labelId: string;
  readonly code: ListLabelCode;
  readonly ruleId: string;
  readonly ruleVersion: number;
  /**
   * The facts behind the label, each with its proofs: never empty (owner, 1 November 2026: every
   * label with proof). `clean`: one `lists.historyRead` fact { transactionsRead, readFrom, readTo }
   * with the first and the last transaction read. `not_read`: the account read that shows the
   * address belongs to a program.
   */
  readonly facts: NonEmptyArray<FactView>;
  /** `farm_cluster` only. */
  readonly clusterId?: string;
  /** `sold_past_airdrops` and `moved_out_past_airdrops`: the measured programmes (ids from the public reports). */
  readonly programmes?: readonly string[];
  /** `looks_automated` only: the same findings as the wallet check. */
  readonly automation?: AutomationFlag;
  /**
   * `not_read` only: the address is not a wallet. Passing states (the day's cap, the source did not
   * answer, not read yet) are not labels: the wallet has no label and its coverage says how far it
   * was read (null when not at all). A wallet read in part gets the labels its facts show, but never
   * `clean` while its coverage is incomplete.
   */
  readonly reason?: 'not_a_wallet';
  readonly appeal: AppealRef | null;
}

export interface ListWalletView {
  readonly address: string;
  /** Row number in the uploaded list, from 1. */
  readonly row: number;
  /**
   * One or more labels. Empty only while the wallet is not read in full and no rule matched on what
   * was read so far: shown as "Still reading" (coverage incomplete) or "Not read yet" (coverage
   * null), never as clean.
   */
  readonly labels: readonly ListLabel[];
  readonly coverage: Coverage | null;
}

export type ListStatus = 'draft' | 'queued' | 'running' | 'paused_budget' | 'done' | 'failed';

export interface ListView {
  readonly listId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly status: ListStatus;
  /** Wallets accepted into the list. */
  readonly total: number;
  readonly progress: { readonly read: number; readonly labeled: number };
  /** Before start and while running. `finishesBy` null when the core cannot say yet. */
  readonly estimate: { readonly credits: number; readonly finishesBy: string | null };
  /** Wallets per label once done (a wallet with two labels counts in both). Null before. */
  readonly summary: Readonly<Record<ListLabelCode, number>> | null;
  /** Wallets the exclusions file holds now (farm_cluster and looks_automated, minus lifted labels). */
  readonly excluded: number | null;
  readonly clusters: number | null;
  /** The facts are read up to this moment; `fresh` is counted back from it. */
  readonly snapshotAt: string;
  readonly rulesVersion: string;
  readonly thresholdsVersion: number;
  readonly failure: string | null;
}

/** GET /v1/projects/{projectId}/lists. */
export interface ListsResponse {
  readonly meta: ResponseMeta;
  readonly lists: readonly ListView[];
}

/** GET /v1/projects/{projectId}/lists/{listId}, and the answer to create and start. */
export interface ListResponse {
  readonly meta: ResponseMeta;
  readonly list: ListView;
}

/** POST /v1/projects/{projectId}/lists (owner or admin): an empty list in `draft`. */
export interface CreateListRequest {
  readonly name: string;
}

/** POST /v1/projects/{projectId}/lists/{listId}/wallets: at most `limits.maxWalletsPerCall` addresses per call, `limits.maxWalletsPerList` per list. */
export interface AddWalletsRequest {
  readonly wallets: readonly string[];
}

export interface AddWalletsResponse {
  readonly meta: ResponseMeta;
  readonly accepted: number;
  readonly duplicates: number;
  /** Index into this call's array, the value, and why. */
  readonly invalid: readonly { readonly index: number; readonly value: string; readonly reason: 'invalid_address' | 'not_a_wallet' }[];
  readonly total: number;
}

/** GET /v1/projects/{projectId}/lists/{listId}/wallets?label=&cluster=&cursor=&limit= (limit 1 to 500, default 200). */
export interface ListWalletsResponse {
  readonly meta: ResponseMeta;
  readonly wallets: readonly ListWalletView[];
  readonly next: string | null;
}

/** A cluster member that is in the project's own list. */
export interface ClusterMember {
  readonly address: string;
  /** The wallet's first incoming SOL transfer from the funder. */
  readonly funding: SolanaTxProof;
  readonly lamports: string;
  readonly at: string;
}

/**
 * The engine's farm cluster (the same rule and thresholds version as the token check and the
 * passport freeze): at least 3 wallets whose first SOL came from one funder within 24 hours today.
 * Exchange, bridge and program addresses never form a cluster. Members outside the project's list
 * are other people's wallets: they appear only as a count and their funding transactions, never by
 * address.
 */
export interface ClusterView {
  readonly clusterId: string;
  readonly funder: string;
  /** Members found on chain, in the list or not. */
  readonly size: number;
  /** Members in this list, by address. */
  readonly members: readonly ClusterMember[];
  /** Members outside this list: how many, and their funding transactions without addresses. */
  readonly offList: { readonly count: number; readonly fundings: readonly SolanaTxProof[] };
  readonly window: { readonly from: string; readonly to: string };
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly thresholdsVersion: number;
}

/** GET /v1/projects/{projectId}/lists/{listId}/clusters?cursor=&limit= (limit 1 to 100, default 50). */
export interface ClustersResponse {
  readonly meta: ResponseMeta;
  readonly clusters: readonly ClusterView[];
  readonly next: string | null;
}

/**
 * GET /v1/projects/{projectId}/lists/{listId}/exclusions.csv: text/csv, UTF-8, header
 * `address,labels,cluster_id,proof`. `labels` joined by `;`, `proof` one explorer link. Holds the
 * wallets labeled farm_cluster or looks_automated, without labels lifted on appeal.
 */
export const EXCLUSIONS_CSV_HEADER = 'address,labels,cluster_id,proof';

// ─── appeals ────────────────────────────────────────────────────────────────

export interface AppealView {
  readonly appealId: string;
  readonly labelId: string;
  readonly listId: string;
  readonly listName: string;
  readonly address: string;
  readonly code: ListLabelCode;
  readonly openedAt: string;
  /** What the person wrote, at most 1,000 characters. */
  readonly statement: string;
  readonly status: AppealStatus;
  /** The Noventia team's decision, by the published rule. The project only reads it. */
  readonly decision: { readonly at: string; readonly text: string; readonly ruleId: string; readonly ruleVersion: number } | null;
}

/** GET /v1/projects/{projectId}/appeals?status=. */
export interface AppealsResponse {
  readonly meta: ResponseMeta;
  readonly appeals: readonly AppealView[];
}

/** Passport side (the app, Release 1b). POST /v1/passport/labels with the app key: list labels on the passport's own wallets. */
export interface PassportLabelView {
  readonly labelId: string;
  readonly address: string;
  readonly code: ListLabelCode;
  readonly project: { readonly name: string; readonly slug: string };
  readonly at: string;
  readonly facts: readonly FactView[];
  readonly appeal: AppealRef | null;
}

/** POST /v1/passport/labels { wallets } with the app key. */
export interface PassportLabelsResponse {
  readonly meta: ResponseMeta;
  readonly labels: readonly PassportLabelView[];
}

/** POST /v1/passport/appeals with the app key, for a wallet of that passport. */
export interface PassportAppealRequest {
  readonly wallets: readonly string[];
  /** The label appealed, or (1.7.0) the case behind a freeze: one of the two. */
  readonly labelId?: string;
  readonly caseId?: string;
  readonly statement: string;
}

/** The answer to a passport appeal. */
export interface PassportAppealResponse {
  readonly meta: ResponseMeta;
  readonly appeal: AppealRef;
}

// ─── distributions and the live report ──────────────────────────────────────

export type ReportDay = 1 | 7 | 30 | 90;
export const REPORT_DAYS: readonly ReportDay[] = [1, 7, 30, 90];

export type DistributionSource =
  | { readonly kind: 'claim_program'; readonly programId: string; readonly distributorAccounts: readonly string[] }
  | { readonly kind: 'transfers'; readonly fromWallets: readonly string[] };

export interface DistributionView {
  readonly distributionId: string;
  readonly name: string;
  readonly mint: string;
  readonly source: DistributionSource;
  readonly startsAt: string;
  /** The list check this distribution came from, if any. */
  readonly listId: string | null;
  readonly checkpoints: readonly { readonly day: ReportDay; readonly at: string; readonly status: 'not_reached' | 'measuring' | 'ready' }[];
}

/** GET /v1/projects/{projectId}/distributions. */
export interface DistributionsResponse {
  readonly meta: ResponseMeta;
  readonly distributions: readonly DistributionView[];
}

/** The answer to create. */
export interface DistributionResponse {
  readonly meta: ResponseMeta;
  readonly distribution: DistributionView;
}

/** POST /v1/projects/{projectId}/distributions (owner or admin). */
export interface CreateDistributionRequest {
  readonly name: string;
  readonly mint: string;
  readonly source: DistributionSource;
  readonly startsAt: string;
  readonly listId?: string;
}

/**
 * One measure, with the same id, label, unit and definition as the public airdrop reports
 * (noventia.xyz/reports). `rangeLow`/`rangeHigh`: 95 % Wilson range when the value comes from a sample.
 */
export interface ReportMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: 'wallets' | '% of recipients' | 'tokens';
  readonly definition: string;
  readonly rangeLow: number | null;
  readonly rangeHigh: number | null;
}

/** GET /v1/projects/{projectId}/distributions/{distributionId}/report?day=1|7|30|90. */
export interface LiveReportResponse {
  readonly meta: ResponseMeta;
  readonly distributionId: string;
  readonly day: ReportDay;
  readonly measuredAt: string;
  readonly methodVersion: string;
  readonly thresholdsVersion: number;
  readonly population: {
    readonly recipients: number;
    readonly claims: number;
    readonly claimed: number;
    readonly unclaimed: number | null;
  };
  readonly sample: { readonly size: number; readonly seed: string; readonly confidence: 0.95 } | null;
  readonly metrics: readonly ReportMetric[];
  /** What this report does not measure, in plain words. */
  readonly notMeasured: readonly string[];
}

// ─── the public page and the badge ──────────────────────────────────────────

export type OfficialAddressKind = 'mint' | 'program' | 'treasury' | 'claim' | 'team' | 'liquidity';

export interface OfficialAddressView {
  readonly kind: OfficialAddressKind;
  readonly address: string;
  readonly label: string;
  readonly addedAt: string;
  /** For the mint and the program: the authority read. Other addresses are listed by the project. */
  readonly proofs: readonly Proof[];
}

export interface ProjectLinks {
  readonly website: string | null;
  readonly x: string | null;
  readonly discord: string | null;
  readonly telegram: string | null;
}

/** GET /v1/projects/public/{slug} (no session; CORS like the checks). */
export interface PublicProjectView {
  readonly meta: ResponseMeta;
  readonly slug: string;
  readonly name: string;
  readonly links: ProjectLinks;
  readonly officialAddresses: readonly OfficialAddressView[];
  /** The token check of the project's mint, as GET /v1/check/token answers it. */
  readonly token: TokenCheckResponse | null;
  /** How the project signed in: the authority and the account read. */
  readonly signedInWith: readonly AuthorityProofView[];
  readonly updatedAt: string;
}

/** PUT /v1/projects/{projectId}/profile (owner or admin). */
export interface ProfileRequest {
  readonly name: string;
  readonly links: ProjectLinks;
  readonly officialAddresses: readonly { readonly kind: OfficialAddressKind; readonly address: string; readonly label: string }[];
}

/**
 * GET /v1/projects/public/{slug}/badge.svg: image/svg+xml, 240 x 40, no script, no external
 * reference. Text: "Official addresses on Noventia" and the date of the last change.
 */
export const BADGE_SIZE = { width: 240, height: 40 } as const;

// ─── errors ─────────────────────────────────────────────────────────────────

/**
 * Added to ApiErrorCode in 1.4.0. `not_authority` (403): the signer does not hold the subject's
 * authority at the slot read; the body carries the account read. `no_authority` (409): the subject
 * has no authority left to sign with (all revoked); support handles it by hand. `challenge_expired`
 * (410). `invalid_signature` (400). `session_expired` (401). `forbidden_role` (403). `list_too_large`
 * (413): over `limits.maxWalletsPerList`. `quota_exceeded` (402): this month's wallets are used.
 * `list_not_ready` (409): the report or the file asked for before the list is done. `not_a_member`
 * (403): a Firebase sign in whose email is neither a member nor invited.
 */
// ─── review requests (1.17.0) ──────────────────────────────────────────────

export type ReviewStatus = 'received' | 'approved' | 'declined';

/**
 * POST /v1/projects/reviews (no session): a manual check by the Noventia team for a subject whose
 * authorities are all revoked. `wallet` is the address that signs in with kind `manual_review` once
 * the request is approved; `email` is where the team answers; `statement` says who asks and why the
 * authorities are revoked (20 to 2000 characters). One open request per subject and wallet: sending
 * it again returns the same request.
 */
export interface ReviewRequest {
  readonly subject: ProjectSubject;
  readonly wallet: string;
  readonly email: string;
  readonly statement: string;
}

/** The request as the API shows it: the status, never the email or the statement. */
export interface ReviewView {
  readonly reviewId: string;
  readonly subject: ProjectSubject;
  readonly wallet: string;
  readonly status: ReviewStatus;
  /** ISO 8601, UTC. */
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

/** The answer of POST /v1/projects/reviews and GET /v1/projects/reviews/{reviewId}. */
export interface ReviewResponse {
  readonly meta: ResponseMeta;
  readonly review: ReviewView;
}

export type ProjectsErrorCode =
  | 'not_a_member'
  | 'not_authority'
  | 'no_authority'
  /** 1.17.0 (403): the wallet's review request for the subject is received but not decided, or was declined. */
  | 'review_pending'
  | 'review_declined'
  /**
   * 1.17.0 (403), the fallbacks: an authority of the subject is held by a wallet, which alone can sign in
   * (`details.authority`, `details.wallet`); by a program address the core does not know as a launchpad
   * (`details.authority`, `details.holder`); or the signer is not the token's proven creator
   * (`details.creator` when one is proven).
   */
  | 'authority_held_by_wallet'
  | 'authority_held_by_unknown_program'
  | 'not_creator'
  | 'challenge_expired'
  | 'invalid_signature'
  | 'session_expired'
  | 'forbidden_role'
  | 'list_too_large'
  | 'quota_exceeded'
  | 'list_not_ready';
