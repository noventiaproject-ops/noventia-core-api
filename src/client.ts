/**
 * A small client for the core API, version 1. Works wherever `fetch` exists: React Native, the
 * browser, Node 18 and later. No dependencies.
 *
 *   const core = createCoreClient({ baseUrl: 'https://<core API host>' });
 *   const token = await core.checkToken(mint);
 *
 * The passport calls need the app's key, which only the app's backend holds: never ship it in an
 * app bundle or a web page.
 */

import type { DoorCheckRequest, DoorCheckResponse, DoorsResponse, JoinCampaignRequest, JoinCampaignResponse, PublicCampaignsResponse } from './doors.js';
import type { TokenSearchResponse } from './search.js';
import type { HallResponse, KeepPioneerRequest, KeepPioneerResponse, PioneersResponse, RetirePioneerRequest, RetirePioneerResponse } from './pioneers.js';
import type { ApiError, ApiErrorCode, FoundResponse, HealthResponse, LinkWalletRequest, LinkWalletResponse, PassportRequest, PassportResponse, PrivacyRequest, PrivacyResponse, PublicCardResponse, UnlinkWalletRequest, UnlinkWalletResponse, RpcRequest, RpcResponse, RulesResponse, TokenCheckResponse, WalletCheckResponse, YourAirdropsRequest, YourAirdropsResponse } from './types.js';

export type CoreClientOptions = {
  /** Without a trailing slash, for example the mock server http://127.0.0.1:8788. */
  readonly baseUrl: string;
  /** The app's key, for the passport calls. Server side only. */
  readonly key?: string;
  readonly fetch?: typeof fetch;
  /** Gives up after this many milliseconds; the default is 20 seconds. */
  readonly timeoutMs?: number;
};

/** An answer that is not 2xx: the API's error code, or `network` when no answer came. */
export class CoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network',
    message: string,
    /** Seconds to wait before trying again, from a 429 or a 503 busy_today (Retry-After). */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'CoreApiError';
  }
}

export type FoundRequest = PassportRequest;

