import { ApifyM2MGatewayServer } from "../src/server.js";
const gateway = new ApifyM2MGatewayServer();
export default async function handler(req, res) {
    await gateway.handleRequest(req, res);
}
