# @elizaos/plugin-msai-tools

Autonomous Web Scraping & Grounding Intelligence Suite for ElizaOS AI Agents powered by Apify and the x402 Base protocol.

## Features

- **CRAWL_WEBSITE_TO_MARKDOWN**: Extracts documentation, sitemaps, and deep pages into clean, token-efficient Markdown for character memory and synthesis.
- **SEARCH_GOOGLE_LIVE**: Real-time Google SERP organic search retrieval to ground agents in current facts.
- **SCRAPE_REDDIT_COMMUNITY**: Scrapes subreddits, threads, comments, and upvotes for sentiment and trend tracking.
- **Autonomous Settlement**: Supports micropayments via Base USDC (Chain ID 8453) directly to the settlement gateway.

## Installation

### In your ElizaOS Agent project:

```bash
bun add git+https://github.com/meanusarcanus/apify_m2m_gateway.git#main:eliza-plugin
# or
npm install git+https://github.com/meanusarcanus/apify_m2m_gateway.git#main:eliza-plugin
```

## Setup & Character Configuration

In your Eliza character file (e.g. `characters/agent.character.json`):

```json
{
  "name": "MarketResearcher",
  "plugins": [
    "@elizaos/plugin-msai-tools"
  ],
  "settings": {
    "secrets": {
      "MSAI_GATEWAY_URL": "https://apifym2mgateway.vercel.app"
    }
  }
}
```

Or programmatically in TypeScript:

```typescript
import { msaiToolsPlugin } from "@elizaos/plugin-msai-tools";

const runtime = new AgentRuntime({
  plugins: [msaiToolsPlugin],
  // ...
});
```
