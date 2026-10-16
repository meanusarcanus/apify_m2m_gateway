import {
  crawlMarkdownAction,
  googleSearchAction,
  redditScraperAction,
} from "./actions.js";

export const msaiToolsPlugin = {
  name: "msai-tools",
  description: "Autonomous Web Scraping & Intelligence Suite for ElizaOS AI Agents powered by Apify and x402 on Base",
  actions: [
    crawlMarkdownAction,
    googleSearchAction,
    redditScraperAction,
  ],
  evaluators: [],
  providers: [],
};

export default msaiToolsPlugin;
export * from "./actions.js";
