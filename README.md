# n8n-nodes-comdirect

This is an n8n community node. It lets you read accounts, depots and PostBox documents from [comdirect](https://www.comdirect.de/) in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.


[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- **Account**
	- Get Balance — single account by ID
	- Get Many Balances — all linked accounts
	- Get Many Transactions — with date and direction filters, paged
- **Depot**
	- Get Many — list all depots
	- Get Many Positions — positions held in a depot
	- Get Position — single position by depot + position ID
	- Get Many Transactions — with WKN/ISIN and date filters, paged
- **Document** (PostBox)
	- Get Many — list documents
	- Get — download a single document as binary PDF

Order placement, quote requests, instrument lookup and aggregated reports are out of scope for v0.1.

## Credentials

This node uses a single **comdirect API** credential.

### Prerequisites

1. **Register for API access** at [comdirect's developer portal](https://www.comdirect.de/cms/kontakt-zugaenge-api.html). comdirect issues you a personal `client_id` and `client_secret`.
2. **Activate photoTAN-Push** on your comdirect account. This node only supports photoTAN-Push because it's the only TAN method that doesn't require typing a code mid-flow. SMS-TAN and manual photoTAN are not supported.

### Setup

In n8n, create a new **comdirect API** credential with:

- **Client ID** / **Client Secret** — from the developer portal
- **Zugangsnummer** — your 8-digit comdirect customer number
- **PIN** — your 6-digit online-banking PIN

When you save the credential, comdirect sends a photoTAN-Push notification to your phone. **Open the comdirect photoTAN app and approve the request within ~50 seconds.** Once approved, the credential persists the resulting session tokens and your subsequent workflow runs are unattended.

### Refresh window

comdirect's session tokens have a sliding 20-minute idle expiry: every authenticated request resets the timer. Workflows that fire more often than every 20 minutes will never trigger a re-bootstrap. If the window does lapse (long idle period, n8n restart with stale tokens, etc.), the node will surface a clear error — re-open and re-save the credential to re-authenticate via photoTAN-Push.

## Compatibility

Compatible with n8n 1.60.0 or later.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [comdirect REST API portal](https://www.comdirect.de/cms/kontakt-zugaenge-api.html)
- [comdirect REST API specification (PDF)](https://kunde.comdirect.de/cms/media/comdirect_REST_API_Dokumentation.pdf)
