const GATEWAY_URL = process.env.MSAI_GATEWAY_URL || "https://apifym2mgateway.vercel.app";

export interface ActionContext {
  runtime: any;
  message: any;
  state?: any;
}

export const crawlMarkdownAction = {
  name: "CRAWL_WEBSITE_TO_MARKDOWN",
  similes: ["SCRAPE_WEBSITE", "READ_WEBPAGE", "GET_PAGE_CONTENT", "CONVERT_URL_TO_MARKDOWN"],
  description: "Crawl or scrape a website URL into clean, ad-free Markdown suitable for LLM reasoning and summarization.",
  examples: [
    [
      { user: "{{user1}}", content: { text: "Can you read the docs at https://docs.anthropic.com and tell me what it says?" } },
      { user: "{{agentName}}", content: { text: "I'll scrape that website and extract the clean markdown.", action: "CRAWL_WEBSITE_TO_MARKDOWN" } }
    ]
  ],
  validate: async (_runtime: any, message: any) => {
    return /https?:\/\/[^\s]+/.test(message.content?.text || "");
  },
  handler: async (runtime: any, message: any, _state: any, _options: any, callback: any) => {
    const urlMatch = message.content?.text?.match(/https?:\/\/[^\s]+/);
    const targetUrl = urlMatch ? urlMatch[0] : "https://example.com";

    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, maxPages: 1 }),
      });

      const json = await res.json();
      const output = json.data?.markdown || JSON.stringify(json.data);

      if (callback) {
        callback({
          text: `Successfully scraped ${targetUrl}:\n\n${output.slice(0, 1500)}...`,
          content: json.data,
        });
      }
      return json.data;
    } catch (err: any) {
      if (callback) callback({ text: `Failed to scrape website: ${err?.message || err}` });
      return null;
    }
  }
};

export const googleSearchAction = {
  name: "SEARCH_GOOGLE_LIVE",
  similes: ["SEARCH_WEB", "GOOGLE_QUERY", "FIND_NEWS_ONLINE", "SEARCH_INTERNET"],
  description: "Executes a live Google web search to retrieve fresh real-time SERP listings, organic snippets, and facts.",
  examples: [
    [
      { user: "{{user1}}", content: { text: "What are the latest updates on autonomous AI agent payments?" } },
      { user: "{{agentName}}", content: { text: "Searching Google for latest updates on AI agent payments.", action: "SEARCH_GOOGLE_LIVE" } }
    ]
  ],
  validate: async (_runtime: any, message: any) => {
    return Boolean(message.content?.text);
  },
  handler: async (runtime: any, message: any, _state: any, _options: any, callback: any) => {
    const query = message.content?.text?.replace(/search|google|find/gi, "").trim() || "AI agent news";

    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/google/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, maxResults: 5 }),
      });

      const json = await res.json();
      const results = json.data || [];

      const formatted = results
        .map((r: any, i: number) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`)
        .join("\n\n");

      if (callback) {
        callback({
          text: `Google Search Results for "${query}":\n\n${formatted}`,
          content: results,
        });
      }
      return results;
    } catch (err: any) {
      if (callback) callback({ text: `Search failed: ${err?.message || err}` });
      return null;
    }
  }
};

export const redditScraperAction = {
  name: "SEARCH_REDDIT_SENTIMENT",
  similes: ["SEARCH_REDDIT", "REDDIT_OPINIONS", "WHAT_DOES_REDDIT_SAY", "SUBREDDIT_POSTS"],
  description: "Scrapes community discussions, upvotes, comments, and authentic user sentiment from Reddit subreddits.",
  examples: [
    [
      { user: "{{user1}}", content: { text: "What is people's sentiment on r/solana regarding AI agents?" } },
      { user: "{{agentName}}", content: { text: "Checking r/solana for recent posts and sentiment.", action: "SEARCH_REDDIT_SENTIMENT" } }
    ]
  ],
  validate: async (_runtime: any, message: any) => {
    return /reddit|subreddit|r\/\w+/i.test(message.content?.text || "");
  },
  handler: async (runtime: any, message: any, _state: any, _options: any, callback: any) => {
    const match = message.content?.text?.match(/r\/(\w+)/i);
    const subreddit = match ? match[1] : "artificial";

    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/reddit/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subreddit, limit: 10 }),
      });

      const json = await res.json();
      const posts = json.data || [];

      const summary = posts
        .map((p: any) => `• [${p.sentiment || "post"}] ${p.title} (▲ ${p.upvotes || 0} upvotes, ${p.commentCount || 0} comments)`)
        .join("\n");

      if (callback) {
        callback({
          text: `Recent discussions from r/${subreddit}:\n\n${summary}`,
          content: posts,
        });
      }
      return posts;
    } catch (err: any) {
      if (callback) callback({ text: `Reddit search failed: ${err?.message || err}` });
      return null;
    }
  }
};
