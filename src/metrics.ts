/**
 * The owner's private stats dashboard, the data side (1.21.0, owner 8 November 2026). Daily
 * aggregates only: no wallet address, no Noventia ID, no email is ever stored or answered.
 *
 * Three ways in: the core counts its own calls; the app and the bots report their own daily counts
 * through `POST /v1/metrics/ingest` with their keys, from the fixed list below (anything else is
 * refused); the fee wallet's daily totals are read on chain. One way out: `GET /v1/owner/metrics`
 * with the owner's key.
 */
import type { ResponseMeta } from './types.js';

/**
 * The counters the app and the bots may report, each the caller's own running total for the day
 * (sending it again replaces the day's value). The app's key reports `app.*`, the Telegram bot's
 * key `telegram.*`, the Discord bot's key `discord.*`; a counter outside the key's prefix is refused.
 */
export const METRIC_COUNTERS = [
  'app.opens',
  'app.sign_ins',
  /** 1.21.1: accounts created that UTC day. */
  'app.sign_ups',
  'app.passport_views',
  'app.card_shares',
  'app.links_added',
  'app.swap_quotes',
  'app.swaps_sent',
  /** 1.26.0: swaps sent with no Noventia fee because the fee account for that token does not exist yet. */
  'app.swaps_no_fee',
  'app.reclaims_sent',
  'app.campaign_views',
  'app.campaign_joins',
  'app.errors',
  'telegram.checks',
  'telegram.commands',
  'telegram.active_users',
  'telegram.alerts_sent',
  'telegram.links_confirmed',
  'telegram.errors',
  /** 1.25.0, a state when the bot reports (read the latest day, never add the days up): private chats the bot can reach. */
  'telegram.chats',
  /** 1.25.0, a state: groups with protection on. */
  'telegram.groups_protected',
  'discord.checks',
  'discord.commands',
  'discord.active_users',
  'discord.roles_given',
  'discord.links_confirmed',
  'discord.errors',
  /** 1.25.0, a state: servers the bot is in. */
  'discord.servers',
] as const;
export type MetricCounter = (typeof METRIC_COUNTERS)[number];

/**
 * The series the core writes itself. `key` is the second dimension: the caller (`app`,
 * `telegram-bot`, `discord-bot`, `owner`, `public` for calls without a key, `system` for the core's
 * own), a route, a token (`SOL`, `WSOL`, `USDC`, `USDT`), a relay limit, or `all`.
 *
 * - `token_checks`, `token_copies` (a copy of a listed asset flagged), `passports_read`: per caller.
 * - `mints_unique`: distinct mints checked that day.
 * - `holders_active_day`, `holders_active_week`: holders whose passport was read for the first time
 *   that day, or that week (sum the week's days for the weekly number).
 * - `holders_linked`, `wallets_linked`, `pioneers_taken`: the state at the end of the day.
 * - `project_sign_ins`, `lists_checked`, `wallets_checked`, `farm_clusters`, `reports_measured`,
 *   `campaigns_created`, `campaign_entries`: Noventia for Projects.
 * - `share_credits` (since 1.30.0) per share with its own daily counter: `lists`, `list_drafts` (sizing lists not
 *   started yet, a part of `lists`), `relay`;
 * - `helius_credits` per caller, against `limits.heliusCreditsPerDay`; `relay_refusals` per limit
 *   (`address_minute`, `address_day`, `wallet_minute`, `wallet_day`).
 * - `requests`, `errors_4xx`, `errors_5xx` per route; `latency_ms` per `route|bucket` (bucket = the
 *   upper bound in ms: le25 … le6400, inf), from which `latency` below is computed.
 * - `fees` per token: what the fee wallet received that day, in raw units (SOL and WSOL 9 decimals,
 *   USDC and USDT 6).
 */
