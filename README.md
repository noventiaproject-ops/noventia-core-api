# @noventia/core-api

Types and a small client for the Noventia core API, version 1. Pure TypeScript with no dependencies. It runs in React Native, in the browser and in Node 18 or later.

The API answers with facts, each carrying its proof: a Solana transaction, or an account and the slot it was read at. It also gives four warning levels. It never gives a single score, and never says "safe" or "unsafe". EP and levels exist only per branch, and only for wallets their owner linked to a passport.

## Install

Pin a tag:

```json
"@noventia/core-api": "github:noventiaproject-ops/noventia-core-api#v1.26.0"
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
| `rpc(request)` | none | The cleanup RPC relay (1.2.0): one JSON-RPC 2.0 call from the allowlist `RPC_METHODS`, forwarded with the server's key. The RPC's own answer, `result` or `error`. A `sendTransaction` must be fully signed; the relay never signs. |

The passport calls need the app's key. Only the app's backend holds it: never ship it in an app bundle or a web page.

Errors arrive as `CoreApiError`, which carries `status`, `code` and `retryAfter`. `code` is the API's code (`invalid_address`, `not_a_wallet`, `too_many_wallets`, `unauthorized`, `not_found`, `rate_limited`, `busy_today`, `source_unavailable`, `method_not_allowed`, `invalid_rpc`, `upstream_failed`, `origin_not_allowed`), or `network` when no answer came.

* `rate_limited` (429): too many calls or new wallets from this client. `retryAfter` is the wait in seconds.
* `busy_today` (503): today's reading budget or cap on new wallets is used up. `retryAfter` is the wait until 00:00 UTC. A wallet read before still answers, with `meta.cache: "stale"`.
* `source_unavailable` (502 or 503): the chain read failed or the service is restarting. No `retryAfter`.
* `method_not_allowed` (403) and `invalid_rpc` (400), the relay: the method is off the allowlist, or the call has the wrong shape, or the transaction is not fully signed. Nothing was forwarded.
* `upstream_failed` (502), the relay: the call was forwarded and the RPC did not answer. A sent transaction may still have reached the network: check its signature status, never send it again.
* `origin_not_allowed` (403): the request came from a browser page whose origin is not allowed. Nothing was done.

## Rules every answer keeps

* No total across branches: EP and levels sit inside a branch standing only.
* No level without the owner's consent: the wallet check, the token check and `found` carry none.
* No fact without a proof.
* No raw chain text. A token's name and ticker arrive HTML-escaped, with invisible characters removed. Put them in a page as text, never as HTML.
* Answers marked `meta.example` are example data, so show them as such.

## Versions

Version 1 only grows: new optional fields, never a renamed or removed one. A breaking change would be a new major version and a new path, `/v2`.

* **1.26.0:** the owner's page, wallets: `GET /v1/owner/wallets` (owner key; `OwnerWalletsResponse`: for the fee wallet and the treasury the SOL balance, the wrapped SOL and USDC token accounts (exists or not, balance), and what came in over the last 24 hours and 7 days split into swap fees, reclaim fees and other). Read only. `METRIC_COUNTERS` gains `app.swaps_no_fee`. No field removed.
* **1.25.1:** a warning is made only from what was read: `TokenCheckResponse.creatorRead.history` (`not_read`, `in_part`, `complete`; type `CreatorReadStatus`) says how much of the creator's history stands behind the creator warnings. `youngWallet` is made only from the wallet's first transaction and `fewLaunches` only from a complete history, in the token check and in the wallet check; with `not_read` show "Not read yet", with `in_part` "Read in part". No field removed.
* **1.25.0:** the owner's page: `GET /v1/owner/totals` (owner key; `OwnerTotalsResponse`: projects, lists created and checked, campaigns, campaign joins, and what the fee wallet received over its whole history) and three reported states in `METRIC_COUNTERS`: `telegram.chats`, `telegram.groups_protected`, `discord.servers` (the bot's state when it reports: read the latest day, never add days up). No field removed.
* **1.24.1:** words only: two sentences of `GET /v1/recognized` reworded, and a note that a holder with the role `source` keeps `sharePct`. No type changed.
* **1.24.0:** the list graph shows what the list check found: `FundingNode.labels` (a wallet of the list, once the list is done), `FundingNode.clusterId` and `evidence` (the source of a cluster), and `ListFundingGraphResponse.outsideList` (per cluster: the wallets outside the list its source also sent SOL to inside the window, as transactions with no address). `ClusterView.offList` is filled from one read of the funder's window and gains `transfers` and `read`. No field removed.
* **1.23.0:** what the core recognizes (`recognized.ts`): `GET /v1/recognized` (no key; `RecognizedResponse`: the versioned lists of exchange wallets, launchpads, lockers, bridges and programs, each entry with its source and what the core does with it). `GraphInfrastructure.kind` gains `bridge`. No field removed.
* **1.22.1:** report amounts carry their unit: `LiveReportResponse.token` (symbol, decimals) and `amounts` (`AmountView` for claimed and unclaimed); `population.claimed`, `unclaimed` and every metric in `tokens` are whole tokens with the decimals applied (a report stored in the smallest unit is converted when read). No field removed.
* **1.22.0:** the funding graph (`graph.ts`): `GET /v1/projects/{id}/lists/{listId}/graph` (the project's session; `ListFundingGraphResponse`: nodes with roles `source`, `funded`, `independent`, `infrastructure`, edges with the amount as `AmountView`, the transaction and the block time, the known event times) and `GET /v1/graph/token/{mint}` (no key; `TokenFundingGraphResponse`: the largest holders' first fundings as aggregates with short addresses only, no transaction). No field removed.
* **1.21.2:** the one-signal cluster label is evidence, not a verdict: `ListLabel.evidence` and `ClusterView.evidence` (`EvidenceLevel`: `some` today), `LABEL_TEXT.farm_cluster` reads "Funded by one source: some evidence", the exclusions file gains an `evidence` column. No field removed.
* **1.21.1:** `app.sign_ups` (accounts created that UTC day) added to `METRIC_COUNTERS` for the app's backend. No field removed.
* **1.21.0:** the owner's private stats dashboard, the data side (`metrics.ts`): `POST /v1/metrics/ingest` (the app key or a bot key; `MetricsIngestRequest`, counters from `METRIC_COUNTERS` under the key's own prefix, the day's running total, sending again replaces it) and `GET /v1/owner/metrics?from=&to=` (owner key; `OwnerMetricsResponse`: every series as daily points, the latency per route, the plan limits). Daily aggregates only: no wallet, no Noventia ID, no email. No field removed.
* **1.20.0:** the projects cabinet's open points: `GET /v1/projects/{id}/distributions/{distributionId}`; `DistributionView.token` (symbol and decimals, read once at creation); `CampaignPublicView.closedAt`; `report_not_ready` (409, with `details.day`) instead of `list_not_ready` on a report; every create or join refusal names its field in `error.details.field`; a distribution's linked list must be done (`list_not_ready`, `details.field: listId`). CORS allows DELETE. No field removed.
* **1.19.0:** the app's campaign screen (`doors.ts`): `holderCampaigns(request)` (`POST /v1/passport/doors/campaigns`, app key): every open campaign and every campaign the holder joined, closed ones included, each with the holder's own eligibility and entry; `CampaignPublicView.projectWords` (the project's own words, plain text; `CreateCampaignRequest.description` and `reward`); `JoinCampaignRequest.payoutWallet` (one of the holder's linked wallets); `HolderEntryView`. The project's `CampaignEntryView` names an `entrant` pseudonym and the `payoutWallet` instead of the Noventia ID: the contract's one removal (`holderId`), for the person's privacy (owner, 8 November 2026). `error.details.field` names the field a create or a join refused.
* **1.18.0:** several wallets per passport, for the app: `POST /v1/passport/links/keep` (`KeepLinkRequest`, app key) carries over a link the app kept before the core did, proof `app-record`; `LinkWalletRequest.proofKind: "sign-in"` accepts the app's own Sign In With Solana message as the proof for the holder the app names; `MAX_LINKED_WALLETS` (10) exported. One wallet belongs to one holder: 409 `already_linked` while another Noventia ID holds it. No field removed.
* **1.17.0:** Noventia for Projects sign in for a subject whose authorities are revoked: `ProjectChallengeRequest.kind` with the new `AuthorityKind` values `deployer` (the wallet that signed the token's creation) and `manual_review` (a wallet the team approved); `AuthorityProofView.transaction` and `reviewId`; `requestReview(body)` and `review(reviewId)` (`POST /v1/projects/reviews`, `GET /v1/projects/reviews/{reviewId}`, no key); error codes `review_pending`, `review_declined`, `authority_held_by_wallet`, `authority_held_by_unknown_program`, `not_creator`; `ApiError.error.details` (optional) names the authority and the wallet, holder or creator behind a refusal. No field removed.
* **1.16.0:** Telegram and Discord links (`links.ts`): `linkCode`, `confirmLink`, `unlink`, `links`, `setLinkAlerts` for the app's backend; `confirmLink`, `unlink`, `linkEvents` and `linkPioneers` for the bots with their own keys (scopes `telegram`, `discord`). Events `claimWindowClosing`, `newCampaign`, `levelReached`, `unlinked`; Pioneer changes for Discord. Error codes `code_expired`, `code_used`, `wrong_channel`, `already_linked`. No field removed.
* **1.15.0:** `TokenCheckResponse.creatorShare`: the creator's share of the supply at launch and at 1 hour, 24 hours, 7 days, 30 days and now, from the creator's own movements, each checkpoint with its transactions; `not_reached` and `unknown` checkpoints said as such; null on a listed asset's own mint. No warning comes from it. No field removed.
* **1.14.0:** `searchTokens(q)` (GET /v1/search/tokens?q=, no key): the tokens the core has checked whose name or ticker matches, each with its mint, escaped name and ticker, when the core first saw it and last checked it, and whether it is a listed asset or a copy; the listed assets that match, checked or not. `scope: "checked_by_noventia"`, never all tokens, no score. No field removed.
* **1.13.0:** `pioneerHall()` (GET /v1/pioneers/hall, app key): every Pioneer in number order with the public id, the status and the date, and the retired numbers. `retirePioneer()` takes the Noventia ID with the number: a held number is retired for its own holder, whose status ends; `RetirePioneerResponse.holder`. No field removed.
* **1.12.0:** `TokenCheckResponse.creatorRead`: how far the creator's history was read (`checked` with the coverage limit as the reason), or `not_checked` with `listed_asset` on a listed asset's own mint, where no creator history is read at all. No field removed.
* **1.11.0:** the token check on a listed asset's own mint: no creator warning, the top holders' share an `issuerPowers` entry with `power: "concentration"` and its text, never a warning; `official.listVersion`, the version of the official mint list. Nothing else changes; a copy of a listed name or ticker keeps every warning.
* **1.10.0:** Pioneers (`pioneers.ts`): `PIONEER_PLACES` (250, the one value the app and the sites read), `pioneers()` (GET /v1/pioneers: the places, the taken count and the rule), `keepPioneer()` and `retirePioneer()` for the app's backend; `PassportResponse.pioneer` (the number, the status, the seal) and `PublicCardResponse.pioneer` (the number and the status). No field removed.
* **1.9.0:** the doors (`doors.ts`): `doors()` (GET /v1/doors: the six doors with their stage and every open campaign), `publicCampaigns(slug)`, `doorCheck()` (the holder's own eligibility to a question, with the levels), `joinCampaign()` (the holder joins a campaign, the answer kept as the entry); a project's campaigns under `/v1/projects/{id}/campaigns` (create, list, one, close, entries). `PrivacyRequest.projectId` opens a branch to one project; `PrivacyResponse.grantee`. The error codes `campaign_closed` and `campaign_full`. No field removed.
* **1.8.0:** the core keeps the wallet links: `linkWallet()` (POST /v1/passport/links, the signed link message checked again by the core), `unlinkWallet()`, `setPrivacy()` (POST /v1/passport/privacy: a branch opened or closed on the public card, the sharing switch; private by default), `publicCard()` (GET /v1/passport/card/{noventiaId}, no key: the opened branches with level and seals, never a wallet, a fact or EP). `POST /v1/passport` may leave `wallets` out when `noventiaId` is given, and answers `holder`, `privacy`, `sharing` and `views` when the core knows the holder. No field removed.
* **1.7.0:** `BranchStanding.seals` (the level seals L1 to L5 as the branch earned them), `Freeze.appealUrl` and `Freeze.caseStatus`, `GET /v1/rules` with `RulesResponse` and the client's `rules()`, the passport appeal with `caseId` for the case behind a freeze, the appeal statuses `case_kept` and `case_released`. A frozen branch answers `level: null` until its case is decided, its EP kept. No field removed.
* **1.6.0:** a transaction proof may carry `slot`, the slot the transaction was confirmed in, when the core had the transaction in hand (data model version 2). No other change.
* **1.5.1:** `GET /v1/health` answers status only; `credits` is no longer sent (the balance is private to the owner). No field removed from the type.
* **1.5.0:** `airdrops()`, `POST /v1/passport/airdrops`: "Your airdrops" for linked wallets, per measured programme what the wallet claimed, did and what it was worth, with the price source and time, an open window it has not claimed from, and the data of the shareable Airdrop Record card. No EP, no level.
* **1.4.1:** the client's timeout covers the response body too (a body that stalls after the headers ends with the timeout); `coverage.limitedBy` is `"daily_cap"` also when the product's share of the day's credits stopped a read after at least one page, and what was read is kept and answered. No new field.
* **1.4.0:** Noventia for Projects (`projects.ts`, every type under `/v1/projects` and the passport's `labels` and `appeals` calls): sign in with the authority wallet (Sign In With Solana) or a Firebase Auth email link, the team, list checks with labels that carry proofs (`ListLabel`, `ClusterView`, the exclusions file), appeals, the live report after a distribution (`LiveReportResponse`), the public page and badge; the error codes `not_a_member`, `not_authority`, `no_authority`, `challenge_expired`, `invalid_signature`, `session_expired`, `forbidden_role`, `list_too_large`, `quota_exceeded`, `list_not_ready`. The engine's mock answers every call from a demo project.
* **1.3.0:** `coverage.limitedBy` can be `"daily_cap"`: the day's credits for this wallet are spent, the answer holds what was read so far (`readFrom` says since when), and the rest is read on the following days until the history is complete. With no facts yet, show "Still reading your history, more tomorrow"; with facts, "since at least <readFrom>".
* **1.2.1:** the error code `origin_not_allowed`: a request with a foreign `Origin` is refused before anything is done.
* **1.2.0:** `rpc()`, the cleanup RPC relay: `RPC_METHODS`, `RpcRequest`, `RpcResponse`, and the codes `method_not_allowed`, `invalid_rpc`, `upstream_failed`.
* **1.1.0:** the error code `busy_today`; `meta.cache` can be `"stale"`; the wallet check has optional `notices`, today one kind, `solana.lookalikeDust` (dust from addresses that look like the wallet's counterparties). Retry-After is the real wait on 429.
* **1.0.0:** the first version.