export function createCoreClient(options: CoreClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, withKey = false): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs ?? 20_000);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (withKey && options.key !== undefined) headers['authorization'] = `Bearer ${options.key}`;
    let res: Response;
    let json: unknown;
    try {
      res = await doFetch(`${base}${path}`, { method, headers, signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      // The body is read under the same timer: a body that stalls after the headers ends with the timeout too.
      json = await res.json().catch((err: unknown) => {
        if (controller.signal.aborted) throw err;
        return null;
      });
    } catch (err) {
      throw new CoreApiError(0, 'network', err instanceof Error ? err.message : 'No answer.');
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const e = (json as ApiError | null)?.error;
      const retry = Number(res.headers.get('retry-after'));
      throw new CoreApiError(res.status, e?.code ?? 'source_unavailable', e?.message ?? `HTTP ${String(res.status)}`, Number.isFinite(retry) && retry > 0 ? retry : null);
    }
    return json as T;
  }

  return {
    /** Facts and warnings for any address the user typed. No levels: those need the owner's consent. */
    checkWallet: (address: string) => call<WalletCheckResponse>('GET', `/v1/check/wallet/${encodeURIComponent(address)}`),
    /** "Can I trust this token before I buy it": facts and warnings, never "safe" or "unsafe". */
    checkToken: (mint: string) => call<TokenCheckResponse>('GET', `/v1/check/token/${encodeURIComponent(mint)}`),
    /** The passport of wallets their owner linked by signature: branches with EP and levels. Needs the app's key. */
    passport: (request: PassportRequest) => call<PassportResponse>('POST', '/v1/passport', request, true),
    /** "Found in your wallets": reclaimable rent and where each measured airdrop stands. Needs the app's key. */
    found: (request: FoundRequest) => call<FoundResponse>('POST', '/v1/passport/found', request, true),
    /** "Your airdrops" (1.5.0): for each measured programme, what the wallet claimed, did and what it was worth. Needs the app's key. */
    airdrops: (request: YourAirdropsRequest) => call<YourAirdropsResponse>('POST', '/v1/passport/airdrops', request, true),
    health: () => call<HealthResponse>('GET', '/v1/health'),
    /**
     * The cleanup RPC relay (1.2.0): one allowlisted JSON-RPC call, forwarded with the server's key.
     * The answer is the RPC's own, `result` or `error`. A sendTransaction must be fully signed; the
     * relay never signs. On `upstream_failed` the transaction may have gone through: check its
     * signature status instead of sending it again.
     */
    rpc: (request: RpcRequest) => call<RpcResponse>('POST', '/v1/rpc', request),
    /** GET /v1/rules (1.7.0): the rules the core applies, with versions, EP tables and thresholds. No key. */
    rules: () => call<RulesResponse>('GET', '/v1/rules'),
    /** POST /v1/passport/links (1.8.0): a wallet the holder linked by signing the link message; the core checks the signature again. Needs the app's key. */
    linkWallet: (request: LinkWalletRequest) => call<LinkWalletResponse>('POST', '/v1/passport/links', request, true),
    /** POST /v1/passport/links/remove (1.8.0). Needs the app's key. */
    unlinkWallet: (request: UnlinkWalletRequest) => call<UnlinkWalletResponse>('POST', '/v1/passport/links/remove', request, true),
    /** POST /v1/passport/privacy (1.8.0): open or close a branch on the public card, or the sharing switch. Needs the app's key. */
    setPrivacy: (request: PrivacyRequest) => call<PrivacyResponse>('POST', '/v1/passport/privacy', request, true),
    /** GET /v1/passport/card/{noventiaId} (1.8.0): the public card, no key. */
    publicCard: (noventiaId: string) => call<PublicCardResponse>('GET', `/v1/passport/card/${encodeURIComponent(noventiaId)}`),
    /** GET /v1/doors (1.9.0): the doors with their stage, and every open campaign. No key. */
    doors: () => call<DoorsResponse>('GET', '/v1/doors'),
    /** GET /v1/projects/public/{slug}/campaigns (1.9.0): one project's open campaigns. No key. */
    publicCampaigns: (slug: string) => call<PublicCampaignsResponse>('GET', `/v1/projects/public/${encodeURIComponent(slug)}/campaigns`),
    /** POST /v1/passport/doors/eligibility (1.9.0): the holder's own answer to a door's question, with the levels. Needs the app's key. */
    doorCheck: (request: DoorCheckRequest) => call<DoorCheckResponse>('POST', '/v1/passport/doors/eligibility', request, true),
    /** POST /v1/passport/doors/join (1.9.0): the holder joins a campaign; the answer is kept as the entry. Needs the app's key. */
    joinCampaign: (request: JoinCampaignRequest) => call<JoinCampaignResponse>('POST', '/v1/passport/doors/join', request, true),
    /** GET /v1/pioneers (1.10.0): the places, the taken count and the rule. No key; the sites read it at build time. */
    pioneers: () => call<PioneersResponse>('GET', '/v1/pioneers'),
    /** POST /v1/pioneers/keep (1.10.0): a Pioneer from before the core keeps the number with the Noventia ID. Needs the app's key. */
    keepPioneer: (request: KeepPioneerRequest) => call<KeepPioneerResponse>('POST', '/v1/pioneers/keep', request, true),
    /** POST /v1/pioneers/retire (1.10.0): a deleted account's number, never given again. Needs the app's key. */
    retirePioneer: (request: RetirePioneerRequest) => call<RetirePioneerResponse>('POST', '/v1/pioneers/retire', request, true),
    /** GET /v1/pioneers/hall (1.13.0): every Pioneer in number order and the retired numbers, for the app's Hall. Needs the app's key. */
    pioneerHall: () => call<HallResponse>('GET', '/v1/pioneers/hall', undefined, true),
    /** GET /v1/search/tokens?q= (1.14.0): the tokens the core has checked whose name or ticker matches, and the listed assets that match. No key. */
    searchTokens: (q: string) => call<TokenSearchResponse>('GET', `/v1/search/tokens?q=${encodeURIComponent(q)}`),
  };
}

export type CoreClient = ReturnType<typeof createCoreClient>;
