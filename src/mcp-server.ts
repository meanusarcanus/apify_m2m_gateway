import readline from "node:readline";
import { APIFY_ACTORS, type ActorDefinition } from "./config.js";
import { ApifyOrchestrator } from "./apify-orchestrator.js";

/**
 * Standard Model Context Protocol (MCP) Server for the 17 Apify Actors.
 * Communicates over stdio via JSON-RPC 2.0 for Claude Desktop, Cursor, and Agent Swarms.
 */
class ApifyMCPServer {
  private orchestrator = new ApifyOrchestrator();

  constructor() {
    this.setupStdio();
  }

  private setupStdio() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line) => {
      if (!line.trim()) return;
      try {
        const message = JSON.parse(line);
        const response = await this.handleMessage(message);
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch (err: any) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${err?.message || err}` },
          }) + "\n"
        );
      }
    });
  }

  public async handleMessage(req: any): Promise<any> {
    const { id, method, params } = req;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "msai-apify-m2m-suite",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case "notifications/initialized":
        return null; // No response required for notifications

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: Object.values(APIFY_ACTORS).map((actor) => ({
              name: actor.id.replace(/-/g, "_"),
              description: `${actor.title}: ${actor.description} (x402 M2M Cost: ${actor.priceUSDC} USDC on Base)`,
              inputSchema: {
                type: "object",
                properties: this.generatePropertiesForActor(actor),
              },
            })),
          },
        };

      case "tools/call": {
        const toolName = params?.name?.replace(/_/g, "-");
        const actor = APIFY_ACTORS[toolName];
        if (!actor) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${params?.name}` },
          };
        }

        const input = params?.arguments || actor.defaultInput;
        const result = await this.orchestrator.runActor(actor, input);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "success",
                    actor: actor.title,
                    price: `${actor.priceUSDC} USDC`,
                    results: result.data,
                    metadata: {
                      executionTimeMs: result.executionTimeMs,
                      mode: result.mode,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not supported: ${method}` },
        };
    }
  }

  private generatePropertiesForActor(actor: ActorDefinition): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(actor.defaultInput)) {
      props[key] = {
        type: typeof val,
        description: `Input parameter for ${key} (e.g. ${JSON.stringify(val)})`,
      };
    }
    return props;
  }
}

export const defaultMcpServer = new ApifyMCPServer();
export async function handleMcpJsonRpc(req: any): Promise<any> {
  return defaultMcpServer.handleMessage(req);
}

// Start stdio listener if run directly via CLI
if (process.argv[1]?.endsWith("mcp-server.ts") || process.argv[1]?.endsWith("mcp-server.js")) {
  // Instance initialized above handles stdio
}
