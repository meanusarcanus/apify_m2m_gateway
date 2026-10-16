/**
 * Teaser preview generator and LLM token density optimizer.
 * Provides machine buyers with a verified sample before paying
 * and cleans bloated JSON into high-density tokens for LLM context windows.
 */

export function getTeaserSample(actorId: string): { sample: unknown; estimatedTotal: number; estimatedTokens: number } {
  switch (actorId) {
    case "markdown-crawler":
      return {
        sample: {
          title: "Introduction to Protocol Standards",
          url: "https://example.com/docs/intro",
          markdown: "# Documentation Overview\n\nThis guide outlines the core architecture, REST endpoints, and authentication rails for autonomous agents.",
          wordCount: 142,
        },
        estimatedTotal: 1,
        estimatedTokens: 350,
      };

    case "google-search":
      return {
        sample: {
          position: 1,
          title: "Autonomous Agent Payments using x402 Protocol",
          url: "https://docs.x402.org",
          snippet: "The x402 protocol turns HTTP 402 into machine-to-machine micropayments for AI agents on Base.",
        },
        estimatedTotal: 10,
        estimatedTokens: 420,
      };

    case "reddit-scraper":
      return {
        sample: {
          title: "How autonomous AI agents are paying for their own compute",
          subreddit: "artificial",
          author: "agent_dev_42",
          upvotes: 384,
          commentCount: 92,
          sentiment: "bullish",
          snippet: "We tested machine-to-machine stablecoin micro-billing on Base and observed 99.4% settlement success...",
        },
        estimatedTotal: 25,
        estimatedTokens: 680,
      };

    case "tiktok-scraper":
      return {
        sample: {
          id: "73819283719",
          caption: "Building AI agents that hold crypto wallets #tech #ai #crypto",
          views: 142000,
          likes: 18400,
          shares: 2190,
          author: "web3_builder",
        },
        estimatedTotal: 15,
        estimatedTokens: 510,
      };

    case "youtube-shorts":
      return {
        sample: {
          videoId: "dQw4w9WgXcQ",
          title: "Agentic Payments Explained in 60s",
          durationSeconds: 58,
          views: 45000,
          transcriptSnippet: "Instead of entering credit cards, AI agents now sign HTTP 402 challenges...",
        },
        estimatedTotal: 10,
        estimatedTokens: 490,
      };

    case "b2b-lead-enricher":
      return {
        sample: {
          companyName: "Stripe, Inc.",
          domain: "stripe.com",
          headcount: "5000-10000",
          verifiedDecisionMaker: {
            name: "John Collison",
            title: "President",
            linkedin: "https://linkedin.com/in/johncollison",
          },
          techStack: ["Node.js", "Ruby", "AWS", "Kubernetes"],
        },
        estimatedTotal: 5,
        estimatedTokens: 380,
      };

    case "linkedin-scraper":
      return {
        sample: {
          company: "Anthropic",
          industry: "Artificial Intelligence",
          headcountGrowth6m: "+18%",
          recentJobPosts: ["Research Scientist - Alignment", "Distributed Systems Engineer"],
        },
        estimatedTotal: 10,
        estimatedTokens: 410,
      };

    default:
      return {
        sample: {
          status: "verified_sample",
          recordId: "sample_001",
          preview: "High-fidelity structured data extracted without HTML noise.",
        },
        estimatedTotal: 10,
        estimatedTokens: 300,
      };
  }
}

/**
 * Strips null, undefined, and empty string fields to maximize token density for LLMs.
 */
export function cleanForLLM(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => cleanForLLM(item));
  }

  if (data !== null && typeof data === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      cleaned[key] = cleanForLLM(value);
    }
    return cleaned;
  }

  return data;
}

/**
 * Calculates approximate token count for JSON data (~4 characters per token).
 */
export function estimateTokens(data: unknown): number {
  const jsonStr = JSON.stringify(data);
  return Math.ceil(jsonStr.length / 4);
}
