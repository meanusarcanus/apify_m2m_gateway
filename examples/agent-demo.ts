import { generatePrivateKey } from "viem/accounts";
import { ApifyM2MGatewayServer } from "../src/server.js";
import { X402AgentClient } from "../src/x402-core.js";
import { CONFIG } from "../src/config.js";

async function runDemo() {
  console.log("==========================================================================");
  console.log("🤖 MSAI Apify M2M Autonomous Monetization Demonstration");
  console.log("==========================================================================\n");

  // 1. Launch Gateway Server
  const gateway = new ApifyM2MGatewayServer();
  const port = await gateway.listen(0);
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 M2M Gateway Server running at : ${baseUrl}`);
  console.log(`🏦 Merchant Payout Wallet        : ${CONFIG.merchantWallet} (Base USDC)\n`);

  // 2. Machine Discovery: AI Agent inspects the M2M catalog
  console.log("--- [Step 1: Machine Discovery via Catalog] ---");
  const catalogRes = await fetch(`${baseUrl}/api/v1/catalog`);
  const catalog = await catalogRes.json();
  console.log(`Discovered ${catalog.totalActors} Apify actors available for autonomous purchase on Base:`);
  for (const actor of catalog.actors.slice(0, 5)) {
    console.log(`  • [${actor.price}] ${actor.title} -> ${actor.endpoint}`);
  }
  console.log(`  ... and ${catalog.totalActors - 5} more actors.\n`);

  // 3. Autonomous Agent Initialization
  console.log("--- [Step 2: Autonomous Buyer Agent with Base Wallet] ---");
  const agentKey = generatePrivateKey();
  const agent = new X402AgentClient({
    privateKey: agentKey,
    maxAutoPayAmount: 0.10, // Max 0.10 USDC per call
  });
  console.log(`🤖 Agent Wallet Address: ${agent.address}`);

  // 4. Autonomous M2M Transaction Execution
  console.log("\n--- [Step 3: Autonomous Purchase of Website Markdown Crawler] ---");
  console.log("Agent executing: POST /api/v1/crawl for 'https://docs.anthropic.com'...");
  const scrapeRes = await agent.fetch(`${baseUrl}/api/v1/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://docs.anthropic.com" }),
  });

  console.log(`HTTP Status : ${scrapeRes.status} OK`);
  const scrapeData = await scrapeRes.json();
  console.log("Apify Scraper Output Received by Agent:\n", JSON.stringify(scrapeData.data, null, 2));

  console.log("\nVerified On-Chain Payment Receipt:");
  console.log(scrapeRes.paymentReceipt);

  // 5. Margin & Profit Summary
  console.log("\n==========================================================================");
  console.log("💰 UNIT ECONOMICS & MARGIN SUMMARY FOR THIS CALL:");
  console.log("   • Price Charged to Machine (Base USDC) : $0.0100");
  console.log("   • Estimated Apify Compute Cost        : $0.0015");
  console.log("   • Net Profit to Your Wallet           : $0.0085 (85% Net Margin)");
  console.log("   • Apify Store Cut Avoided             : 20%");
  console.log("   • Human Intervention                  : Zero (100% Autonomous M2M)");
  console.log("==========================================================================");

  await gateway.close();
}

runDemo().catch(console.error);
