/**
 * What the core recognizes (1.23.0): the versioned lists of shared infrastructure and named
 * programs, each entry with the public source it was taken from. `GET /v1/recognized`, no key.
 *
 * These are addresses of services, never of persons: exchange wallets from a public label set,
 * launchpads, lockers, bridges and other programs. An address that is absent is simply not
 * recognized; nothing is concluded from that.
 */
import type { ResponseMeta } from './types.js';

export type RecognizedKind = 'exchange' | 'launchpad' | 'locker' | 'bridge' | 'program';

export interface RecognizedEntry {
  readonly address: string;
  readonly name: string;
  /** The service the entry belongs to when the name is one of several, for example "Binance" for "Binance 3". */
  readonly group?: string;
  /** `wallet`: a wallet of the service. `program`: a program. `authority`: an address a program controls. */
  readonly role: 'wallet' | 'program' | 'authority';
  /** Where the entry comes from, in words; may hold more than a link. */
  readonly source: string;
  /** The first link in `source`, when it holds one. */
  readonly sourceUrl: string | null;
}

export interface RecognizedList {
  /** Stable: `exchanges`, `launchpads`, `lockers`, `bridges`, `pool-programs`, `governance-programs`, `named-programs`. */
  readonly id: string;
  readonly kind: RecognizedKind;
  readonly title: string;
  /** What the core does with an address of this list. */
  readonly use: string;
  /** 1.28.1: the stable codes of `title` and `use` (CORE_MESSAGES), for a client that translates: `recognized.<id>.title`, `recognized.<id>.use`. */
  readonly titleCode?: string;
  readonly useCode?: string;
  /** Raised with any change of the list. */
  readonly version: number;
  readonly entries: readonly RecognizedEntry[];
}

/** GET /v1/recognized (no key). */
export interface RecognizedResponse {
  readonly meta: ResponseMeta;
  /** The version of the shared infrastructure list the funding graph and the cluster rule use. */
  readonly infrastructureVersion: string;
  readonly lists: readonly RecognizedList[];
  /** What is recognized by its nature, with no list. */
  readonly byNature: readonly string[];
  /** 1.28.1: the stable code of each sentence of `byNature`, in the same order. */
  readonly byNatureCodes?: readonly string[];
}
