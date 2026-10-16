import type { IncomingMessage, ServerResponse } from "node:http";
import { ApifyM2MGatewayServer } from "../src/server.js";

const gateway = new ApifyM2MGatewayServer();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await gateway.handleRequest(req, res);
}