export const METRIC_SERIES = [
  'token_checks',
  'token_copies',
  'mints_unique',
  'passports_read',
  'holders_active_day',
  'holders_active_week',
  'holders_linked',
  'wallets_linked',
  'pioneers_taken',
  'project_sign_ins',
  'lists_checked',
  'wallets_checked',
  'farm_clusters',
  'reports_measured',
  'campaigns_created',
  'campaign_entries',
  'helius_credits',
  'share_credits',
  'relay_refusals',
  'requests',
  'errors_4xx',
  'errors_5xx',
  'latency_ms',
  'fees',
] as const;
export type MetricSeries = (typeof METRIC_SERIES)[number];

/** POST /v1/metrics/ingest (the app key or a bot key). */
export interface MetricsIngestRequest {
  /** UTC day `YYYY-MM-DD`; today when absent; at most 7 days back, never ahead. */
  readonly day?: string;
  /** The caller's running totals for the day: whole numbers from 0. */
  readonly counters: Readonly<Partial<Record<MetricCounter, number>>>;
}

export interface MetricsIngestResponse {
  readonly meta: ResponseMeta;
  readonly day: string;
  readonly accepted: readonly MetricCounter[];
}

export interface MetricPoint {
  /** UTC day `YYYY-MM-DD`. */
  readonly day: string;
  readonly key: string;
  readonly value: number;
}

/** Latency of one route on one day, from the bucket counts: the bucket's upper bound where half, and 95 %, of the requests fall. */
export interface RouteLatency {
  readonly day: string;
  readonly route: string;
  readonly requests: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
}

/** What the fee wallet received over its whole history, in raw units (SOL and WSOL 9 decimals, USDC and USDT 6). */
export interface FeeHistoryView {
  /** `checked`: read to the newest transaction. `partial`: the read stopped early (pages or the day's credits); the sums are a lower bound. `not_configured`: no fee wallet is set. */
  readonly status: 'checked' | 'partial' | 'not_configured';
  readonly received: { readonly SOL: string; readonly WSOL: string; readonly USDC: string; readonly USDT: string };
  /** Transactions of the wallet read so far. */
  readonly transactions: number;
  /** ISO 8601, UTC: the wallet's first transaction and the newest one read; null when it has none. */
  readonly from: string | null;
  readonly to: string | null;
}

/**
 * GET /v1/owner/totals (owner key, 1.25.0): counts over the whole history, from the core's own
 * tables and the fee wallet's history. Nothing here names a person, a wallet or a project.
 */
export interface OwnerTotalsResponse {
  readonly meta: ResponseMeta;
  /** Projects in the cabinet. */
  readonly projects: number;
  /** Lists of wallets: created, and checked to the end. */
  readonly lists: { readonly created: number; readonly checked: number };
  readonly campaigns: number;
  /** Entries of holders in campaigns. */
  readonly campaignJoins: number;
  readonly fees: FeeHistoryView;
}

/**
 * What a wallet received inside a window, split by the shape of the transaction (1.26.0), raw units
 * (SOL and wrapped SOL 9 decimals, USDC 6). `swaps`: a token that arrived in a transaction of a Jupiter
 * swap program. `reclaims`: SOL that arrived in a transaction that closes token accounts. `other`:
 * anything else that came in, a top-up for one; it is neither.
 */
export interface WalletReceipts {
  /** `USDT` since 1.28.2. */
  readonly swaps: { readonly transactions: number; readonly WSOL: string; readonly USDC: string; readonly USDT?: string };
  readonly reclaims: { readonly transactions: number; readonly SOL: string };
  readonly other: { readonly transactions: number; readonly SOL: string; readonly WSOL: string; readonly USDC: string; readonly USDT?: string };
}

