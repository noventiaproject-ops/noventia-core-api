/**
 * Doors of the passport (1.9.0): what a passport opens. One interface for every door: eligibility
 * by branch and level, never a raw fact, and the level itself only for a branch the holder opened to
 * the asker. Six doors; the first is open: rewards, through project campaigns. The others are named
 * with their stage and answer `not_open` until their rule pack exists.
 */
import type { BranchId, LevelNumber, ResponseMeta } from './types.js';

export const DOOR_IDS = ['rewards', 'access', 'credit', 'voice', 'work', 'agents'] as const;
export type DoorId = (typeof DOOR_IDS)[number];
export type DoorStage = 'now' | 'planned';

/** A branch at a level, at least. */
export interface DoorRequirement {
  readonly branch: BranchId;
  readonly level: LevelNumber;
}

/** `all`: every requirement must be met. `any`: one is enough. */
export type DoorMode = 'all' | 'any';

/** `under_review`: a frozen branch, never eligible until the case is decided. `not_open`: the door has no rule pack yet. */
export type EligibilityStatus = 'eligible' | 'not_eligible' | 'under_review' | 'not_open';
export type BranchEligibilityStatus = 'met' | 'not_met' | 'under_review' | 'little_history' | 'later';

export interface BranchEligibilityView {
  readonly branch: BranchId;
  readonly required: LevelNumber;
  readonly status: BranchEligibilityStatus;
  /** The holder's level, only when the holder opened this branch to the asker; absent otherwise. */
  readonly level?: LevelNumber | null;
}

export interface EligibilityView {
  readonly door: DoorId;
  readonly status: EligibilityStatus;
  readonly mode: DoorMode;
  readonly branches: readonly BranchEligibilityView[];
  readonly ruleId: string;
  readonly ruleVersion: number;
}

export interface DoorView {
  readonly id: DoorId;
  readonly stage: DoorStage;
  readonly name: string;
  readonly description: string;
  /** What the door asks of a passport, in plain words. */
  readonly asks: string;
}

export type CampaignStatus = 'open' | 'closed';

/**
 * The project's own words on a campaign (1.19.0): plain text as the project wrote it, markup
 * stripped, `description` up to 500 characters, `reward` up to 200. The core does not check them;
 * a screen says they are the project's words.
 */
export interface ProjectWords {
  readonly description?: string;
  readonly reward?: string;
}

/** A campaign as anyone sees it: what it asks, how many joined, never who. */
export interface CampaignPublicView {
  readonly campaignId: string;
  readonly project: { readonly slug: string; readonly name: string };
  readonly name: string;
  readonly door: DoorId;
  readonly requirements: readonly DoorRequirement[];
  readonly mode: DoorMode;
  /** Eligible places, null when unlimited. */
  readonly places: number | null;
  /** Holders that joined. */
  readonly entries: number;
  /** ISO 8601, UTC; null when open until closed by the project. */
  readonly closesAt: string | null;
  readonly status: CampaignStatus;
  /** 1.19.0: the project's own words; absent when the project wrote none. */
  readonly projectWords?: ProjectWords;
  /** 1.20.0: ISO 8601, UTC, when the project closed it; null while open. */
  readonly closedAt?: string | null;
}

/** The project's own view of its campaign. */
export interface CampaignView extends CampaignPublicView {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly eligible: number;
}

/** GET /v1/doors: the doors with their stage, and every open campaign. No key. */
export interface DoorsResponse {
  readonly meta: ResponseMeta;
  readonly doors: readonly DoorView[];
  readonly campaigns: readonly CampaignPublicView[];
}

/** POST /v1/projects/{projectId}/campaigns (owner, admin). */
export interface CreateCampaignRequest {
  readonly name: string;
  /** `rewards` today. */
  readonly door?: DoorId;
  readonly requirements: readonly DoorRequirement[];
  readonly mode?: DoorMode;
  readonly places?: number | null;
  readonly closesAt?: string | null;
  /** 1.19.0: the project's own words, plain text; markup is stripped, `description` is cut at 500 characters and `reward` at 200. */
  readonly description?: string;
  readonly reward?: string;
}

export interface CampaignResponse {
  readonly meta: ResponseMeta;
  readonly campaign: CampaignView;
}

export interface CampaignsResponse {
  readonly meta: ResponseMeta;
  readonly campaigns: readonly CampaignView[];
}

/** PUBLIC campaigns of one project: GET /v1/projects/public/{slug}/campaigns. */
export interface PublicCampaignsResponse {
  readonly meta: ResponseMeta;
  readonly campaigns: readonly CampaignPublicView[];
}

/** One holder's entry as the project sees it: the holder id it joined with, the answer, never a fact or a wallet. */
/**
 * An entry as the project sees it. 1.19.0 (owner, 8 November 2026): the Noventia ID never reaches a
 * project; `entrant` is a pseudonym made at the join, one per campaign, so a project cannot follow a
 * person across campaigns. This is the contract's one removal (`holderId`), for the person's privacy.
 */
export interface CampaignEntryView {
  readonly entrant: string;
  /** The wallet the holder picked from the linked wallets for the payout. */
  readonly payoutWallet: string | null;
  readonly status: EligibilityStatus;
  /** Met or not met per required branch. Levels appear only for branches the holder opened to this project. */
  readonly branches: readonly BranchEligibilityView[];
  /** ISO 8601, UTC. */
  readonly checkedAt: string;
  readonly ruleVersion: number;
}

/** The holder's own entry (1.19.0): with the Noventia ID, the pseudonym the project sees, and the levels. */
export interface HolderEntryView extends CampaignEntryView {
  readonly holderId: string;
}

/** GET /v1/projects/{projectId}/campaigns/{campaignId}/entries?cursor=&limit= (members). */
export interface CampaignEntriesResponse {
  readonly meta: ResponseMeta;
  readonly entries: readonly CampaignEntryView[];
  readonly next: string | null;
  readonly summary: { readonly entries: number; readonly eligible: number };
}

/** POST /v1/passport/doors/eligibility (app key): the holder's own answer to a question, with the levels. */
export interface DoorCheckRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly door: DoorId;
  readonly requirements: readonly DoorRequirement[];
  readonly mode?: DoorMode;
}

export interface DoorCheckResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly eligibility: EligibilityView;
}

/** POST /v1/passport/doors/join (app key): the holder joins a campaign; the answer is kept as the entry. Joining again checks again. */
export interface JoinCampaignRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
  readonly campaignId: string;
  /** 1.19.0: the wallet the holder picks for the payout, one of the holder's linked wallets. */
  readonly payoutWallet: string;
}

export interface JoinCampaignResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly campaign: CampaignPublicView;
  /** The holder's own view: with the levels and the pseudonym the project sees. */
  readonly entry: HolderEntryView;
}

/** POST /v1/passport/doors/campaigns (1.19.0, app key): the app's campaign screen for one holder. */
export interface HolderCampaignsRequest {
  readonly noventiaId?: string;
  readonly holderType?: 'person' | 'agent';
  readonly agentId?: string;
}

/** One campaign on the holder's screen: the campaign, the holder's own eligibility (with levels) and the entry when the holder joined. */
export interface HolderCampaignView {
  readonly campaign: CampaignPublicView;
  readonly eligibility: EligibilityView;
  readonly entry: HolderEntryView | null;
}

/** Every open campaign, plus every campaign the holder joined, closed ones included; open first, newest first. */
export interface HolderCampaignsResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly campaigns: readonly HolderCampaignView[];
}
