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

/**
 * POST /v1/pioneers/retire (app key): a deleted account's number, never given again. From 1.13.0 the
 * Noventia ID comes with it: a number still held is retired only for its own holder, whose Pioneer
 * status ends with it (the passport and the card stop showing it); the taken count stays the same.
 * A number retired before answers `retired: false` and changes nothing; a number never given is refused.
 */
export interface RetirePioneerRequest {
  readonly number: number;
  /** The holder's public id; needed when the number is still held. */
  readonly noventiaId?: string;
}

export interface RetirePioneerResponse {
  readonly meta: ResponseMeta;
  readonly number: number;
  readonly retired: boolean;
  /** The holder whose status ended with this call, or null (1.13.0). */
  readonly holder?: string | null;
}

/** One row of the Hall: the public id, the number, the status, when it was earned. */
export interface HallRow {
  readonly number: number;
  readonly noventiaId: string;
  readonly status: PioneerStatus;
  readonly earnedAt: string;
}

/** GET /v1/pioneers/hall (1.13.0, app key): every Pioneer in number order and the retired numbers, for the app's Hall. */
export interface HallResponse {
  readonly meta: ResponseMeta;
  readonly places: number;
  readonly taken: number;
  readonly left: number;
  readonly pioneers: readonly HallRow[];
  readonly retired: readonly number[];
}
