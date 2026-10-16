import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { generatePrivateKey } from "viem/accounts";
import { ApifyM2MGatewayServer } from "../src/server.js";
import { X402AgentClient, X402_HEADER_PAYMENT_REQUIRED, X402_HEADER_PAYMENT } from "../src/x402-core.js";
import { APIFY_ACTORS, CONFIG } from "../src/config.js";

describe("MSAI Apify M2M Autonomous Gateway", () => {
  let server: ApifyM2MGatewayServer;
  let serverPort: number;
  let baseUrl: string;

  // Autonomous agent test wallet
  const agentPrivateKey = generatePrivateKey();
  const agent = new X402AgentClient({
    privateKey: agentPrivateKey,
    maxAutoPayAmount: 0.10, // Max 0.10 USDC per call limit
  });

  beforeAll(async () => {
    server = new ApifyM2MGatewayServer();
    serverPort = await server.listen(0); // Listen on random available port
    baseUrl = `http://127.0.0.1:${serverPort}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it("1. Catalog endpoint lists all 17 Apify Scrapers with prices and endpoints", async () => {
    const res = await fetch(`${baseUrl}/api/v1/catalog`);
    expect(res.status).toBe(200);

    const catalog = await res.json();
    expect(catalog.totalActors).toBe(17);
    expect(catalog.protocol).toBe("x402");
    expect(catalog.network).toBe("base");
    expect(catalog.actors.length).toBe(17);

    // Verify key actors are present
    const ids = catalog.actors.map((a: any) => a.id);
    expect(ids).toContain("markdown-crawler");
    expect(ids).toContain("google-search");
    expect(ids).toContain("reddit-scraper");
    expect(ids).toContain("tiktok-scraper");
    expect(ids).toContain("b2b-lead-enricher");
  });

  it("2. Unpaid request to protected scraper endpoint returns HTTP 402 with payment demand", async () => {
    const res = await fetch(`${baseUrl}/api/v1/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://docs.anthropic.com" }),
    });

    expect(res.status).toBe(402);
    const demandHeader = res.headers.get(X402_HEADER_PAYMENT_REQUIRED);
    expect(demandHeader).toBeTruthy();

    const demand = JSON.parse(demandHeader!);
    expect(demand.amount).toBe(APIFY_ACTORS["markdown-crawler"].priceUSDC);
    expect(demand.recipient.toLowerCase()).toBe(CONFIG.merchantWallet.toLowerCase());
    expect(demand.network).toBe("base");
    expect(demand.nonce).toMatch(/^x402_/);
  });

  it("3. Autonomous Agent with wallet catches 402, signs payment, and receives scraped data", async () => {
    const res = await agent.fetch(`${baseUrl}/api/v1/google/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "agentic payments x402" }),
    });

    expect(res.status).toBe(200);
    const responseData = await res.json();
    expect(responseData.status).toBe("success");
    expect(responseData.actor).toBe("google-search");
    expect(responseData.data).toBeTruthy();

    // Verify payment receipt
    expect(res.paymentReceipt).toBeTruthy();
    expect(res.paymentReceipt?.status).toBe("verified");
    expect(res.paymentReceipt?.amount).toBe("0.005");
    expect(res.paymentReceipt?.payer.toLowerCase()).toBe(agent.address.toLowerCase());
  });

  it("4. Replay attack rejection: Re-using the same payment signature fails", async () => {
    // 1. Get 402 challenge
    const res1 = await fetch(`${baseUrl}/api/v1/reddit/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subreddit: "artificial" }),
    });
    expect(res1.status).toBe(402);
    const demand = JSON.parse(res1.headers.get(X402_HEADER_PAYMENT_REQUIRED)!);

    // 2. Sign payment authorization manually
    const timestamp = Math.floor(Date.now() / 1000);
    const domain = { name: "x402-protocol", version: "1", chainId: demand.chainId, verifyingContract: "0x0000000000000000000000000000000000000000" as any };
    const types = {
      X402Payment: [
        { name: "payer", type: "address" },
        { name: "recipient", type: "address" },
        { name: "token", type: "address" },
        { name: "amountAtomic", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };
    const signature = await agent.account.signTypedData({
      domain,
      types,
      primaryType: "X402Payment",
      message: {
        payer: agent.address,
        recipient: demand.recipient,
        token: demand.token,
        amountAtomic: BigInt(demand.amountAtomic),
        nonce: demand.nonce,
        timestamp: BigInt(timestamp),
      },
    });

    const authPayload = {
      version: demand.version,
      payer: agent.address,
      recipient: demand.recipient,
      token: demand.token,
      amountAtomic: demand.amountAtomic,
      nonce: demand.nonce,
      timestamp,
      network: demand.network,
      chainId: demand.chainId,
      signature,
    };

    // First use -> Success (200)
    const paidRes1 = await fetch(`${baseUrl}/api/v1/reddit/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [X402_HEADER_PAYMENT]: JSON.stringify(authPayload),
      },
      body: JSON.stringify({ subreddit: "artificial" }),
    });
    expect(paidRes1.status).toBe(200);

    // Second use (replay attack) -> Must fail (402)
    const paidRes2 = await fetch(`${baseUrl}/api/v1/reddit/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [X402_HEADER_PAYMENT]: JSON.stringify(authPayload),
      },
      body: JSON.stringify({ subreddit: "artificial" }),
    });
    expect(paidRes2.status).toBe(402);
    const errBody = await paidRes2.json();
    expect(errBody.detail).toContain("replay attack");
  });

  it("5. Client enforces maxAutoPayAmount safety guard", async () => {
    // Lead enricher costs 0.02 USDC; create an agent with tight 0.005 USDC limit
    const tightAgent = new X402AgentClient({
      privateKey: generatePrivateKey(),
      maxAutoPayAmount: 0.005,
    });

    expect(async () => {
      await tightAgent.fetch(`${baseUrl}/api/v1/b2b/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "stripe.com" }),
      });
    }).toThrow("exceeds maxAutoPayAmount");
  });

  it("6. Teaser sample and token footprint are included in HTTP 402 challenge", async () => {
    const res = await fetch(`${baseUrl}/api/v1/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://docs.anthropic.com" }),
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.teaserSample).toBeTruthy();
    expect(body.estimatedTotalResults).toBeGreaterThan(0);
    expect(body.estimatedTokenFootprint).toBeGreaterThan(0);
    expect(body.qualityAttestation).toContain("Clean Markdown/JSON");
  });

  it("7. Edge Cache returns HIT on repeated queries with sub-20ms latency", async () => {
    // 1st query: MISS
    const res1 = await agent.fetch(`${baseUrl}/api/v1/google/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "cached search test" }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.metadata.cache).toBe("MISS");

    // 2nd query: HIT
    const res2 = await agent.fetch(`${baseUrl}/api/v1/google/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "cached search test" }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.metadata.cache).toBe("HIT");
    expect(data2.metadata.executionMode).toBe("cached_edge");
    expect(data2.metadata.executionTimeMs).toBeLessThanOrEqual(20);
  });

  it("8. Self-healing machine-actionable error returned when required parameter is missing", async () => {
    // Send empty payload to endpoint that requires 'url'
    const res = await fetch(`${baseUrl}/api/v1/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPages: 2 }), // Missing required 'url'
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("MissingRequiredParameterError");
    expect(body.parameter).toBe("url");
    expect(body.expectedType).toContain("URL");
    expect(body.action).toContain("Please provide 'url'");
  });
});
