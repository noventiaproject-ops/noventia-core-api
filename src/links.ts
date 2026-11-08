/**
 * Linking Telegram and Discord to a passport (1.16.0). The app's backend asks the core for a
 * one-time code and shows it to the person; the person gives it to the bot; the bot confirms it
 * with its own key. From then on the Telegram bot reads the events the person chose in the app, and
 * the Discord bot reads Pioneer changes for the accounts linked to it.
 *
 * The core keeps the Noventia ID, the channel, the bot's id of the person and the times, nothing
 * else: no handle, no chat text. The app never sees the external id, a bot never sees a wallet, and
 * a level reaches a chat only through a link the person confirmed and an alert kind they turned on.
 */
import type { DoorId } from './doors.js';
import type { BranchId, LevelNumber, ResponseMeta } from './types.js';

export type LinkChannel = 'telegram' | 'discord';
export const LINK_CHANNELS: readonly LinkChannel[] = ['telegram', 'discord'];

/** What a Telegram link can receive. `unlinked` is always sent; the other three are the person's choice. */
export type LinkEventKind = 'claimWindowClosing' | 'newCampaign' | 'levelReached' | 'unlinked';
export type LinkAlertKind = Exclude<LinkEventKind, 'unlinked'>;
export const LINK_ALERT_KINDS: readonly LinkAlertKind[] = ['claimWindowClosing', 'newCampaign', 'levelReached'];
/** On until the person turns it off: a claim window closing. The other two are off until turned on. */
export const DEFAULT_LINK_ALERTS: readonly LinkAlertKind[] = ['claimWindowClosing'];

/** POST /v1/links/codes (app key). */
export interface LinkCodeRequest {
  readonly noventiaId: string;
  readonly channel: LinkChannel;
}

export interface LinkCodeResponse {
  readonly meta: ResponseMeta;
  /** 12 characters, A to Z and 2 to 7, single use, valid ten minutes; a new code replaces the old one. */
  readonly code: string;
  readonly channel: LinkChannel;
  /** ISO 8601, UTC. */
  readonly expiresAt: string;
  /** Telegram only: `https://t.me/<bot>?start=<code>`. */
  readonly deepLink?: string;
}

/** POST /v1/links/confirm (the bot's own key, whose channel is the one in the body). */
export interface ConfirmLinkRequest {
  readonly code: string;
  readonly channel: LinkChannel;
  /** The bot's id of the person: a Telegram user id, a Discord user id. 1 to 64 letters, digits, dashes or underscores. */
  readonly externalId: string;
}

export interface ConfirmLinkResponse {
  readonly meta: ResponseMeta;
  readonly linkId: string;
  readonly linkedAt: string;
  readonly alerts: readonly LinkAlertKind[];
}

/**
 * POST /v1/links/unlink. The app's backend: `{ noventiaId, linkId }`, or `{ noventiaId }` alone for
 * every link of the account (account deletion). A bot: `{ channel, externalId }`.
 */
export type UnlinkRequest = { readonly noventiaId: string; readonly linkId?: string } | { readonly channel: LinkChannel; readonly externalId: string };

export interface UnlinkResponse {
  readonly meta: ResponseMeta;
  /** True when a live link ended. */
  readonly unlinked: boolean;
  readonly count: number;
}

/** One link as the app sees it: no external id. */
export interface LinkView {
  readonly linkId: string;
  readonly channel: LinkChannel;
  readonly linkedAt: string;
  readonly alerts: readonly LinkAlertKind[];
}

/** GET /v1/links?noventiaId= (app key). */
export interface LinksResponse {
  readonly meta: ResponseMeta;
  readonly noventiaId: string;
  readonly links: readonly LinkView[];
}

/** POST /v1/links/alerts (app key): the kinds that reach this link from now on. */
export interface LinkAlertsRequest {
  readonly noventiaId: string;
  readonly linkId: string;
  readonly alerts: readonly LinkAlertKind[];
}

export interface LinkAlertsResponse {
  readonly meta: ResponseMeta;
  readonly linkId: string;
  readonly alerts: readonly LinkAlertKind[];
}

export interface LinkEventBase {
  /** The cursor: digits, rising. */
  readonly eventId: string;
  readonly linkId: string;
  readonly externalId: string;
  /** ISO 8601, UTC. */
  readonly at: string;
}

/** A claim window the passport's wallets may still use ends within 48 hours. Once per programme and link. */
export interface ClaimWindowClosingEvent extends LinkEventBase {
  readonly kind: 'claimWindowClosing';
  readonly programme: string;
  readonly name: string;
  readonly token: string;
  readonly windowEnds: string;
  readonly source: string;
}

/** An open campaign the passport is eligible for. Once per campaign and link; only when the person turned the kind on. */
export interface NewCampaignEvent extends LinkEventBase {
  readonly kind: 'newCampaign';
  readonly campaignId: string;
  readonly project: { readonly slug: string; readonly name: string };
  readonly name: string;
  readonly door: DoorId;
}

/** The person's own branch reached a level above the one last seen. Only when the person turned the kind on. */
export interface LevelReachedEvent extends LinkEventBase {
  readonly kind: 'levelReached';
  readonly branch: BranchId;
  readonly level: LevelNumber;
}

/** The person unlinked in the app, a bot unlinked, or the account was deleted. The bot drops what it kept. */
export interface UnlinkedEvent extends LinkEventBase {
  readonly kind: 'unlinked';
}

export type LinkEvent = ClaimWindowClosingEvent | NewCampaignEvent | LevelReachedEvent | UnlinkedEvent;

/** GET /v1/links/events?channel=telegram&after=<cursor> (the bot's key): oldest first, at most 100, kept seven days. */
export interface LinkEventsResponse {
  readonly meta: ResponseMeta;
  readonly channel: LinkChannel;
  /** Pass it back as `after`. The same as the one given when nothing new came. */
  readonly cursor: string;
  readonly events: readonly LinkEvent[];
}

/**
 * One Pioneer change of a linked Discord account: `pioneer` true with the number while the status is
 * active; false before the rule is met, while suspended, after a retirement, and when the link ends.
 */
export interface PioneerChangeView {
  readonly linkId: string;
  readonly externalId: string;
  readonly pioneer: boolean;
  readonly number?: number;
  readonly at: string;
}

/** GET /v1/links/pioneers?after=<cursor> (the Discord bot's key): oldest first, at most 100. */
export interface PioneerChangesResponse {
  readonly meta: ResponseMeta;
  readonly cursor: string;
  readonly changes: readonly PioneerChangeView[];
}

/**
 * The link errors (1.16.0): `code_expired` (410: unknown, replaced or past ten minutes), `code_used`
 * (409), `wrong_channel` (400: the code was made for the other channel), `already_linked` (409: the
 * account or the passport has a live link on this channel).
 */
export type LinkErrorCode = 'code_expired' | 'code_used' | 'wrong_channel' | 'already_linked';
