import {
  type Address,
  type Hex,
  type PrivateKeyAccount,
  getAddress,
  isAddress,
  parseUnits,
  formatUnits,
  verifyTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const X402_VERSION = "1.0";
export const X402_HEADER_PAYMENT_REQUIRED = "PAYMENT-REQUIRED";
export const X402_HEADER_PAYMENT = "X-PAYMENT";
export const X402_HEADER_PAYMENT_RECEIPT = "X-PAYMENT-RECEIPT";
export const BASE_USDC_ADDRESS: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;

export interface PaymentDemand {
  version: string;
  network: string;
  chainId: number;
  token: Address;
  tokenSymbol: string;
  amount: string;
  amountAtomic: string;
  recipient: Address;
  nonce: string;
  expiresAt: number;
  description?: string;
}

export interface PaymentAuthorization {
  version: string;
  payer: Address;
  recipient: Address;
  token: Address;
  amountAtomic: string;
  nonce: string;
  timestamp: number;
  network: string;
  chainId: number;
  signature: Hex;
}

export interface PaymentReceipt {
  status: "verified" | "settled";
  payer: Address;
  recipient: Address;
  amount: string;
  token: Address;
  nonce: string;
  timestamp: number;
}

export const X402_EIP712_DOMAIN = (chainId: number) => ({
  name: "x402-protocol",
  version: "1",
  chainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
});

export const X402_EIP712_TYPES = {
  X402Payment: [
    { name: "payer", type: "address" },
    { name: "recipient", type: "address" },
    { name: "token", type: "address" },
    { name: "amountAtomic", type: "uint256" },
    { name: "nonce", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

export class MemoryNonceStore {
  private nonces = new Map<string, { expiresAt: number; consumed: boolean }>();

  async createNonce(ttlSeconds = 300): Promise<string> {
    const nonce = `x402_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.nonces.set(nonce, { expiresAt: Date.now() + ttlSeconds * 1000, consumed: false });
    return nonce;
  }

  async consumeNonce(nonce: string): Promise<boolean> {
    const item = this.nonces.get(nonce);
    if (!item || item.consumed || Date.now() > item.expiresAt) {
      return false;
    }
    item.consumed = true;
    return true;
  }
}

export class X402Verifier {
  constructor(private nonceStore: MemoryNonceStore) {}

  async verify(auth: PaymentAuthorization, demand: PaymentDemand): Promise<{ valid: boolean; error?: string; receipt?: PaymentReceipt }> {
    try {
      if (!auth.payer || !auth.signature || !auth.nonce) {
        return { valid: false, error: "Missing required authorization fields" };
      }
      if (getAddress(auth.recipient) !== getAddress(demand.recipient)) {
        return { valid: false, error: "Recipient mismatch" };
      }
      if (BigInt(auth.amountAtomic) < BigInt(demand.amountAtomic)) {
        return { valid: false, error: "Insufficient amount authorized" };
      }
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - auth.timestamp) > 300) {
        return { valid: false, error: "Timestamp expired or drift too large" };
      }

      const consumed = await this.nonceStore.consumeNonce(auth.nonce);
      if (!consumed) {
        return { valid: false, error: "Nonce invalid or already consumed (replay attack)" };
      }

      let isValidSig = false;
      try {
        isValidSig = await verifyTypedData({
          address: getAddress(auth.payer),
          domain: X402_EIP712_DOMAIN(auth.chainId),
          types: X402_EIP712_TYPES,
          primaryType: "X402Payment",
          message: {
            payer: getAddress(auth.payer),
            recipient: getAddress(auth.recipient),
            token: getAddress(auth.token),
            amountAtomic: BigInt(auth.amountAtomic),
            nonce: auth.nonce,
            timestamp: BigInt(auth.timestamp),
          },
          signature: auth.signature,
        });
      } catch (err: any) {
        return { valid: false, error: `Invalid cryptographic signature: ${err?.message || err}` };
      }

      if (!isValidSig) {
        return { valid: false, error: "Signature verification failed" };
      }

      return {
        valid: true,
        receipt: {
          status: "verified",
          payer: auth.payer,
          recipient: auth.recipient,
          amount: demand.amount,
          token: auth.token,
          nonce: auth.nonce,
          timestamp: auth.timestamp,
        },
      };
    } catch (err: any) {
      return { valid: false, error: `Internal verification error: ${err?.message || err}` };
    }
  }
}

export class X402AgentClient {
  public readonly account: PrivateKeyAccount;
  public readonly maxAutoPayAmount: number;

  constructor(options: { privateKey: Hex; maxAutoPayAmount?: number }) {
    this.account = privateKeyToAccount(options.privateKey);
    this.maxAutoPayAmount = options.maxAutoPayAmount ?? 1.0;
  }

  get address() {
    return this.account.address;
  }

  async fetch(url: string | URL, init?: RequestInit): Promise<Response & { paymentReceipt?: PaymentReceipt }> {
    const res = await fetch(url, init);
    if (res.status !== 402) {
      return res;
    }

    const demandHeader = res.headers.get(X402_HEADER_PAYMENT_REQUIRED);
    if (!demandHeader) return res;

    const demand: PaymentDemand = JSON.parse(demandHeader);
    if (parseFloat(demand.amount) > this.maxAutoPayAmount) {
      throw new Error(`Demanded amount (${demand.amount} USDC) exceeds maxAutoPayAmount (${this.maxAutoPayAmount})`);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await this.account.signTypedData({
      domain: X402_EIP712_DOMAIN(demand.chainId),
      types: X402_EIP712_TYPES,
      primaryType: "X402Payment",
      message: {
        payer: getAddress(this.account.address),
        recipient: getAddress(demand.recipient),
        token: getAddress(demand.token),
        amountAtomic: BigInt(demand.amountAtomic),
        nonce: demand.nonce,
        timestamp: BigInt(timestamp),
      },
    });

    const auth: PaymentAuthorization = {
      version: demand.version,
      payer: this.account.address,
      recipient: demand.recipient,
      token: demand.token,
      amountAtomic: demand.amountAtomic,
      nonce: demand.nonce,
      timestamp,
      network: demand.network,
      chainId: demand.chainId,
      signature,
    };

    const newHeaders = new Headers(init?.headers);
    newHeaders.set(X402_HEADER_PAYMENT, JSON.stringify(auth));

    const paidRes = (await fetch(url, { ...init, headers: newHeaders })) as Response & { paymentReceipt?: PaymentReceipt };
    const receiptHeader = paidRes.headers.get(X402_HEADER_PAYMENT_RECEIPT);
    if (receiptHeader) {
      paidRes.paymentReceipt = JSON.parse(receiptHeader);
    }
    return paidRes;
  }
}
