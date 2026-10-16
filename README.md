# MSAI Apify M2M Autonomous Gateway

An autonomous, machine-to-machine (M2M) monetization gateway powered by the **x402 protocol** and **Base USDC micropayments**, wrapping your **17 Apify Scraper Actors** into direct revenue streams for AI agents, research swarms, and Claude/Cursor tools.

---

## ⚡ Why This Unlocks Immediate Profitability

1. **Bypasses Apify Store Friction**: External AI agents (Claude, Cursor, LangChain, Base agents) cannot create an Apify account, verify emails, or input credit cards. This gateway allows them to buy directly via **Base USDC micropayments** in milliseconds.
2. **Zero Apify 20% Marketplace Fee**: 100% of the USDC paid by buyer agents settles directly into your designated crypto wallet.
3. **80%–95% Net Margins**: Running a targeted Apify actor run costs fractions of a cent; you charge \$0.005–\$0.02 USDC per query.
4. **Instant Distribution via MCP**: Includes a Model Context Protocol (MCP) server so users and agents on Claude Desktop and Cursor can invoke all 17 tools directly.

---

## 📋 The 17 Monetized Apify Scrapers

| Tool / Actor | Endpoint | Price (USDC on Base) | Best For |
| :--- | :--- | :--- | :--- |
| **Deep Markdown Crawler** | `POST /api/v1/crawl` | **\$0.010** | RAG pipelines, documentation scraping, LLM fine-tuning datasets |
| **Google Search Scraper** | `POST /api/v1/google/search` | **\$0.005** | Real-time agent search grounding & SERP data |
| **Reddit Sentiment Scraper** | `POST /api/v1/reddit/search` | **\$0.005** | Community sentiment, meme discovery, product feedback |
| **TikTok Trends Scraper** | `POST /api/v1/tiktok/trending` | **\$0.008** | Viral sound/hashtag trends and video metrics |
| **YouTube Shorts Scraper** | `POST /api/v1/youtube/shorts` | **\$0.008** | Video transcripts, engagement stats, audio details |
| **Instagram Profile Scraper** | `POST /api/v1/instagram/profile` | **\$0.008** | Public bio, follower count, reels engagement |
| **Autonomous Instagram Poster**| `POST /api/v1/instagram/publish` | **\$0.015** | Autonomous agent social publishing |
| **B2B Lead Enricher** | `POST /api/v1/b2b/leads` | **\$0.020** | Executive contact details, verified domains, tech stacks |
| **LinkedIn Company Scraper** | `POST /api/v1/linkedin/company` | **\$0.020** | Headcount growth, company hiring intelligence |
| **Amazon Bestsellers Scraper** | `POST /api/v1/amazon/bestsellers` | **\$0.010** | E-commerce bestseller ranking & price monitoring |
| **E-Commerce Price Tracker** | `POST /api/v1/ecommerce/track-price` | **\$0.010** | Multi-retailer product price alerts |
| **Shopee Scraper** | `POST /api/v1/shopee/search` | **\$0.010** | Southeast Asia product reviews and listings |
| **Phone Validator & Carrier** | `POST /api/v1/phone/validate` | **\$0.002** | E.164 phone verification & carrier type |
| **GitHub Intelligence** | `POST /api/v1/github/analyze` | **\$0.010** | Repository velocity, PR health, developer stats |
| **Google Maps Places Scraper** | `POST /api/v1/maps/places` | **\$0.015** | Local business directories, ratings, addresses |
| **SmartScrape AI Extractor** | `POST /api/v1/scrape/smart` | **\$0.010** | Schema-guided AI web extraction |
| **Review Sentiment Analyzer** | `POST /api/v1/reviews/analyze` | **\$0.005** | Feature extraction & sentiment breakdown |

---

## 🛠️ Configuration (`.env`)

Copy `.env.example` to `.env` and set your credentials:

```bash
# Your live Apify API Token (found in Apify Console -> Settings -> Integrations)
APIFY_API_TOKEN=apify_api_...

# Your Base wallet address where USDC earnings will accrue
MERCHANT_WALLET_ADDRESS=0xYourMerchantBaseWalletAddress

# Server Port (default 3000)
PORT=3000
```

---

## 🚀 Running the Gateway

```bash
# 1. Start the x402 HTTP Gateway Server
bun run src/server.ts

# 2. View the machine-readable catalog
curl http://localhost:3000/api/v1/catalog
```

---

## 🤖 Model Context Protocol (MCP) Integration for Claude / Cursor

To make your 17 scrapers available to Claude Desktop, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "msai-scrapers": {
      "command": "bun",
      "args": ["run", "/home/theo/Webpage/Projects/MSAI/apify_m2m_gateway/src/mcp-server.ts"],
      "env": {
        "APIFY_API_TOKEN": "your_apify_token_here"
      }
    }
  }
}
```

---

## 🧪 Testing & Verification

Run the automated test suite:

```bash
bun test
```

Run the autonomous agent buyer demonstration:

```bash
bun run demo
```
