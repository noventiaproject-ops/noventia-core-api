/**
 * Token search by name or ticker (1.14.0): among the tokens the core has checked, and the official
 * mint list. For the bots' "a new token with the same name appeared": compare the mints of two
 * searches, `firstSeenAt` says which are new. Never a wallet, never a score.
 */
import type { ResponseMeta } from './types.js';

/** One token the core has checked whose name or ticker matches. */
export interface TokenSearchMatch {
  readonly mint: string;
  /** Escaped chain text, as the token check shows it; null when the token has no metadata. */
  readonly name: string | null;
  readonly symbol: string | null;
  readonly standard: 'metaplex' | 'token-2022' | null;
  /** ISO 8601, UTC: when the core first saw the mint, and last checked it. */
  readonly firstSeenAt: string;
  readonly lastCheckedAt: string;
  /** `listed`: this is a listed asset's own mint. `copy`: it uses a listed name or ticker under another mint. Null otherwise. */
  readonly official: 'listed' | 'copy' | null;
  /** The listed asset it is, or copies. */
  readonly listed: { readonly ticker: string; readonly name: string; readonly mint: string; readonly issuer: string } | null;
}

/** A listed asset whose ticker or name matches, checked by the core or not. */
export interface TokenSearchListed {
  readonly ticker: string;
  readonly name: string;
  readonly mint: string;
  readonly issuer: string;
  readonly checked: boolean;
}

/** GET /v1/search/tokens?q=<text> (1.14.0): no key. `q` is 2 to 64 characters, folded before matching. */
export interface TokenSearchResponse {
  readonly meta: ResponseMeta;
  /** The text searched, escaped. */
  readonly query: string;
  /** Always `checked_by_noventia`: the matches are among the tokens the core has checked, never all tokens. */
  readonly scope: 'checked_by_noventia';
  /** At most 20, listed assets first, then the newest first seen. */
  readonly matches: readonly TokenSearchMatch[];
  readonly listed: readonly TokenSearchListed[];
}
