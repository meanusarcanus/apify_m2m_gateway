import http from "node:http";
import { parseUnits } from "viem";
import {
  X402_VERSION,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT,
  X402_HEADER_PAYMENT_RECEIPT,
  BASE_USDC_ADDRESS,
  BASE_CHAIN_ID,
  type PaymentDemand,
  type PaymentAuthorization,
  MemoryNonceStore,
  X402Verifier,
} from "./x402-core.js";
import { APIFY_ACTORS, CONFIG, type ActorDefinition } from "./config.js";
import { ApifyOrchestrator } from "./apify-orchestrator.js";
import { sendTelegramSaleAlert } from "./notifier.js";
import { ScraperCache } from "./cache.js";
import { getTeaserSample, cleanForLLM, estimateTokens } from "./teaser.js";

export class ApifyM2MGatewayServer {
  private nonceStore = new MemoryNonceStore();
  private verifier = new X402Verifier(this.nonceStore);
  private orchestrator = new ApifyOrchestrator();
  private cache = new ScraperCache();
  private server: http.Server;

  // Lookup map: endpoint path -> ActorDefinition
  private endpointMap = new Map<string, ActorDefinition>();

  constructor() {
    for (const actor of Object.values(APIFY_ACTORS)) {
      this.endpointMap.set(actor.endpoint, actor);
    }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  private async parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    if ((req as any).body && typeof (req as any).body === "object") {
      return (req as any).body;
    }
    return new Promise((resolve) => {
      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
      });
      req.on("end", () => {
        try {
          resolve(bodyStr ? JSON.parse(bodyStr) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  private setCorsHeaders(res: http.ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${X402_HEADER_PAYMENT}, Authorization`);
    res.setHeader("Access-Control-Expose-Headers", `${X402_HEADER_PAYMENT_REQUIRED}, ${X402_HEADER_PAYMENT_RECEIPT}, X-Cache`);
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown, extraHeaders: Record<string, string> = {}) {
    this.setCorsHeaders(res);
    for (const [key, val] of Object.entries(extraHeaders)) {
      res.setHeader(key, val);
    }
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data, null, 2));
  }

  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    this.setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const queryPath = url.searchParams.get("__path");
    const matchedPath = req.headers["x-matched-path"] as string;
    const originalPath = req.headers["x-vercel-original-path"] as string;
    let path = queryPath || matchedPath || originalPath || url.pathname;
    if (path.startsWith("//")) path = path.slice(1);
    if (!path.startsWith("/")) path = "/" + path;

    // 1. Discovery Catalog Endpoint
    if (path === "/api/v1/catalog" || path === "/") {
      return this.sendJson(res, 200, {
        name: "MSAI Apify M2M Autonomous Gateway",
        description: "Autonomous Machine-to-Machine x402 Micropayment Gateway for 17 Apify Scraper Actors",
        protocol: "x402",
        network: CONFIG.network,
        chainId: CONFIG.chainId,
        token: BASE_USDC_ADDRESS,
        tokenSymbol: CONFIG.tokenSymbol,
        merchantWallet: CONFIG.merchantWallet,
        totalActors: Object.keys(APIFY_ACTORS).length,
        actors: Object.values(APIFY_ACTORS).map((a) => ({
          id: a.id,
          title: a.title,
          endpoint: a.endpoint,
          price: `${a.priceUSDC} USDC`,
          description: a.description,
          defaultInput: a.defaultInput,
          requiredParams: a.requiredParams,
          paramTypes: a.paramTypes,
        })),
      });
    }

    // 2. Match actor endpoint
    const actor = this.endpointMap.get(path);
    if (!actor) {
      return this.sendJson(res, 404, { error: "Route not found", path });
    }

    const body = await this.parseBody(req);
    const input = Object.keys(body).length > 0 ? body : actor.defaultInput;

    // 3. Machine-Actionable Self-Healing Validation
    if (actor.requiredParams && Object.keys(body).length > 0) {
      for (const param of actor.requiredParams) {
        if (!input[param]) {
          return this.sendJson(res, 400, {
            error: "MissingRequiredParameterError",
            parameter: param,
            expectedType: actor.paramTypes?.[param] || "string",
            suggestion: actor.defaultInput[param],
            action: `Please provide '${param}' in your request body to execute this tool.`,
          });
        }
      }
    }

    // 4. Inspect X-PAYMENT header
    const paymentHeader = (req.headers[X402_HEADER_PAYMENT.toLowerCase()] || req.headers[X402_HEADER_PAYMENT]) as string;

    if (!paymentHeader) {
      // Issue x402 Challenge with Machine Teaser Sample
      const nonce = await this.nonceStore.createNonce(300);
      const demand: PaymentDemand = {
        version: X402_VERSION,
        network: CONFIG.network,
        chainId: CONFIG.chainId,
        token: BASE_USDC_ADDRESS,
        tokenSymbol: CONFIG.tokenSymbol,
        amount: actor.priceUSDC,
        amountAtomic: parseUnits(actor.priceUSDC, 6).toString(),
        recipient: CONFIG.merchantWallet,
        nonce,
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        description: actor.description,
      };

      const teaser = getTeaserSample(actor.id);

      return this.sendJson(
        res,
        402,
        {
          error: "Payment Required",
          message: `This Apify actor requires an x402 payment of ${actor.priceUSDC} USDC on Base`,
          teaserSample: teaser.sample,
          estimatedTotalResults: teaser.estimatedTotal,
          estimatedTokenFootprint: teaser.estimatedTokens,
          qualityAttestation: "Clean Markdown/JSON without ads, navigation menus, or tracking scripts",
          paymentDemand: demand,
        },
        {
          [X402_HEADER_PAYMENT_REQUIRED]: JSON.stringify(demand),
        }
      );
    }

    // 5. Validate payment authorization
    let auth: PaymentAuthorization;
    try {
      auth = JSON.parse(paymentHeader);
    } catch {
      return this.sendJson(res, 400, { error: "Invalid X-PAYMENT JSON header" });
    }

    const demand: PaymentDemand = {
      version: X402_VERSION,
      network: CONFIG.network,
      chainId: CONFIG.chainId,
      token: BASE_USDC_ADDRESS,
      tokenSymbol: CONFIG.tokenSymbol,
      amount: actor.priceUSDC,
      amountAtomic: parseUnits(actor.priceUSDC, 6).toString(),
      recipient: CONFIG.merchantWallet,
      nonce: auth.nonce,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const verification = await this.verifier.verify(auth, demand);
    if (!verification.valid) {
      return this.sendJson(res, 402, {
        error: "Payment Verification Failed",
        detail: verification.error,
      });
    }

    // 6. Fast Edge Cache Inspection
    const cached = this.cache.get(actor.endpoint, input);
    let runResult: { data: unknown; itemsCount: number; executionTimeMs: number; mode: string };
    let cacheStatus = "MISS";

    if (cached.hit) {
      runResult = {
        data: cached.data,
        itemsCount: cached.itemsCount || 1,
        executionTimeMs: 4,
        mode: "cached_edge",
      };
      cacheStatus = "HIT";
    } else {
      const liveResult = await this.orchestrator.runActor(actor, input);
      const cleanedData = cleanForLLM(liveResult.data);
      this.cache.set(actor.endpoint, input, cleanedData, liveResult.itemsCount);
      runResult = {
        data: cleanedData,
        itemsCount: liveResult.itemsCount,
        executionTimeMs: liveResult.executionTimeMs,
        mode: liveResult.mode,
      };
    }

    // 7. Real-time Telegram alert
    await sendTelegramSaleAlert({
      actorTitle: actor.title,
      endpoint: actor.endpoint,
      amount: actor.priceUSDC,
      payer: auth.payer,
      targetQuery: typeof input === "object" ? JSON.stringify(input) : String(input),
      executionTimeMs: runResult.executionTimeMs,
    }).catch((err) => console.warn("[Telegram Alert] Error:", err));

    return this.sendJson(
      res,
      200,
      {
        status: "success",
        actor: actor.id,
        actorId: actor.actorId,
        paymentReceipt: verification.receipt,
        data: runResult.data,
        metadata: {
          itemsCount: runResult.itemsCount,
          executionTimeMs: runResult.executionTimeMs,
          executionMode: runResult.mode,
          cache: cacheStatus,
          tokenCount: estimateTokens(runResult.data),
        },
      },
      {
        [X402_HEADER_PAYMENT_RECEIPT]: JSON.stringify(verification.receipt),
        "X-Cache": cacheStatus,
      }
    );
  }

  listen(port: number = CONFIG.port): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, "0.0.0.0", () => {
        const addr = this.server.address() as any;
        resolve(addr.port);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

// Serverless default handler for Vercel
const defaultGateway = new ApifyM2MGatewayServer();
export default async function handler(req: any, res: any) {
  await defaultGateway.handleRequest(req, res);
}

// Auto-run if executed directly as standalone process
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  defaultGateway.listen(CONFIG.port).then((port) => {
    console.log(`=================================================================`);
    console.log(`🚀 MSAI Apify M2M Autonomous Gateway running on port ${port}`);
    console.log(`📡 Catalog Endpoint: http://localhost:${port}/api/v1/catalog`);
    console.log(`💰 Merchant Wallet : ${CONFIG.merchantWallet} (Base USDC)`);
    console.log(`🤖 Monitored Actors: ${Object.keys(APIFY_ACTORS).length} Apify Scrapers`);
    console.log(`⚡ Caching & Teasers: Active`);
    console.log(`=================================================================`);
  });
}
