/**
 * Pioneers (1.10.0): the first 250 citizens. The status is earned by the rule the core applies,
 * never bought or transferred; a Pioneer keeps the number with the Noventia ID. One value holds the
 * places, shared by the core, the app and both sites.
 */
import type { ResponseMeta } from './types.js';

/** The places. The sites read it at build time; the core refuses a number past it. */
export const PIONEER_PLACES = 250;

export type PioneerStatus = 'active' | 'suspended';

/** A Pioneer as the holder sees it on the passport. */
export interface PioneerView {
  readonly number: number;
  /** `suspended` while a branch of the passport is frozen; the number stays. */
  readonly status: PioneerStatus;
  /** ISO 8601, UTC: when the status was earned (or granted by the app before the core). */
  readonly earnedAt: string;
  /** The seal on the passport. */
  readonly seal: { readonly code: 'pioneer'; readonly earnedAt: string; readonly status: 'earned' | 'suspended' };
  /** The case behind a suspension, when there is one. */
  readonly caseId: string | null;
  readonly ruleId: string;
  readonly ruleVersion: number;
}

/** What the public card and the Hall show: the number and the status, nothing else. */
export interface PioneerPublicView {
  readonly number: number;
  readonly status: PioneerStatus;
}

/** GET /v1/pioneers (1.10.0): the places and the taken count, for the sites at build time. No key. */
export interface PioneersResponse {
  readonly meta: ResponseMeta;
  readonly places: number;
  /** Numbers given, retired ones included: a number is never given twice. */
  readonly taken: number;
  readonly left: number;
  readonly rule: { readonly ruleId: string; readonly version: number; readonly text: readonly string[] };
}

/** POST /v1/pioneers/keep (app key): a Pioneer from before the core keeps the number with the Noventia ID. */
export interface KeepPioneerRequest {
  readonly noventiaId: string;
  readonly number: number;
  /** ISO 8601, UTC: when the app granted it. Absent: now. */
  readonly earnedAt?: string;
}

export interface KeepPioneerResponse {
  readonly meta: ResponseMeta;
  readonly holderId: string;
  readonly pioneer: PioneerView;
  /** True when the holder held this number already. */
  readonly already: boolean;
}

/** POST /v1/pioneers/retire (app key): a number of a deleted account, never given again. */
export interface RetirePioneerRequest {
  readonly number: number;
}

export interface RetirePioneerResponse {
  readonly meta: ResponseMeta;
  readonly number: number;
  readonly retired: boolean;
}