/** One of Noventia's own wallets, read only. */
export interface OwnerWalletView {
  readonly id: 'fees' | 'treasury';
  readonly address: string;
  /** `checked`: read to the newest transaction. `partial`: the read stopped early; the receipts are a lower bound. */
  readonly status: 'checked' | 'partial';
  /** Lamports. */
  readonly sol: string;
  /** The wallet's associated token account for wrapped SOL: whether it exists, and what it holds in raw units. */
  readonly wsol: { readonly ata: boolean; readonly balance: string };
  readonly usdc: { readonly ata: boolean; readonly balance: string };
  /** 1.28.2: the USDT account, as the two above (6 decimals). */
  readonly usdt?: { readonly ata: boolean; readonly balance: string };
  /** `allTime` since 1.29.1: the same split over the wallet's whole history read so far (with `status` partial, a lower bound). */
  readonly received: { readonly last24h: WalletReceipts; readonly last7d: WalletReceipts; readonly allTime?: WalletReceipts };
  /** ISO 8601, UTC: when the balances and the receipts were read. */
  readonly asOf: string;
}

/** GET /v1/owner/wallets (owner key, 1.26.0): the fee wallet and the treasury; a wallet that is not set is left out. */
export interface OwnerWalletsResponse {
  readonly meta: ResponseMeta;
  readonly wallets: readonly OwnerWalletView[];
}

/** What people did through Noventia in one window. Every amount a raw integer as a decimal string; `usd` in dollars, 2 decimals. */
export interface TurnoverWindowView {
  /**
   * Different wallets that swapped, reclaimed, or did either. `exact` true for 24 hours and 7 days; false for all
   * time, where the count is an estimate about 1 percent off, made with nothing kept per wallet. `countedFrom` a
   * UTC day when the count does not reach back to the first transaction, else null. Null while wallets are not
   * counted (`walletsReason` says why). No address and no hash is ever answered.
   */
  readonly wallets: { readonly swapped: number; readonly reclaimed: number; readonly any: number; readonly exact: boolean; readonly countedFrom: string | null } | null;
  readonly swaps: {
    readonly count: number;
    /**
     * `lamports`: the swaps' size in SOL terms: the SOL leg of each swap that has one, else its dollar value divided
     * by SOL's price at the transaction's time. `usd`: the USDC or USDT leg at face value when a swap has one, else
     * what it paid at the price nearest the transaction's time (DefiLlama, within 6 hours). `notPriced` swaps are
     * missing from `usd`, `notInSol` from `lamports`; both are in `count`.
     */
    readonly volume: { readonly lamports: string; readonly usd: number; readonly notPriced: number; readonly notInSol: number };
  };
  /** `rentLamports`: the rent of the token accounts closed; `returnedLamports`: what stayed with people after Noventia's fee. */
  readonly reclaims: { readonly count: number; readonly returnedLamports: string; readonly rentLamports: string };
  /** Noventia's fees from these swaps and reclaims: lamports (a fee in wrapped SOL counts here), USDC and USDT with 6 decimals. */
  readonly fees: { readonly SOL: string; readonly USDC: string; readonly USDT: string };
}

/**
 * GET /v1/owner/turnover (owner key, 1.33.0): swaps and SOL reclaims made through Noventia, counted from the
 * receipts of the Fees wallet with every amount read from the transaction. Numbers only. `status` partial: the
 * history was not read to its end yet, so all-time numbers are a lower bound.
 */
export interface OwnerTurnoverResponse {
  readonly meta: ResponseMeta;
  readonly status: 'checked' | 'partial';
  /** ISO 8601, UTC. */
  readonly asOf: string;
  readonly last24h: TurnoverWindowView;
  readonly last7d: TurnoverWindowView;
  readonly allTime: TurnoverWindowView;
  /** Why `wallets` is null in every window, with the message code; null when wallets are counted. */
  readonly walletsReason: { readonly code: string; readonly text: string } | null;
}

/** GET /v1/owner/metrics?from=&to= (owner key): every series for the days asked, in one answer. */
export interface OwnerMetricsResponse {
  readonly meta: ResponseMeta;
  readonly from: string;
  readonly to: string;
  readonly limits: {
    readonly heliusCreditsPerDay: number;
    readonly heliusCreditsPerMonth: number | null;
    readonly relayCallsPerWalletPerDay: number;
  };
  /** Every core series and every reported counter that has a value in the range, by name. */
  readonly series: Readonly<Record<string, readonly MetricPoint[]>>;
  readonly latency: readonly RouteLatency[];
}
