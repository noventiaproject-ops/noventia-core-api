# @noventia/core-api

Types and a small client for the Noventia core API, version 1. Pure TypeScript with no dependencies. It runs in React Native, in the browser and in Node 18 or later.

The API answers with facts, each carrying its proof: a Solana transaction, or an account and the slot it was read at. It also gives four warning levels. It never gives a single score, and never says "safe" or "unsafe". EP and levels exist only per branch, and only for wallets their owner linked to a passport.

## Install

Pin a tag:

```json
"@noventia/core-api": "github:noventiaproject-ops/noventia-core-api#v1.1.0"
```

The package ships TypeScript source. Expo and Metro compile it as they are. In Next.js, add it to `transpilePackages`.

## Use

```ts
import { createCoreClient, CoreApiError, type TokenCheckResponse } from '@noventia/core-api';

const core = createCoreClient({ baseUrl: 'https://<core API host>' });

const token: TokenCheckResponse = await core.checkToken(mint);
const wallet = await core.checkWallet(address);
```

| Call | Key | Answer |
|---|---|---|
| `checkWallet(address)` | none | Facts and warnings for any address: age, first transaction, tokens launched and their first days, the airdrop record, the "Looks automated" flag. No EP, no level. |
| `checkToken(mint)` | none | Token facts (authorities, Token-2022 extensions, age, holder concentration, name and ticker escaped), the official asset it is or copies, the creator's record, warnings. |
| `passport({ wallets, noventiaId })` | the app's key | Branch standings with EP and levels, for wallets their owner linked by signature. |
| `found({ wallets })` | the app's key | Rent reclaimable from empty token accounts, each account with its proof. |
| `health()` | none | Service state. |

The passport calls need the app's key. Only the app's backend holds it: never ship it in an app bundle or a web page.

Errors arrive as `CoreApiError`, which carries `status`, `code` and `retryAfter`. `code` is the API's code (`invalid_address`, `not_a_wallet`, `too_many_wallets`, `unauthorized`, `not_found`, `rate_limited`, `busy_today`, `source_unavailable`), or `network` when no answer came.

* `rate_limited` (429): too many calls or new wallets from this client. `retryAfter` is the wait in seconds.
* `busy_today` (503): today's reading budget or cap on new wallets is used up. `retryAfter` is the wait until 00:00 UTC. A wallet read before still answers, with `meta.cache: "stale"`.
* `source_unavailable` (502 or 503): the chain read failed or the service is restarting. No `retryAfter`.

## Rules every answer keeps

* No total across branches: EP and levels sit inside a branch standing only.
* No level without the owner's consent: the wallet check, the token check and `found` carry none.
* No fact without a proof.
* No raw chain text. A token's name and ticker arrive HTML-escaped, with invisible characters removed. Put them in a page as text, never as HTML.
* Answers marked `meta.example` are example data, so show them as such.

## Versions

Version 1 only grows: new optional fields, never a renamed or removed one. A breaking change would be a new major version and a new path, `/v2`.

* **1.1.0:** the error code `busy_today`; `meta.cache` can be `"stale"`; the wallet check has optional `notices`, today one kind, `solana.lookalikeDust` (dust from addresses that look like the wallet's counterparties). Retry-After is the real wait on 429.
* **1.0.0:** the first version.
