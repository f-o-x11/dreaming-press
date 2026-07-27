// tools-services.js — API/SaaS entries for The Stack directory, curated + verified
// by a mega-LLM council (web-researched real tools: URLs, pricing, auth, and — the
// priority — whether an AI AGENT can provision credentials on its own). Merged into
// TOOLS by tools-data.js (deduped against the hand-curated OSS repos). Each entry is
// kind:"api"; fields map 1:1 to the tools table (see seedTools/hydrateTool in db.js).
export const SERVICES = [
 {
  "slug": "exa",
  "name": "Exa",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Neural/semantic web search API purpose-built for AI agents, returning clean results plus full page contents and highlights.",
  "blurb": "Neural/semantic web search API purpose-built for AI agents, returning clean results plus full page contents and highlights.",
  "website": "https://exa.ai",
  "docsUrl": "https://exa.ai/docs",
  "signupUrl": "https://dashboard.exa.ai",
  "pricingModel": "freemium",
  "pricingNote": "1,000 free searches/mo + $10 starter credit, no card; then ~$5/1k (Instant) up to $15/1k (deep reasoning), contents $1/1k",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup with email only, no credit card; instant API key from dashboard.exa.ai. Onboarding can be completed without a human.",
  "mcpServer": "https://github.com/exa-labs/exa-mcp-server",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from exa_py import Exa\n\nexa = Exa(\"EXA_API_KEY\")\nresult = exa.search_and_contents(\n    \"best open-source vector databases\",\n    type=\"auto\",\n    num_results=5,\n    highlights=True,\n)\nfor r in result.results:\n    print(r.title, r.url)"
  },
  "tags": [
   "semantic-search",
   "web-search",
   "rag",
   "agents",
   "neural-search"
  ],
  "useCases": []
 },
 {
  "slug": "tavily",
  "name": "Tavily",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Web search, extract, crawl and map API built specifically for LLMs and AI agents, returning LLM-ready structured results.",
  "blurb": "Web search, extract, crawl and map API built specifically for LLMs and AI agents, returning LLM-ready structured results.",
  "website": "https://www.tavily.com",
  "docsUrl": "https://docs.tavily.com",
  "signupUrl": "https://app.tavily.com",
  "pricingModel": "freemium",
  "pricingNote": "1,000 free API credits/mo (no card); pay-as-you-go $0.008/credit, or plans from $30/mo (4k credits)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant API key on free signup, no credit card; used as env var TAVILY_API_KEY.",
  "mcpServer": "https://github.com/tavily-ai/tavily-mcp",
  "sdks": [
   "Python",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from tavily import TavilyClient\n\nclient = TavilyClient(\"tvly-YOUR_API_KEY\")\nresponse = client.search(\"latest on autonomous AI agents\", max_results=5)\nfor r in response[\"results\"]:\n    print(r[\"title\"], r[\"url\"])"
  },
  "tags": [
   "web-search",
   "extract",
   "crawl",
   "rag",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "linkup",
  "name": "Linkup",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Production-grade web search API for AI that returns sourced, cited answers or raw results to reduce hallucination.",
  "blurb": "Production-grade web search API for AI that returns sourced, cited answers or raw results to reduce hallucination.",
  "website": "https://www.linkup.so",
  "docsUrl": "https://docs.linkup.so",
  "signupUrl": "https://app.linkup.so/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "$20 free credits/mo (~4,000 queries); usage-based after, from ~$0.005/search depending on depth & output type",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Create an API key instantly at app.linkup.so; recurring monthly free credits, no card to start.",
  "mcpServer": "https://github.com/LinkupPlatform/linkup-mcp-server",
  "sdks": [
   "Python",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from linkup import LinkupClient\n\nclient = LinkupClient(api_key=\"YOUR_KEY\")\nresponse = client.search(\n    query=\"Who founded Linkup and when?\",\n    depth=\"standard\",\n    output_type=\"sourcedAnswer\",\n)\nprint(response)"
  },
  "tags": [
   "web-search",
   "sourced-answer",
   "rag",
   "agents",
   "citations"
  ],
  "useCases": []
 },
 {
  "slug": "brave-search",
  "name": "Brave Search API",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Independent search-index API (web, news, images) with an LLM-focused Answers/Grounding endpoint, from a privacy-first crawler.",
  "blurb": "Independent search-index API (web, news, images) with an LLM-focused Answers/Grounding endpoint, from a privacy-first crawler.",
  "website": "https://brave.com/search/api/",
  "docsUrl": "https://api-dashboard.search.brave.com/documentation",
  "signupUrl": "https://api-dashboard.search.brave.com/register",
  "pricingModel": "usage-based",
  "pricingNote": "Free tier removed Feb 2026; ~$5/1k web requests, Answers ~$4/1k + $5/M tokens; $5 recurring monthly credit, card required",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "As of Feb 2026 a credit card is required to provision a key (credit-based billing, no free tier), so a human must add payment.",
  "mcpServer": "https://github.com/brave/brave-search-mcp-server",
  "sdks": [
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -s \"https://api.search.brave.com/res/v1/web/search?q=brave+search+api\" \\\n  -H \"Accept: application/json\" \\\n  -H \"X-Subscription-Token: $BRAVE_API_KEY\""
  },
  "tags": [
   "web-search",
   "independent-index",
   "news",
   "privacy",
   "grounding"
  ],
  "useCases": []
 },
 {
  "slug": "serpapi",
  "name": "SerpApi",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Real-time SERP scraping API returning structured JSON from Google and 20+ engines (maps, news, shopping, scholar).",
  "blurb": "Real-time SERP scraping API returning structured JSON from Google and 20+ engines (maps, news, shopping, scholar).",
  "website": "https://serpapi.com",
  "docsUrl": "https://serpapi.com/search-api",
  "signupUrl": "https://serpapi.com/users/sign_up",
  "pricingModel": "freemium",
  "pricingNote": "Free 250 searches/mo; paid from $25/mo (1k) up to $275/mo (30k); enterprise ~$3,750/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free plan (250/mo) issues an instant API key on signup; no card for the free tier (account verification may apply).",
  "mcpServer": "",
  "sdks": [
   "Python",
   "JavaScript",
   "Ruby",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://serpapi.com/search.json?engine=google&q=coffee&api_key=YOUR_API_KEY\""
  },
  "tags": [
   "serp",
   "google-search",
   "scraping",
   "structured-json",
   "seo"
  ],
  "useCases": []
 },
 {
  "slug": "you-com",
  "name": "You.com API",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Real-time web search, page-contents, and multi-step research APIs for AI apps, with a free keyless MCP endpoint.",
  "blurb": "Real-time web search, page-contents, and multi-step research APIs for AI apps, with a free keyless MCP endpoint.",
  "website": "https://api.you.com",
  "docsUrl": "https://you.com/docs",
  "signupUrl": "https://you.com/platform",
  "pricingModel": "freemium",
  "pricingNote": "$100 free credits, no card; Web Search $5/1k calls, Contents $1/1k pages; Research tiers $12–$450/1k",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant key + $100 credits at you.com/platform, no card. Plus a keyless free MCP endpoint (api.you.com/mcp?profile=free, 100 queries/day) usable with zero signup.",
  "mcpServer": "https://api.you.com/mcp",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -G https://ydc-index.io/v1/search \\\n  -H \"X-API-Key: $YDC_API_KEY\" \\\n  --data-urlencode \"query=global birth rate trends\" \\\n  -d count=5"
  },
  "tags": [
   "web-search",
   "research",
   "contents",
   "agents",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "perplexity",
  "name": "Perplexity Sonar API",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Search-grounded LLM API (Sonar models) that returns cited answers with live web search built in, plus a raw Search API.",
  "blurb": "Search-grounded LLM API (Sonar models) that returns cited answers with live web search built in, plus a raw Search API.",
  "website": "https://docs.perplexity.ai",
  "docsUrl": "https://docs.perplexity.ai",
  "signupUrl": "https://www.perplexity.ai/settings/api",
  "pricingModel": "usage-based",
  "pricingNote": "Token-based: Sonar ~$1/M, Sonar Pro $3/$15 per M in/out, plus a per-request search fee; Pro subscribers get $5/mo credit",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Minting an API key requires setting up billing / adding a payment method, so a human is needed.",
  "mcpServer": "https://github.com/perplexityai/modelcontextprotocol",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\n\nclient = OpenAI(api_key=\"pplx-YOUR_KEY\", base_url=\"https://api.perplexity.ai\")\nresp = client.chat.completions.create(\n    model=\"sonar\",\n    messages=[{\"role\": \"user\", \"content\": \"What are the newest AI search APIs?\"}],\n)\nprint(resp.choices[0].message.content)"
  },
  "tags": [
   "answer-engine",
   "sonar",
   "cited-answers",
   "grounding",
   "llm"
  ],
  "useCases": []
 },
 {
  "slug": "jina-reader",
  "name": "Jina Reader",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "URL-to-LLM-markdown reader (r.jina.ai) and web search (s.jina.ai) that work with a simple URL prefix — even without an API key.",
  "blurb": "URL-to-LLM-markdown reader (r.jina.ai) and web search (s.jina.ai) that work with a simple URL prefix — even without an API key.",
  "website": "https://jina.ai/reader/",
  "docsUrl": "https://jina.ai/reader/",
  "signupUrl": "https://jina.ai/api-dashboard/",
  "pricingModel": "freemium",
  "pricingNote": "Works free/keyless at low rate limits; API key adds 10M free tokens then token-based billing; one key shared across all Jina APIs",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Usable with NO key at all (just prepend r.jina.ai / s.jina.ai). A free key with 10M tokens is issued instantly from the dashboard, no card.",
  "mcpServer": "",
  "sdks": [
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "# Turn any URL into clean, LLM-ready markdown\ncurl \"https://r.jina.ai/https://example.com\" \\\n  -H \"Authorization: Bearer jina_YOUR_KEY\"\n\n# Web search — top results as markdown\ncurl \"https://s.jina.ai/?q=latest+ai+search+apis\" \\\n  -H \"Authorization: Bearer jina_YOUR_KEY\""
  },
  "tags": [
   "url-to-markdown",
   "web-search",
   "reader",
   "rag",
   "keyless"
  ],
  "useCases": []
 },
 {
  "slug": "firecrawl",
  "name": "Firecrawl",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Web-data API to search, scrape, crawl and map sites into clean markdown/structured data for LLMs — one call returns full page content.",
  "blurb": "Web-data API to search, scrape, crawl and map sites into clean markdown/structured data for LLMs — one call returns full page content.",
  "website": "https://www.firecrawl.dev",
  "docsUrl": "https://docs.firecrawl.dev",
  "signupUrl": "https://www.firecrawl.dev/signin/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free 1,000 credits/mo; search costs 2 credits per 10 results; pay-as-you-go credits + monthly plans",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant fc- API key on free signup (1,000 credits/mo), no card required for the free tier.",
  "mcpServer": "https://github.com/firecrawl/firecrawl-mcp-server",
  "sdks": [
   "Python",
   "Node.js",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from firecrawl import Firecrawl\n\nfirecrawl = Firecrawl(api_key=\"fc-YOUR_API_KEY\")\nresults = firecrawl.search(\"best AI search APIs 2026\", limit=5)\nprint(results)"
  },
  "tags": [
   "scrape",
   "crawl",
   "web-search",
   "markdown",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "parallel",
  "name": "Parallel Search API",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Search API built from the ground up for AI agents — pass an objective and get URLs plus token-relevant compressed excerpts.",
  "blurb": "Search API built from the ground up for AI agents — pass an objective and get URLs plus token-relevant compressed excerpts.",
  "website": "https://parallel.ai",
  "docsUrl": "https://docs.parallel.ai",
  "signupUrl": "https://platform.parallel.ai",
  "pricingModel": "freemium",
  "pricingNote": "Up to ~16,000 free search requests; then ~$0.005 per request (10 results) + ~$0.001 per additional results/excerpts",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve key with ~16k free requests; the Search MCP (search.parallel.ai/mcp) even works with NO key for light use.",
  "mcpServer": "https://search.parallel.ai/mcp",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl https://api.parallel.ai/v1/search \\\n  -H \"x-api-key: $PARALLEL_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"objective\": \"Find recent benchmarks comparing AI search APIs\",\n    \"search_queries\": [\"AI search API benchmark 2026\"]\n  }'"
  },
  "tags": [
   "agent-native",
   "web-search",
   "excerpts",
   "objective-based",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "serper",
  "name": "Serper",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Fast, low-cost Google Search API returning structured JSON (organic, knowledge graph, news, images, places) for agents and SEO.",
  "blurb": "Fast, low-cost Google Search API returning structured JSON (organic, knowledge graph, news, images, places) for agents and SEO.",
  "website": "https://serper.dev",
  "docsUrl": "https://serper.dev/playground",
  "signupUrl": "https://serper.dev/signup",
  "pricingModel": "freemium",
  "pricingNote": "2,500 free queries on signup (valid 6 months, no card); then $0.30–$1.00 per 1k queries at scale",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "2,500 free credits and an instant API key on signup, no credit card.",
  "mcpServer": "",
  "sdks": [
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://google.serper.dev/search \\\n  -H \"X-API-KEY: YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"q\": \"apple inc\"}'"
  },
  "tags": [
   "serp",
   "google-search",
   "structured-json",
   "low-cost",
   "seo"
  ],
  "useCases": []
 },
 {
  "slug": "searchapi",
  "name": "SearchApi.io",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Real-time SERP API across 20+ engines (Google, Bing, YouTube, Maps, Scholar) with a pay-for-success model and structured JSON.",
  "blurb": "Real-time SERP API across 20+ engines (Google, Bing, YouTube, Maps, Scholar) with a pay-for-success model and structured JSON.",
  "website": "https://www.searchapi.io",
  "docsUrl": "https://www.searchapi.io/docs",
  "signupUrl": "https://www.searchapi.io/",
  "pricingModel": "freemium",
  "pricingNote": "100 free requests; plans from $40/mo (10k @ ~$4/1k); you only pay for successful requests",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "100 free requests + an instant API key on signup, no card to start.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node.js",
   "Ruby",
   "Java",
   "Go",
   "PHP",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://www.searchapi.io/api/v1/search?engine=google&q=coffee&api_key=YOUR_API_KEY\""
  },
  "tags": [
   "serp",
   "multi-engine",
   "pay-for-success",
   "structured-json",
   "scraping"
  ],
  "useCases": []
 },
 {
  "slug": "kagi-search",
  "name": "Kagi Search API",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Privacy-first, ad-free search API from Kagi with high-quality results, plus a FastGPT/Summarizer endpoint for LLMs.",
  "blurb": "Privacy-first, ad-free search API from Kagi with high-quality results, plus a FastGPT/Summarizer endpoint for LLMs.",
  "website": "https://help.kagi.com/kagi/api/overview.html",
  "docsUrl": "https://help.kagi.com/kagi/api/search.html",
  "signupUrl": "https://kagi.com/settings?p=api",
  "pricingModel": "usage-based",
  "pricingNote": "~$12–$25 per 1k queries depending on tier; usage-based, invoiced at $100 usage or end of monthly cycle",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Requires a Kagi account with billing set up to create/manage API tokens, so a human is needed.",
  "mcpServer": "",
  "sdks": [
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -H \"Authorization: Bot $KAGI_API_KEY\" \\\n  \"https://kagi.com/api/v0/search?q=steve+jobs\""
  },
  "tags": [
   "web-search",
   "privacy",
   "ad-free",
   "summarizer",
   "high-quality"
  ],
  "useCases": []
 },
 {
  "slug": "valyu",
  "name": "Valyu",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Search API for agents unifying web plus 50+ proprietary sources (academic papers, SEC filings, financial data, clinical trials).",
  "blurb": "Search API for agents unifying web plus 50+ proprietary sources (academic papers, SEC filings, financial data, clinical trials).",
  "website": "https://www.valyu.ai",
  "docsUrl": "https://docs.valyu.ai",
  "signupUrl": "https://platform.valyu.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free starter credits; web ~$0.003/result, arXiv/PubMed ~$0.50/1k, proprietary DBs $30–$50/1k; set a max price per query",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve API key with free starter credits at platform.valyu.ai.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Rust",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from valyu import Valyu\n\nvalyu = Valyu(api_key=\"your-api-key\")\nresponse = valyu.search(\n    \"implications of quantum computing on cryptography\",\n    search_type=\"all\",\n)\nprint(response)"
  },
  "tags": [
   "web-search",
   "proprietary-data",
   "academic",
   "finance",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "google-custom-search",
  "name": "Google Programmable Search (Custom Search JSON API)",
  "category": "search-retrieval",
  "kind": "api",
  "oneLiner": "Google's official JSON API to query a Programmable Search Engine — a cheap, widely-used web/image search baseline for retrieval.",
  "blurb": "Google's official JSON API to query a Programmable Search Engine — a cheap, widely-used web/image search baseline for retrieval.",
  "website": "https://developers.google.com/custom-search/v1/overview",
  "docsUrl": "https://developers.google.com/custom-search/v1/using_rest",
  "signupUrl": "https://console.cloud.google.com/apis/library/customsearch.googleapis.com",
  "pricingModel": "freemium",
  "pricingNote": "Free 100 queries/day; then $5 per 1,000 queries up to 10k/day",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Requires a Google Cloud project, enabling the API, an API key, and a Programmable Search Engine (cx) — a human must set up GCP.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Java"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_CX&q=lectures\""
  },
  "tags": [
   "web-search",
   "google",
   "baseline",
   "retrieval",
   "json-api"
  ],
  "useCases": []
 },
 {
  "slug": "elevenlabs",
  "name": "ElevenLabs",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Ultra-realistic text-to-speech, voice cloning, dubbing, and voice-agent APIs for developers and creators.",
  "blurb": "Ultra-realistic text-to-speech, voice cloning, dubbing, and voice-agent APIs for developers and creators.",
  "website": "https://elevenlabs.io",
  "docsUrl": "https://elevenlabs.io/docs",
  "signupUrl": "https://elevenlabs.io/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Free tier 10k credits/mo; TTS ~$0.10/1k chars (Multilingual v2), Flash ~$0.05; PAYG available (prices cut mid-2026).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free email signup, no credit card; API key issued instantly under Settings → API Keys. No public account-provisioning API.",
  "mcpServer": "https://github.com/elevenlabs/elevenlabs-mcp",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from elevenlabs import ElevenLabs, play\n\nclient = ElevenLabs(api_key=\"ELEVENLABS_API_KEY\")\naudio = client.text_to_speech.convert(\n    voice_id=\"JBFqnCBsd6RMkjVDRZzb\",\n    model_id=\"eleven_multilingual_v2\",\n    text=\"The first move is what sets everything in motion.\",\n    output_format=\"mp3_44100_128\",\n)\nplay(audio)"
  },
  "tags": [
   "tts",
   "voice-cloning",
   "dubbing",
   "voice-agents"
  ],
  "useCases": []
 },
 {
  "slug": "deepgram",
  "name": "Deepgram",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Fast, accurate speech-to-text, text-to-speech, and voice-agent APIs built for real-time and batch at scale.",
  "blurb": "Fast, accurate speech-to-text, text-to-speech, and voice-agent APIs built for real-time and batch at scale.",
  "website": "https://deepgram.com",
  "docsUrl": "https://developers.deepgram.com",
  "signupUrl": "https://console.deepgram.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "$200 free credit, no card; STT from $0.0043/min (batch), TTS $30/1M chars; Voice Agent bundle ~$4.50/hr.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup with $200 credit, no credit card; instant API key in the console. A Management API can create/rotate keys programmatically once an account+project exists.",
  "mcpServer": "https://github.com/deepgram/mcp",
  "sdks": [
   "Python",
   "JavaScript",
   "Go",
   ".NET",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from deepgram import DeepgramClient, PrerecordedOptions\n\ndeepgram = DeepgramClient(\"DEEPGRAM_API_KEY\")\nresponse = deepgram.listen.rest.v(\"1\").transcribe_url(\n    {\"url\": \"https://dpgr.am/spacewalk.wav\"},\n    PrerecordedOptions(model=\"nova-3\", smart_format=True),\n)\nprint(response.results.channels[0].alternatives[0].transcript)"
  },
  "tags": [
   "stt",
   "tts",
   "voice-agents",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "assemblyai",
  "name": "AssemblyAI",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Speech-to-text and audio-intelligence API — transcription, diarization, summarization, and LLM-over-audio (LeMUR).",
  "blurb": "Speech-to-text and audio-intelligence API — transcription, diarization, summarization, and LLM-over-audio (LeMUR).",
  "website": "https://www.assemblyai.com",
  "docsUrl": "https://www.assemblyai.com/docs",
  "signupUrl": "https://www.assemblyai.com/dashboard/signup",
  "pricingModel": "freemium",
  "pricingNote": "$50 free credits, no card; Universal STT $0.15/hr ($0.0025/min); audio-intelligence add-ons priced separately.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free account with $50 credit, no credit card; API key shown immediately in the dashboard. No public signup API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import assemblyai as aai\n\naai.settings.api_key = \"ASSEMBLYAI_API_KEY\"\ntranscript = aai.Transcriber().transcribe(\"https://assembly.ai/wildfires.mp3\")\nprint(transcript.text)"
  },
  "tags": [
   "stt",
   "transcription",
   "diarization",
   "audio-intelligence"
  ],
  "useCases": []
 },
 {
  "slug": "cartesia",
  "name": "Cartesia",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Sonic — ultra-low-latency (~90ms), emotive real-time text-to-speech and voice cloning for live voice agents.",
  "blurb": "Sonic — ultra-low-latency (~90ms), emotive real-time text-to-speech and voice cloning for live voice agents.",
  "website": "https://cartesia.ai",
  "docsUrl": "https://docs.cartesia.ai",
  "signupUrl": "https://play.cartesia.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free tier ~20k credits/mo, no card; billed 1 credit/char (1.5 for Pro voice cloning); Pro from ~$5/mo.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup, no credit card; API key from the Playground dashboard in minutes.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from cartesia import Cartesia\n\nclient = Cartesia(api_key=\"CARTESIA_API_KEY\")\naudio = client.tts.bytes(\n    model_id=\"sonic-3\",\n    transcript=\"I can't wait to see what you'll create!\",\n    voice={\"mode\": \"id\", \"id\": \"6ccbfb76-1fc6-48f7-b71d-91ac6298247b\"},\n    output_format={\"container\": \"wav\", \"sample_rate\": 44100, \"encoding\": \"pcm_f32le\"},\n)\nwith open(\"out.wav\", \"wb\") as f:\n    for chunk in audio:\n        f.write(chunk)"
  },
  "tags": [
   "tts",
   "low-latency",
   "voice-cloning",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "hume",
  "name": "Hume AI",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Empathic Voice Interface (EVI) and Octave TTS — emotionally intelligent, context-aware expressive speech.",
  "blurb": "Empathic Voice Interface (EVI) and Octave TTS — emotionally intelligent, context-aware expressive speech.",
  "website": "https://www.hume.ai",
  "docsUrl": "https://dev.hume.ai",
  "signupUrl": "https://platform.hume.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free plan 10k chars + 5 EVI min/mo; Octave TTS $0.05–$0.15/1k chars; EVI overage $0.04–$0.06/min.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; API key + secret from the platform portal. No account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "tts",
   "voice-agents",
   "emotion",
   "empathic"
  ],
  "useCases": []
 },
 {
  "slug": "playht",
  "name": "PlayAI (PlayHT)",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Generative text-to-speech API with 900+ voices, instant voice cloning, and low-latency streaming for conversational AI.",
  "blurb": "Generative text-to-speech API with 900+ voices, instant voice cloning, and low-latency streaming for conversational AI.",
  "website": "https://play.ht",
  "docsUrl": "https://docs.play.ht",
  "signupUrl": "https://play.ht",
  "pricingModel": "freemium",
  "pricingNote": "Free tier available; Creator ~$39/mo; PlayDialog/3.0 engines with sub-300ms streaming; usage billed per character.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Generate a User ID + API key in the dashboard on free signup. Offers HTTP, WebSocket, and gRPC.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node.js",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pyht import Client\nfrom pyht.client import TTSOptions\n\nclient = Client(user_id=\"PLAY_USER_ID\", api_key=\"PLAY_API_KEY\")\noptions = TTSOptions(voice=\"s3://voice-cloning-zero-shot/.../manifest.json\")\nwith open(\"out.mp3\", \"wb\") as f:\n    for chunk in client.tts(\"Hello from Play.\", options, voice_engine=\"PlayDialog\"):\n        f.write(chunk)"
  },
  "tags": [
   "tts",
   "voice-cloning",
   "streaming",
   "conversational-ai"
  ],
  "useCases": []
 },
 {
  "slug": "lmnt",
  "name": "LMNT",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Low-latency (150–200ms) multilingual text-to-speech with studio-quality voices and instant cloning.",
  "blurb": "Low-latency (150–200ms) multilingual text-to-speech with studio-quality voices and instant cloning.",
  "website": "https://www.lmnt.com",
  "docsUrl": "https://docs.lmnt.com",
  "signupUrl": "https://app.lmnt.com",
  "pricingModel": "freemium",
  "pricingNote": "Free tier 15k chars; Indie $10/mo (200k chars), Pro $49/mo (1.25M), Premium $199/mo (5.7M).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; grab an API key from the app dashboard. Python and Node SDKs.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node.js",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import asyncio\nfrom lmnt.api import Speech\n\nasync def main():\n    async with Speech(api_key=\"LMNT_API_KEY\") as speech:\n        result = await speech.synthesize(\"Hello, world!\", voice=\"leah\")\n        with open(\"out.mp3\", \"wb\") as f:\n            f.write(result[\"audio\"])\n\nasyncio.run(main())"
  },
  "tags": [
   "tts",
   "low-latency",
   "voice-cloning",
   "conversational-ai"
  ],
  "useCases": []
 },
 {
  "slug": "rime",
  "name": "Rime",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Enterprise TTS with 200+ realistic voices, sub-200ms latency, and linguistically-aware markup for voice agents.",
  "blurb": "Enterprise TTS with 200+ realistic voices, sub-200ms latency, and linguistically-aware markup for voice agents.",
  "website": "https://rime.ai",
  "docsUrl": "https://docs.rime.ai",
  "signupUrl": "https://rime.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free plan 10k chars/mo (200+ voices); Starter $5/mo (100k chars); Growth and Enterprise tiers above.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up via Google or GitHub OAuth; every account gets free monthly characters and a Bearer API key. Models: Mist v2, Arcana, Coda.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import requests\n\nresp = requests.post(\n    \"https://users.rime.ai/v1/rime-tts\",\n    headers={\n        \"Authorization\": \"Bearer RIME_API_KEY\",\n        \"Accept\": \"audio/mp3\",\n        \"Content-Type\": \"application/json\",\n    },\n    json={\"text\": \"Hello from Rime.\", \"speaker\": \"cove\", \"modelId\": \"mistv2\"},\n)\nopen(\"out.mp3\", \"wb\").write(resp.content)"
  },
  "tags": [
   "tts",
   "low-latency",
   "voice-agents",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "speechmatics",
  "name": "Speechmatics",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "High-accuracy speech-to-text across 55+ languages, plus real-time transcription and the Flow voice-agent API.",
  "blurb": "High-accuracy speech-to-text across 55+ languages, plus real-time transcription and the Flow voice-agent API.",
  "website": "https://www.speechmatics.com",
  "docsUrl": "https://docs.speechmatics.com",
  "signupUrl": "https://portal.speechmatics.com",
  "pricingModel": "freemium",
  "pricingNote": "Free 8h/mo (2 concurrent real-time sessions); Pro batch from $0.0050/min, real-time from $0.0067/min; volume discounts 200h+.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free-tier signup issues API credentials in the portal; add a card only when you exceed the free monthly hours.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "stt",
   "transcription",
   "real-time",
   "voice-agents"
  ],
  "useCases": []
 },
 {
  "slug": "tavus",
  "name": "Tavus",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Conversational Video Interface (CVI) and Phoenix replica API — real-time, face-to-face AI video agents ('digital twins').",
  "blurb": "Conversational Video Interface (CVI) and Phoenix replica API — real-time, face-to-face AI video agents ('digital twins').",
  "website": "https://www.tavus.io",
  "docsUrl": "https://docs.tavus.io",
  "signupUrl": "https://platform.tavus.io",
  "pricingModel": "freemium",
  "pricingNote": "Free tier to start; Starter $39/mo (3 personal replicas, PAYG); Growth $375/mo (10 replicas, recordings/transcripts).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; x-api-key issued in the platform dashboard. Real-time CVI conversations plus scripted replica video generation.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "JavaScript"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://tavusapi.com/v2/videos \\\n  -H \"x-api-key: $TAVUS_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"replica_id\":\"r783537ef5\",\"script\":\"Hello from Tavus!\"}'"
  },
  "tags": [
   "video-avatar",
   "conversational-video",
   "digital-twin",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "heygen",
  "name": "HeyGen",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Programmatic AI avatar video generation and video translation/dubbing with lip-sync, via a REST API.",
  "blurb": "Programmatic AI avatar video generation and video translation/dubbing with lip-sync, via a REST API.",
  "website": "https://www.heygen.com",
  "docsUrl": "https://docs.heygen.com",
  "signupUrl": "https://app.heygen.com",
  "pricingModel": "usage-based",
  "pricingNote": "PAYG from $5; ~$1/min for 720p/1080p standard, up to ~$4/min for premium avatar engines. No free API credits since Feb 2026.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "API key is generated in Settings → API, but usage requires purchased credits (credit card) — no free API tier, so an agent needs a human/CC to run it. Also offers MCP and Skills integration paths.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.heygen.com/v2/video/generate \\\n  -H \"X-Api-Key: $HEYGEN_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"video_inputs\": [{\n      \"character\": {\"type\":\"avatar\",\"avatar_id\":\"Daisy-inskirt-20220818\"},\n      \"voice\": {\"type\":\"text\",\"input_text\":\"Hello from HeyGen\",\"voice_id\":\"2d5b0e6cf36f460aa7fc47e3eee4ba54\"}\n    }],\n    \"dimension\": {\"width\":1280,\"height\":720}\n  }'"
  },
  "tags": [
   "video-avatar",
   "video-translation",
   "dubbing",
   "lip-sync"
  ],
  "useCases": []
 },
 {
  "slug": "d-id",
  "name": "D-ID",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Talking-avatar video API — turn a photo + text/audio into a lip-synced presenter, with real-time WebRTC streaming agents.",
  "blurb": "Talking-avatar video API — turn a photo + text/audio into a lip-synced presenter, with real-time WebRTC streaming agents.",
  "website": "https://www.d-id.com",
  "docsUrl": "https://docs.d-id.com",
  "signupUrl": "https://studio.d-id.com",
  "pricingModel": "freemium",
  "pricingNote": "14-day free trial (20 credits, watermark); paid from ~$4.70/mo billed annually; API access on Pro (~$49.90/mo) and up.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Trial signup generates an API key (Basic auth) in account settings; sustained/production API use requires a paid Pro plan.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "JavaScript"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.d-id.com/talks \\\n  -H \"Authorization: Basic $DID_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"source_url\": \"https://example.com/face.jpg\",\n    \"script\": {\"type\":\"text\",\"input\":\"Hello world\",\n               \"provider\":{\"type\":\"microsoft\",\"voice_id\":\"en-US-JennyNeural\"}}\n  }'"
  },
  "tags": [
   "video-avatar",
   "talking-head",
   "streaming",
   "lip-sync"
  ],
  "useCases": []
 },
 {
  "slug": "vapi",
  "name": "Vapi",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Developer-first platform to build, test, and deploy real-time voice AI agents with pluggable STT/LLM/TTS and telephony.",
  "blurb": "Developer-first platform to build, test, and deploy real-time voice AI agents with pluggable STT/LLM/TTS and telephony.",
  "website": "https://vapi.ai",
  "docsUrl": "https://docs.vapi.ai",
  "signupUrl": "https://dashboard.vapi.ai",
  "pricingModel": "usage-based",
  "pricingNote": "$0.05/min platform orchestration fee + pass-through STT/LLM/TTS/telephony (~$0.30/min all-in); $10 initial credits.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup with $10 credits and an instant dashboard API key; continued use requires a card. Assistants API, Squads, function calling.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "TypeScript"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl https://api.vapi.ai/assistant \\\n  -H \"Authorization: Bearer $VAPI_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"name\": \"Support\",\n    \"model\": {\"provider\":\"openai\",\"model\":\"gpt-4o\"},\n    \"voice\": {\"provider\":\"11labs\",\"voiceId\":\"burt\"}\n  }'"
  },
  "tags": [
   "voice-agents",
   "orchestration",
   "telephony",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "retell-ai",
  "name": "Retell AI",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Voice-agent API for AI phone calls — build, test, and deploy production call agents with usage-based per-minute pricing.",
  "blurb": "Voice-agent API for AI phone calls — build, test, and deploy production call agents with usage-based per-minute pricing.",
  "website": "https://www.retellai.com",
  "docsUrl": "https://docs.retellai.com",
  "signupUrl": "https://dashboard.retellai.com",
  "pricingModel": "usage-based",
  "pricingNote": "Starts at $0 PAYG; voice engine $0.07/min (+LLM + ~$0.015/min telephony, ~$0.11–$0.15/min all-in); 20 concurrent calls free.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free PAYG signup; API key from the dashboard, go from signup to live agent in minutes. Billed only for connected calls.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node.js"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.retellai.com/create-phone-call \\\n  -H \"Authorization: Bearer $RETELL_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"from_number\": \"+14157774444\",\n    \"to_number\": \"+12137774445\",\n    \"agent_id\": \"agent_123\"\n  }'"
  },
  "tags": [
   "voice-agents",
   "phone-calls",
   "telephony",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "fish-audio",
  "name": "Fish Audio",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "OpenAudio (S1/S2) text-to-speech and voice cloning — open models plus a hosted pay-as-you-go API.",
  "blurb": "OpenAudio (S1/S2) text-to-speech and voice cloning — open models plus a hosted pay-as-you-go API.",
  "website": "https://fish.audio",
  "docsUrl": "https://docs.fish.audio",
  "signupUrl": "https://fish.audio",
  "pricingModel": "freemium",
  "pricingNote": "Free plan 8k credits/mo (personal use); Plus ~$20/mo; API PAYG $15/1M UTF-8 bytes (s2-pro). S2.1 Pro API free through Jul 2026.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; generate a Bearer API key in the dashboard. Open-weights models (OpenAudio) also self-hostable.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "tts",
   "voice-cloning",
   "open-weights",
   "multilingual"
  ],
  "useCases": []
 },
 {
  "slug": "synthesia",
  "name": "Synthesia",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Studio-grade AI avatar video generation API — script-to-video with 200+ avatars, translation, and templates.",
  "blurb": "Studio-grade AI avatar video generation API — script-to-video with 200+ avatars, translation, and templates.",
  "website": "https://www.synthesia.io",
  "docsUrl": "https://docs.synthesia.io",
  "signupUrl": "https://app.synthesia.io",
  "pricingModel": "paid",
  "pricingNote": "API access starts on the Creator plan ($89/mo, or $64/mo annual); Free/Starter plans have no API. API usage ~$1/min (Avatar III 1080p) up to ~$5/min (Avatar IV 4K).",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "API is gated behind the paid Creator plan — an agent cannot get a usable key without a human/credit card. Key is created in account settings and passed via the Authorization header.",
  "mcpServer": "",
  "sdks": [
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.synthesia.io/v2/videos \\\n  -H \"Authorization: $SYNTHESIA_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"test\": true,\n    \"input\": [{\"avatar\":\"anna_costume1_cameraA\",\"scriptText\":\"Hello, World!\"}]\n  }'"
  },
  "tags": [
   "video-avatar",
   "script-to-video",
   "translation",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "sync-so",
  "name": "Sync (sync. labs)",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Studio-grade AI lip-sync and visual dubbing API — retime any video's mouth to new audio in any language.",
  "blurb": "Studio-grade AI lip-sync and visual dubbing API — retime any video's mouth to new audio in any language.",
  "website": "https://sync.so",
  "docsUrl": "https://sync.so/docs",
  "signupUrl": "https://app.sync.so",
  "pricingModel": "freemium",
  "pricingNote": "Free plan (API included); Hobbyist $5, Creator $19, Growth $49, Scale $249/mo; usage $0.04/sec (lipsync-2) to $0.133/sec (sync-3) at 25fps.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "API access even on the free tier; create an API key from the dashboard. Python and TypeScript SDKs. Models: lipsync-2, lipsync-2-pro, sync-3.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "lip-sync",
   "visual-dubbing",
   "video",
   "avatar"
  ],
  "useCases": []
 },
 {
  "slug": "gladia",
  "name": "Gladia",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Audio-infrastructure API for voice products — async and real-time speech-to-text with diarization and translation.",
  "blurb": "Audio-infrastructure API for voice products — async and real-time speech-to-text with diarization and translation.",
  "website": "https://www.gladia.io",
  "docsUrl": "https://docs.gladia.io",
  "signupUrl": "https://app.gladia.io",
  "pricingModel": "freemium",
  "pricingNote": "Permanent free tier 10h/mo, no card (incl. diarization + real-time); paid from $0.61/hr async, $0.75/hr real-time.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup, no credit card; API key used via the x-gladia-key header against api.gladia.io/v2/.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": null,
  "tags": [
   "stt",
   "transcription",
   "diarization",
   "real-time"
  ],
  "useCases": []
 },
 {
  "slug": "resemble-ai",
  "name": "Resemble AI",
  "category": "voice-media",
  "kind": "api",
  "oneLiner": "Voice cloning and generative speech API, plus deepfake detection and audio watermarking, billed per second.",
  "blurb": "Voice cloning and generative speech API, plus deepfake detection and audio watermarking, billed per second.",
  "website": "https://www.resemble.ai",
  "docsUrl": "https://docs.app.resemble.ai",
  "signupUrl": "https://app.resemble.ai",
  "pricingModel": "freemium",
  "pricingNote": "Flex plan starts at $0 PAYG; TTS $0.0005/synthesis-sec, voice clones $2–$5/mo each; deepfake Detect ~$0.04/sec.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Flex plan ($0 start) gives dashboard API access on signup; Python package/REST for TTS, cloning, and deepfake detection.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "voice-cloning",
   "tts",
   "deepfake-detection",
   "watermarking"
  ],
  "useCases": []
 },
 {
  "slug": "agentmail",
  "name": "AgentMail",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Email inbox API purpose-built for AI agents — programmatically create real inboxes that can send, receive, and reply in threads.",
  "blurb": "Email inbox API purpose-built for AI agents — programmatically create real inboxes that can send, receive, and reply in threads.",
  "website": "https://agentmail.to",
  "docsUrl": "https://docs.agentmail.to",
  "signupUrl": "",
  "pricingModel": "free-tier",
  "pricingNote": "Free: 3 inboxes + 3,000 emails/mo; Developer $20/mo, Startup $200/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Agent Onboarding API: the agent registers itself with a human email and gets back an API key, inbox ID, and org ID; a 6-digit OTP to that email unlocks full permissions. Inboxes are then created programmatically in one call. Idempotent signup endpoint.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "SMTP/IMAP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from agentmail import AgentMail\n\nclient = AgentMail(api_key=\"am_...\")\n\ninbox = client.inboxes.create()\nclient.inboxes.messages.send(\n    inbox.inbox_id,\n    to=\"founder@example.com\",\n    subject=\"Hello from my agent\",\n    text=\"This inbox was created and sent programmatically.\",\n)"
  },
  "tags": [
   "email",
   "agent-native",
   "inbox",
   "mcp",
   "webhooks"
  ],
  "useCases": []
 },
 {
  "slug": "resend",
  "name": "Resend",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Developer-first transactional email API with a clean SDK, React email templates, and instant self-serve API keys.",
  "blurb": "Developer-first transactional email API with a clean SDK, React email templates, and instant self-serve API keys.",
  "website": "https://resend.com",
  "docsUrl": "https://resend.com/docs",
  "signupUrl": "https://resend.com/signup",
  "pricingModel": "free-tier",
  "pricingNote": "Free: 3,000 emails/mo (100/day); Pro from $20/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up free and generate an API key immediately from the dashboard; domain verification required before sending from your own domain (or use the shared onboarding@resend.dev). API also manages domains/keys programmatically.",
  "mcpServer": "https://github.com/resend/mcp-send-email",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "Go",
   "Rust",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import resend\n\nresend.api_key = \"re_...\"\n\nresend.Emails.send({\n    \"from\": \"onboarding@resend.dev\",\n    \"to\": \"user@example.com\",\n    \"subject\": \"Hello\",\n    \"html\": \"<p>Sent with Resend</p>\",\n})"
  },
  "tags": [
   "email",
   "transactional",
   "developer",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "postmark",
  "name": "Postmark",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Fast, reliable transactional email API and SMTP known for deliverability and long message history.",
  "blurb": "Fast, reliable transactional email API and SMTP known for deliverability and long message history.",
  "website": "https://postmarkapp.com",
  "docsUrl": "https://postmarkapp.com/developer",
  "signupUrl": "https://account.postmarkapp.com/sign_up",
  "pricingModel": "free-tier",
  "pricingNote": "Free dev plan: 100 emails/mo (never expires); paid from $15/mo for 10k emails",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup issues per-server API tokens immediately; sending accounts go through an approval check and sender-signature/domain verification before high-volume sending.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   ".NET",
   "Go",
   "Java",
   "REST",
   "SMTP"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import { ServerClient } from \"postmark\";\n\nconst client = new ServerClient(\"POSTMARK_SERVER_TOKEN\");\n\nawait client.sendEmail({\n  From: \"you@yourdomain.com\",\n  To: \"user@example.com\",\n  Subject: \"Hello\",\n  HtmlBody: \"<p>Sent with Postmark</p>\",\n});"
  },
  "tags": [
   "email",
   "transactional",
   "deliverability"
  ],
  "useCases": []
 },
 {
  "slug": "twilio",
  "name": "Twilio",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "The market-standard programmable communications platform: SMS, voice, WhatsApp, verification, and phone numbers via API.",
  "blurb": "The market-standard programmable communications platform: SMS, voice, WhatsApp, verification, and phone numbers via API.",
  "website": "https://www.twilio.com",
  "docsUrl": "https://www.twilio.com/docs",
  "signupUrl": "https://www.twilio.com/try-twilio",
  "pricingModel": "usage-based",
  "pricingNote": "SMS from $0.0083/msg, voice from $0.014/min outbound (US); pay-as-you-go + free trial credit",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Account creation needs a human: phone/identity verification and, for US SMS, 10DLC brand/campaign registration and anti-fraud review. Once a parent account exists, subaccounts and phone numbers CAN be provisioned via API. Auth = Account SID + Auth Token.",
  "mcpServer": "https://github.com/twilio-labs/mcp",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "C#",
   "Java",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from twilio.rest import Client\n\nclient = Client(account_sid, auth_token)\n\nclient.messages.create(\n    from_=\"+15017122661\",\n    to=\"+15558675310\",\n    body=\"Hello from Twilio\",\n)"
  },
  "tags": [
   "sms",
   "voice",
   "whatsapp",
   "phone-numbers",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "sendgrid",
  "name": "Twilio SendGrid",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "High-volume transactional and marketing email API (now part of Twilio), widely used at enterprise scale.",
  "blurb": "High-volume transactional and marketing email API (now part of Twilio), widely used at enterprise scale.",
  "website": "https://sendgrid.com",
  "docsUrl": "https://www.twilio.com/docs/sendgrid",
  "signupUrl": "https://signup.sendgrid.com",
  "pricingModel": "freemium",
  "pricingNote": "Permanent free tier removed for new direct signups; 60-day trial then Email API from ~$19.95/mo",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "New accounts get a 60-day trial rather than a permanent free tier, plus sender-identity verification and anti-abuse review — friction for autonomous signup. An API key is generated in-dashboard once verified.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "C#",
   "Java",
   "Go",
   "REST",
   "SMTP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from sendgrid import SendGridAPIClient\nfrom sendgrid.helpers.mail import Mail\n\nmessage = Mail(\n    from_email=\"you@example.com\",\n    to_emails=\"user@example.com\",\n    subject=\"Hello\",\n    html_content=\"<p>Sent with SendGrid</p>\",\n)\nSendGridAPIClient(\"SENDGRID_API_KEY\").send(message)"
  },
  "tags": [
   "email",
   "transactional",
   "marketing",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "mailgun",
  "name": "Mailgun",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Developer email API with HTTP + SMTP sending, routing, and inbound email parsing.",
  "blurb": "Developer email API with HTTP + SMTP sending, routing, and inbound email parsing.",
  "website": "https://www.mailgun.com",
  "docsUrl": "https://documentation.mailgun.com",
  "signupUrl": "https://signup.mailgun.com/new/signup",
  "pricingModel": "free-tier",
  "pricingNote": "Forever-free: 100 emails/day, 1 domain, no card; Basic $15/mo, Foundation $35/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup with no credit card issues an API key immediately; sending from a custom domain requires DNS/domain verification first.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "Java",
   ".NET",
   "Go",
   "REST",
   "SMTP"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -s --user 'api:YOUR_API_KEY' \\\n  https://api.mailgun.net/v3/YOUR_DOMAIN/messages \\\n  -F from='you@yourdomain.com' \\\n  -F to='user@example.com' \\\n  -F subject='Hello' \\\n  -F text='Sent with Mailgun'"
  },
  "tags": [
   "email",
   "transactional",
   "inbound-parsing",
   "smtp"
  ],
  "useCases": []
 },
 {
  "slug": "loops",
  "name": "Loops",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Email platform for SaaS teams — marketing, lifecycle, and transactional email from one contact record and one API, with an agent-focused REST API.",
  "blurb": "Email platform for SaaS teams — marketing, lifecycle, and transactional email from one contact record and one API, with an agent-focused REST API.",
  "website": "https://loops.so",
  "docsUrl": "https://loops.so/docs",
  "signupUrl": "https://app.loops.so/register",
  "pricingModel": "freemium",
  "pricingNote": "Free: 1,000 contacts + 4,000 sends/mo; paid from $49/mo unlimited sends",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up free and generate a Bearer API key under Settings → API. Publishes an OpenAPI spec and an 'API for AI agents' surface to manage contacts, events, and transactional email.",
  "mcpServer": "",
  "sdks": [
   "JavaScript/TypeScript",
   "Go",
   "PHP",
   "Ruby",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://app.loops.so/api/v1/transactional \\\n  -H \"Authorization: Bearer YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"transactionalId\":\"clxxxx\",\"email\":\"user@example.com\",\"dataVariables\":{\"name\":\"Ada\"}}'"
  },
  "tags": [
   "email",
   "lifecycle",
   "saas",
   "transactional"
  ],
  "useCases": []
 },
 {
  "slug": "bland",
  "name": "Bland AI",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Enterprise voice-AI platform for phone agents — programmatically dial, converse, and transfer calls end to end.",
  "blurb": "Enterprise voice-AI platform for phone agents — programmatically dial, converse, and transfer calls end to end.",
  "website": "https://www.bland.ai",
  "docsUrl": "https://docs.bland.ai",
  "signupUrl": "https://app.bland.ai",
  "pricingModel": "usage-based",
  "pricingNote": "$0.09/min live calls (billed per second); free plan 100 calls/day, 10 concurrent; subscription tiers Build $299/mo, Scale $499/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Dashboard signup provides an API key on a free plan (100 calls/day). Send calls immediately via the API; BYO-Twilio numbers supported.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.bland.ai/v1/calls \\\n  -H \"authorization: YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"phone_number\":\"+15558675310\",\"task\":\"Call and confirm the appointment.\"}'"
  },
  "tags": [
   "voice",
   "phone-agents",
   "outbound-calls"
  ],
  "useCases": []
 },
 {
  "slug": "telnyx",
  "name": "Telnyx",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Carrier-grade programmable messaging, voice, phone numbers, and voice-AI on a private global network.",
  "blurb": "Carrier-grade programmable messaging, voice, phone numbers, and voice-AI on a private global network.",
  "website": "https://telnyx.com",
  "docsUrl": "https://developers.telnyx.com",
  "signupUrl": "https://telnyx.com/sign-up",
  "pricingModel": "usage-based",
  "pricingNote": "SMS from $0.004/msg, voice from $0.002/min, numbers from $1/mo, Voice AI from $0.05/min; no platform fee",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup gives an API key; Telnyx publishes a signup guide aimed at AI agents / coding assistants and ships an MCP server for managing numbers, messaging, and calls. Number purchase + 10DLC compliance needed before US A2P sending.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   ".NET",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import telnyx\n\ntelnyx.api_key = \"YOUR_API_KEY\"\n\ntelnyx.Message.create(\n    from_=\"+18005550199\",\n    to=\"+15558675310\",\n    text=\"Hello from Telnyx\",\n)"
  },
  "tags": [
   "sms",
   "voice",
   "phone-numbers",
   "voice-ai",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "plivo",
  "name": "Plivo",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Pay-as-you-go SMS, voice, and WhatsApp API with a fast developer onboarding path.",
  "blurb": "Pay-as-you-go SMS, voice, and WhatsApp API with a fast developer onboarding path.",
  "website": "https://www.plivo.com",
  "docsUrl": "https://www.plivo.com/docs",
  "signupUrl": "https://console.plivo.com",
  "pricingModel": "usage-based",
  "pricingNote": "US SMS ~$0.0077/msg, voice from ~$0.005/min, numbers from $0.80/mo; $10 free trial credit, no card",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with $10 trial credit and no card; Auth ID + Auth Token available immediately. 10DLC registration required for US A2P messaging.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "Java",
   "Go",
   ".NET",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import plivo\n\nclient = plivo.RestClient(\"AUTH_ID\", \"AUTH_TOKEN\")\n\nclient.messages.create(\n    src=\"+14150000000\",\n    dst=\"+15558675310\",\n    text=\"Hello from Plivo\",\n)"
  },
  "tags": [
   "sms",
   "voice",
   "whatsapp",
   "developer"
  ],
  "useCases": []
 },
 {
  "slug": "nylas",
  "name": "Nylas",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Email, calendar, and contacts API — plus Agent Accounts that give an AI agent its own real inbox and calendar in one API call.",
  "blurb": "Email, calendar, and contacts API — plus Agent Accounts that give an AI agent its own real inbox and calendar in one API call.",
  "website": "https://www.nylas.com",
  "docsUrl": "https://developer.nylas.com",
  "signupUrl": "",
  "pricingModel": "freemium",
  "pricingNote": "Free tier: 3 Agent Accounts + 3,000 emails/mo; Full Platform from $15/mo (20 agent accounts, then $0.20 each)",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Agent Accounts: Nylas-managed inboxes + calendars are provisioned for an agent in a single API call (custom domains, IMAP/SMTP) so agents send, receive, and schedule like any participant. The initial project API key is still created in the dashboard by a human.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "Java/Kotlin",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from nylas import Client\n\nnylas = Client(api_key=\"YOUR_API_KEY\")\n\nnylas.messages.send(\n    identifier=\"AGENT_GRANT_ID\",\n    request_body={\n        \"to\": [{\"email\": \"user@example.com\"}],\n        \"subject\": \"Hello\",\n        \"body\": \"Sent from an agent inbox\",\n    },\n)"
  },
  "tags": [
   "email",
   "calendar",
   "agent-accounts",
   "agent-native"
  ],
  "useCases": []
 },
 {
  "slug": "knock",
  "name": "Knock",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Notifications infrastructure for developers — orchestrate email, push, SMS, in-app, and chat from one workflow API.",
  "blurb": "Notifications infrastructure for developers — orchestrate email, push, SMS, in-app, and chat from one workflow API.",
  "website": "https://knock.app",
  "docsUrl": "https://docs.knock.app",
  "signupUrl": "https://dashboard.knock.app",
  "pricingModel": "freemium",
  "pricingNote": "Free Developer tier: 10,000 messages/mo; Starter $250/mo (50k messages), then $0.005/msg",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve dashboard signup with a free 10k-message/mo tier; API keys available immediately. Only charges for messages actually sent.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "Go",
   "Elixir",
   "PHP",
   ".NET",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import { Knock } from \"@knocklabs/node\";\n\nconst knock = new Knock(\"sk_test_...\");\n\nawait knock.workflows.trigger(\"new-comment\", {\n  recipients: [\"user_1\"],\n  data: { comment: \"Hello\" },\n});"
  },
  "tags": [
   "notifications",
   "multi-channel",
   "in-app",
   "orchestration"
  ],
  "useCases": []
 },
 {
  "slug": "courier",
  "name": "Courier",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Multi-channel notification API and orchestration for email, push, SMS, in-app, and chat with a single send call.",
  "blurb": "Multi-channel notification API and orchestration for email, push, SMS, in-app, and chat with a single send call.",
  "website": "https://www.courier.com",
  "docsUrl": "https://www.courier.com/docs",
  "signupUrl": "https://app.courier.com",
  "pricingModel": "freemium",
  "pricingNote": "Free Developer plan: 10,000 sends/mo; Business from $99/mo, then ~$0.005/send",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with a free 10k-sends/mo tier; API key issued immediately from the dashboard.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "Go",
   "PHP",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import { CourierClient } from \"@trycourier/courier\";\n\nconst courier = new CourierClient({ authorizationToken: \"YOUR_API_KEY\" });\n\nawait courier.send({\n  message: {\n    to: { email: \"user@example.com\" },\n    content: { title: \"Hello\", body: \"Sent with Courier\" },\n  },\n});"
  },
  "tags": [
   "notifications",
   "multi-channel",
   "orchestration"
  ],
  "useCases": []
 },
 {
  "slug": "vonage",
  "name": "Vonage Communications APIs",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "SMS, messaging (WhatsApp/Viber), voice, and verification APIs from Vonage (Ericsson).",
  "blurb": "SMS, messaging (WhatsApp/Viber), voice, and verification APIs from Vonage (Ericsson).",
  "website": "https://www.vonage.com/communications-apis/",
  "docsUrl": "https://developer.vonage.com",
  "signupUrl": "",
  "pricingModel": "usage-based",
  "pricingNote": "US SMS ~$0.0081 outbound / $0.0065 inbound + ~$0.00015 platform fee; pay-as-you-go, trial credit",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve dashboard signup provides an API key + secret and trial credit; number provisioning and 10DLC/sender registration required before US A2P sending. Some pricing/features need sales contact.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "Java",
   ".NET",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "sms",
   "voice",
   "whatsapp",
   "verification"
  ],
  "useCases": []
 },
 {
  "slug": "sinch",
  "name": "Sinch",
  "category": "agent-comms",
  "kind": "api",
  "oneLiner": "Enterprise communications APIs: SMS across 13+ channels, voice, email, video, and verification on one super-network.",
  "blurb": "Enterprise communications APIs: SMS across 13+ channels, voice, email, video, and verification on one super-network.",
  "website": "https://sinch.com",
  "docsUrl": "https://developers.sinch.com",
  "signupUrl": "",
  "pricingModel": "usage-based",
  "pricingNote": "US 10DLC SMS ~$0.0078 out/in (+ carrier fees), short code ~$0.009; pay-as-you-go, no platform fee, enterprise from $1,000/mo",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Dashboard signup exists, but messaging/voice onboarding typically requires sender/10DLC approval and, for many features, a sales conversation — high friction for autonomous agent signup.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Java",
   "C#",
   "PHP",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "sms",
   "voice",
   "email",
   "verification",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "sixtyfour",
  "name": "Sixtyfour",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "AI research agents that enrich people and companies and surface real-time signals from a single API call, built for GTM teams and autonomous agents.",
  "blurb": "AI research agents that enrich people and companies and surface real-time signals from a single API call, built for GTM teams and autonomous agents.",
  "website": "https://www.sixtyfour.ai/",
  "docsUrl": "https://docs.sixtyfour.ai/",
  "signupUrl": "https://app.sixtyfour.ai/",
  "pricingModel": "freemium",
  "pricingNote": "$5 free API credits on signup; paid from ~$98/mo for 350 enrichment credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup at app.sixtyfour.ai grants $5 free credits and an API key from the Keys page (Create new key); no CC required.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import requests\n\nr = requests.post(\n    \"https://api.sixtyfour.ai/enrich-lead\",\n    headers={\"x-api-key\": \"YOUR_API_KEY\", \"Content-Type\": \"application/json\"},\n    json={\n        \"lead_info\": {\"name\": \"Jane Doe\", \"company\": \"Acme\", \"location\": \"San Francisco\"},\n        \"struct\": {\n            \"email\": \"work email address\",\n            \"title\": \"job title\",\n            \"linkedin\": \"LinkedIn profile URL\",\n        },\n    },\n)\nprint(r.json())"
  },
  "tags": [
   "people-intelligence",
   "lead-enrichment",
   "ai-research",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "clay",
  "name": "Clay",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Spreadsheet-style GTM platform that waterfalls 150+ data providers and AI research (Claygent) to enrich leads and build outbound systems.",
  "blurb": "Spreadsheet-style GTM platform that waterfalls 150+ data providers and AI research (Claygent) to enrich leads and build outbound systems.",
  "website": "https://www.clay.com/",
  "docsUrl": "",
  "signupUrl": "https://www.clay.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free plan; paid from $185/mo (Launch). 2026 pricing splits Data Credits + Actions",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "Primarily a no-code UI. HTTP API access is unlocked only on Growth+ plans; there is no provisioning API, so an agent needs a human-created paid account.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Webhooks"
  ],
  "codeSample": null,
  "tags": [
   "waterfall-enrichment",
   "gtm",
   "no-code",
   "crm"
  ],
  "useCases": []
 },
 {
  "slug": "apify",
  "name": "Apify",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Marketplace and cloud runtime for thousands of ready-made scrapers ('Actors') that extract data from social media, maps, e-commerce, and any website.",
  "blurb": "Marketplace and cloud runtime for thousands of ready-made scrapers ('Actors') that extract data from social media, maps, e-commerce, and any website.",
  "website": "https://apify.com/",
  "docsUrl": "https://docs.apify.com/",
  "signupUrl": "https://console.apify.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "$5/mo free platform credit; pay per actor run, compute, and proxies",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup yields an API token in Console. Uniquely, the Apify MCP supports agentic payments (x402 on Base / Skyfire) so an agent can pay for Actor runs without an Apify token.",
  "mcpServer": "https://mcp.apify.com",
  "sdks": [
   "Python",
   "JavaScript",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import { ApifyClient } from 'apify-client';\n\nconst client = new ApifyClient({ token: 'YOUR_API_TOKEN' });\nconst run = await client.actor('apify/website-content-crawler').call({\n  startUrls: [{ url: 'https://example.com' }],\n});\nconst { items } = await client.dataset(run.defaultDatasetId).listItems();\nconsole.log(items);"
  },
  "tags": [
   "web-scraping",
   "actors",
   "automation",
   "marketplace"
  ],
  "useCases": []
 },
 {
  "slug": "bright-data",
  "name": "Bright Data",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Web-data platform with residential/datacenter proxies, Unlocker, SERP, Scraper APIs, and prebuilt datasets for large-scale collection.",
  "blurb": "Web-data platform with residential/datacenter proxies, Unlocker, SERP, Scraper APIs, and prebuilt datasets for large-scale collection.",
  "website": "https://brightdata.com/",
  "docsUrl": "https://docs.brightdata.com/",
  "signupUrl": "https://brightdata.com/",
  "pricingModel": "usage-based",
  "pricingNote": "Free trial credits; APIs from ~$1/1K requests, residential proxies ~$2.50-8/GB",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with trial credits and an instant API token, but some proxy/scraper products require KYC/business verification before use.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node"
  ],
  "codeSample": null,
  "tags": [
   "web-scraping",
   "proxies",
   "datasets",
   "serp"
  ],
  "useCases": []
 },
 {
  "slug": "people-data-labs",
  "name": "People Data Labs",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "B2B person and company data API over 900M+ profiles for enrichment, search, and identity resolution.",
  "blurb": "B2B person and company data API over 900M+ profiles for enrichment, search, and identity resolution.",
  "website": "https://www.peopledatalabs.com/",
  "docsUrl": "https://docs.peopledatalabs.com/",
  "signupUrl": "https://www.peopledatalabs.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free: 100 person/company lookups/mo (no CC); Pro from $98/mo (350 credits)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free account (no CC) gives 100 lookups/mo and an instant API key from the API Keys page.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from peopledatalabs import PDLPY\n\nclient = PDLPY(api_key=\"YOUR_API_KEY\")\nresp = client.person.enrichment(profile=[\"linkedin.com/in/janedoe\"])\nif resp.ok:\n    print(resp.json()[\"data\"])"
  },
  "tags": [
   "people-data",
   "company-data",
   "b2b",
   "enrichment"
  ],
  "useCases": []
 },
 {
  "slug": "diffbot",
  "name": "Diffbot",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "AI web-extraction and a 10B+ entity Knowledge Graph of the public web (people, companies, articles) queryable via API.",
  "blurb": "AI web-extraction and a 10B+ entity Knowledge Graph of the public web (people, companies, articles) queryable via API.",
  "website": "https://www.diffbot.com/",
  "docsUrl": "https://docs.diffbot.com/",
  "signupUrl": "https://app.diffbot.com/get-started/",
  "pricingModel": "freemium",
  "pricingNote": "Free 10,000 credits/mo (no CC); Startup $299/mo (250k credits)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup grants 10k credits/mo and an instant token (passed as ?token=) with full API access; no CC.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://api.diffbot.com/v3/analyze?token=YOUR_TOKEN&url=https%3A%2F%2Fexample.com\""
  },
  "tags": [
   "knowledge-graph",
   "web-extraction",
   "company-data",
   "crawling"
  ],
  "useCases": []
 },
 {
  "slug": "crustdata",
  "name": "Crustdata",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Real-time B2B people and company data via APIs and webhooks (search, enrich, and Watcher signal alerts), built for AI agents.",
  "blurb": "Real-time B2B people and company data via APIs and webhooks (search, enrich, and Watcher signal alerts), built for AI agents.",
  "website": "https://crustdata.com/",
  "docsUrl": "https://docs.crustdata.com/",
  "signupUrl": "https://crustdata.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free-forever tier; credit-based, custom paid plans (no public list price)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free-forever signup provides an API token (Authorization: Token header); higher volume needs a custom plan.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": null,
  "tags": [
   "b2b-data",
   "real-time",
   "people-company",
   "signals"
  ],
  "useCases": []
 },
 {
  "slug": "hunter",
  "name": "Hunter.io",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Email finder, verifier, and domain search API to turn names/domains into deliverable B2B contact data.",
  "blurb": "Email finder, verifier, and domain search API to turn names/domains into deliverable B2B contact data.",
  "website": "https://hunter.io/",
  "docsUrl": "https://hunter.io/api-documentation/v2",
  "signupUrl": "https://hunter.io/users/sign_up",
  "pricingModel": "freemium",
  "pricingNote": "Free 50 credits/mo; Starter from $49/mo (unified credits: find=1, verify=0.5)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant API key on free signup with 50 credits/mo; no CC.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "JavaScript"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://api.hunter.io/v2/email-finder?domain=example.com&first_name=Jane&last_name=Doe&api_key=YOUR_API_KEY\""
  },
  "tags": [
   "email-finder",
   "email-verify",
   "b2b",
   "enrichment"
  ],
  "useCases": []
 },
 {
  "slug": "scrapingbee",
  "name": "ScrapingBee",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Web-scraping API that handles headless browsers, JS rendering, and proxy rotation so you get HTML/data without managing infrastructure.",
  "blurb": "Web-scraping API that handles headless browsers, JS rendering, and proxy rotation so you get HTML/data without managing infrastructure.",
  "website": "https://www.scrapingbee.com/",
  "docsUrl": "https://www.scrapingbee.com/documentation/",
  "signupUrl": "https://app.scrapingbee.com/account/register",
  "pricingModel": "freemium",
  "pricingNote": "1,000 free credits (no CC); plans from $49/mo (Freelance)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant API key plus 1,000 free credits on signup; no CC required.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://app.scrapingbee.com/api/v1/?api_key=YOUR_API_KEY&url=https%3A%2F%2Fexample.com&render_js=true\""
  },
  "tags": [
   "web-scraping",
   "headless-browser",
   "proxies"
  ],
  "useCases": []
 },
 {
  "slug": "zenrows",
  "name": "ZenRows",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Scraping API and scraping browser with anti-bot bypass, premium proxies, and JS rendering for hard-to-reach sites.",
  "blurb": "Scraping API and scraping browser with anti-bot bypass, premium proxies, and JS rendering for hard-to-reach sites.",
  "website": "https://www.zenrows.com/",
  "docsUrl": "https://docs.zenrows.com/",
  "signupUrl": "https://app.zenrows.com/register",
  "pricingModel": "paid",
  "pricingNote": "14-day free trial (up to 1,000 URLs, no CC); plans from $69/mo (Developer)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant trial API key on signup (14-day, ~1,000 URLs); no CC, but no perpetual free tier.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://api.zenrows.com/v1/?apikey=YOUR_API_KEY&url=https%3A%2F%2Fexample.com&js_render=true\""
  },
  "tags": [
   "web-scraping",
   "anti-bot",
   "proxies"
  ],
  "useCases": []
 },
 {
  "slug": "coresignal",
  "name": "Coresignal",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Workforce and company data via APIs and bulk datasets (firmographics, employees, funding, technographics) refreshed continuously.",
  "blurb": "Workforce and company data via APIs and bulk datasets (firmographics, employees, funding, technographics) refreshed continuously.",
  "website": "https://coresignal.com/",
  "docsUrl": "https://docs.coresignal.com/",
  "signupUrl": "https://coresignal.com/",
  "pricingModel": "paid",
  "pricingNote": "14-day free trial (200 Collect + 400 Search credits, no CC); plans from $49/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup grants trial credits and an instant API key; no CC, but no perpetual free tier.",
  "mcpServer": "",
  "sdks": [
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "workforce-data",
   "firmographics",
   "b2b",
   "datasets"
  ],
  "useCases": []
 },
 {
  "slug": "oxylabs",
  "name": "Oxylabs",
  "category": "data-enrichment",
  "kind": "api",
  "oneLiner": "Enterprise proxy network plus Web Scraper API that returns parsed data from complex and SERP targets at scale.",
  "blurb": "Enterprise proxy network plus Web Scraper API that returns parsed data from complex and SERP targets at scale.",
  "website": "https://oxylabs.io/",
  "docsUrl": "https://developers.oxylabs.io/",
  "signupUrl": "https://dashboard.oxylabs.io/",
  "pricingModel": "usage-based",
  "pricingNote": "Free trial (2K results, unlimited duration, no CC); Web Scraper API from $49/mo (~$0.25-2/1K)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup + free trial (2K results, no CC); Scraper API credentials (basic auth) issued instantly in the dashboard.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl \"https://realtime.oxylabs.io/v1/queries\" \\\n  -u \"USERNAME:PASSWORD\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"source\": \"universal\", \"url\": \"https://example.com\"}'"
  },
  "tags": [
   "web-scraping",
   "proxies",
   "serp",
   "datasets"
  ],
  "useCases": []
 },
 {
  "slug": "browserbase",
  "name": "Browserbase",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Managed fleet of headless cloud browsers with stealth, proxies and live view — the 'AWS for browsers' most agent frameworks run on.",
  "blurb": "Managed fleet of headless cloud browsers with stealth, proxies and live view — the 'AWS for browsers' most agent frameworks run on.",
  "website": "https://www.browserbase.com/",
  "docsUrl": "https://docs.browserbase.com",
  "signupUrl": "https://www.browserbase.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Free $0; Dev $20/mo, Startup $99/mo; billed by browser-hours (compute time)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free web signup gives an instant API key + project ID in the dashboard, no card. No public account-creation API.",
  "mcpServer": "https://github.com/browserbase/mcp-server-browserbase",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "Playwright",
   "Puppeteer",
   "Selenium",
   "Stagehand"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import Browserbase from \"@browserbasehq/sdk\";\nconst bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });\nconst session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID });\n// then connect Playwright/Puppeteer over CDP:\n// const browser = await chromium.connectOverCDP(session.connectUrl);"
  },
  "tags": [
   "cloud-browser",
   "stealth",
   "proxies",
   "captcha",
   "live-view",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "steel",
  "name": "Steel",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Open-source headless browser API purpose-built for AI agents, with token-efficient content extraction and auth/session persistence.",
  "blurb": "Open-source headless browser API purpose-built for AI agents, with token-efficient content extraction and auth/session persistence.",
  "website": "https://steel.dev/",
  "docsUrl": "https://docs.steel.dev",
  "signupUrl": "https://app.steel.dev/settings/api-keys",
  "pricingModel": "freemium",
  "pricingNote": "Free: 100 browser-hours/mo, no card; paid Launch/Scale metered tiers",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at app.steel.dev gives an instant key (or run `steel login`); no card, 100 free browser-hours. Publishes an LLMs.txt for agent setup.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "Playwright",
   "Puppeteer",
   "Selenium"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from steel import Steel\nclient = Steel(steel_api_key=\"ste_your_key\")  # or STEEL_API_KEY env\nsession = client.sessions.create()\nprint(session.session_viewer_url)\n# connect Playwright/Puppeteer via wss://connect.steel.dev?apiKey=...&sessionId=..."
  },
  "tags": [
   "cloud-browser",
   "open-source",
   "captcha",
   "auth-sessions",
   "agent-first",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "hyperbrowser",
  "name": "Hyperbrowser",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Cloud Chrome sessions for agents with stealth fingerprinting, proxy rotation and auto-CAPTCHA, plus the open-source HyperAgent framework.",
  "blurb": "Cloud Chrome sessions for agents with stealth fingerprinting, proxy rotation and auto-CAPTCHA, plus the open-source HyperAgent framework.",
  "website": "https://www.hyperbrowser.ai/",
  "docsUrl": "https://hyperbrowser.ai/docs",
  "signupUrl": "https://app.hyperbrowser.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free tier; usage credits (~100 credits/browser-hour, 1/scraped page)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup gives an instant API key (hb_...) in the dashboard; no card required.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from hyperbrowser import Hyperbrowser\nclient = Hyperbrowser(api_key=\"hb_your_key\")\nsession = client.sessions.create()\nprint(session.ws_endpoint)  # drive with Playwright/Puppeteer over CDP"
  },
  "tags": [
   "cloud-browser",
   "stealth",
   "captcha",
   "proxies",
   "yc",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "browserless",
  "name": "Browserless",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Battle-tested headless browser hosting (Chrome/Chromium) with Playwright/Puppeteer endpoints, BrowserQL and built-in CAPTCHA solving.",
  "blurb": "Battle-tested headless browser hosting (Chrome/Chromium) with Playwright/Puppeteer endpoints, BrowserQL and built-in CAPTCHA solving.",
  "website": "https://www.browserless.io/",
  "docsUrl": "https://docs.browserless.io",
  "signupUrl": "https://account.browserless.io/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free 1,000 units; Prototyping $25/mo → Scale $350/mo; billed per 30s unit",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup gives an instant token; 1,000 free units, no card. Every API endpoint available on free plan.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Playwright",
   "Puppeteer",
   "BrowserQL",
   "Selenium"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from playwright.sync_api import sync_playwright\nwith sync_playwright() as p:\n    browser = p.chromium.connect_over_cdp(\n        \"wss://production-sfo.browserless.io/chromium/playwright?token=YOUR_API_KEY\")\n    page = browser.new_page()\n    page.goto(\"https://example.com\")"
  },
  "tags": [
   "cloud-browser",
   "captcha",
   "browserql",
   "self-hostable",
   "scraping"
  ],
  "useCases": []
 },
 {
  "slug": "anchor-browser",
  "name": "Anchor Browser",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Secure cloud browsers for computer-use agents, with strong support for authenticated sessions, MFA/SSO and infinite concurrency.",
  "blurb": "Secure cloud browsers for computer-use agents, with strong support for authenticated sessions, MFA/SSO and infinite concurrency.",
  "website": "https://anchorbrowser.io/",
  "docsUrl": "https://docs.anchorbrowser.io",
  "signupUrl": "https://app.anchorbrowser.io",
  "pricingModel": "freemium",
  "pricingNote": "Free: $5 credits/mo; usage $0.01/browser + $0.05/browser-hr + $0.01/step",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Signup gives an API key (ANCHOR_API_KEY) in the dashboard; $5 free credits/mo, no card. Authenticated browsers require a paid tier.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "Playwright"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import os\nfrom anchorbrowser import Anchorbrowser\nclient = Anchorbrowser(api_key=os.getenv(\"ANCHOR_API_KEY\"))\nsession = client.sessions.create()  # then drive via Playwright over CDP"
  },
  "tags": [
   "cloud-browser",
   "computer-use",
   "authenticated",
   "mfa-sso",
   "crewai"
  ],
  "useCases": []
 },
 {
  "slug": "scrapybara",
  "name": "Scrapybara",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "API-driven virtual desktops (Ubuntu/Windows/browser) for agents — full OS + browser control with an Act SDK for computer-use models.",
  "blurb": "API-driven virtual desktops (Ubuntu/Windows/browser) for agents — full OS + browser control with an Act SDK for computer-use models.",
  "website": "https://scrapybara.com/",
  "docsUrl": "https://docs.scrapybara.com",
  "signupUrl": "https://scrapybara.com/dashboard",
  "pricingModel": "freemium",
  "pricingNote": "Free: 10 compute-hrs + 100 agent credits; plans from $29/mo; $0.04/credit",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup gives an instant API key; 10 free compute-hours, 5 concurrent instances. Can BYO model provider key.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from scrapybara import Scrapybara\nclient = Scrapybara()  # reads SCRAPYBARA_API_KEY\ninstance = client.start_ubuntu()\n# instance.browser, instance.computer, instance.act(...) etc."
  },
  "tags": [
   "virtual-desktop",
   "computer-use",
   "os-control",
   "yc",
   "act-sdk"
  ],
  "useCases": []
 },
 {
  "slug": "skyvern",
  "name": "Skyvern",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "LLM + computer-vision browser automation that reads pages visually instead of brittle CSS selectors; open-source with a hosted cloud.",
  "blurb": "LLM + computer-vision browser automation that reads pages visually instead of brittle CSS selectors; open-source with a hosted cloud.",
  "website": "https://www.skyvern.com/",
  "docsUrl": "https://docs.skyvern.com",
  "signupUrl": "https://app.skyvern.com",
  "pricingModel": "freemium",
  "pricingNote": "Cloud free 5,000 credits/mo; Hobby $29, Pro $149; self-host is free (AGPL)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Cloud: free signup gives an instant key (5k credits/mo). Or self-host the AGPL repo with your own LLM key (OpenAI/Anthropic/Gemini/Ollama) — no signup at all.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from skyvern import Skyvern\nskyvern = Skyvern(api_key=\"YOUR_API_KEY\")\ntask = await skyvern.run_task(prompt=\"Find today's top post on Hacker News\")\nprint(task.output)"
  },
  "tags": [
   "vision-llm",
   "open-source",
   "no-code-workflows",
   "captcha",
   "2fa",
   "yc",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "browser-use",
  "name": "Browser Use",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "The popular open-source Python agent that drives a browser from natural language, now with a hosted cloud API and stealth browsers.",
  "blurb": "The popular open-source Python agent that drives a browser from natural language, now with a hosted cloud API and stealth browsers.",
  "website": "https://browser-use.com/",
  "docsUrl": "https://docs.browser-use.com",
  "signupUrl": "https://cloud.browser-use.com",
  "pricingModel": "freemium",
  "pricingNote": "Cloud free tier; Dev $29/mo; ~$0.06/browser-session-hr; the library itself is free/OSS",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Cloud: free signup gives an instant key. Or `pip install browser-use` and run fully locally with just your own LLM key — no signup needed.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST",
   "TypeScript"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from browser_use import Agent, ChatOpenAI\nagent = Agent(task=\"Find the price of the top Amazon best-seller\",\n              llm=ChatOpenAI(model=\"gpt-4.1\"))\nawait agent.run()"
  },
  "tags": [
   "open-source",
   "natural-language",
   "agent-framework",
   "stealth",
   "byok",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "airtop",
  "name": "Airtop",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Cloud browser automation controlled with natural language, handling OAuth/2FA/CAPTCHA for sales, marketing and research agents.",
  "blurb": "Cloud browser automation controlled with natural language, handling OAuth/2FA/CAPTCHA for sales, marketing and research agents.",
  "website": "https://www.airtop.ai/",
  "docsUrl": "https://developers.airtop.ai",
  "signupUrl": "https://portal.airtop.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free tier; pay-per-run pricing",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at portal.airtop.ai, then create an API key in the dashboard; no card.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "import { AirtopClient } from \"@airtop/sdk\";\nconst client = new AirtopClient({ apiKey: process.env.AIRTOP_API_KEY });\nconst session = await client.sessions.create();"
  },
  "tags": [
   "cloud-browser",
   "natural-language",
   "authenticated",
   "gtm",
   "no-api-portals"
  ],
  "useCases": []
 },
 {
  "slug": "kernel",
  "name": "Kernel",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Unikernel-based cloud browsers with sub-150ms cold starts and a full REST control plane (profiles, proxies, replays, computer-use).",
  "blurb": "Unikernel-based cloud browsers with sub-150ms cold starts and a full REST control plane (profiles, proxies, replays, computer-use).",
  "website": "https://www.kernel.sh/",
  "docsUrl": "https://www.kernel.sh/docs",
  "signupUrl": "https://www.kernel.sh/",
  "pricingModel": "freemium",
  "pricingNote": "Free $5 credits/mo; Hobbyist $30/mo, Startup $200/mo; usage from ~$0.00002/s headless",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup gives an instant API key (KERNEL_API_KEY); $5 free credits, pay-as-you-go beyond. REST API can also mint/manage further keys.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "Playwright"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from kernel import Kernel\nclient = Kernel()  # reads KERNEL_API_KEY\nkb = client.browsers.create()\nprint(kb.cdp_ws_url)  # drive with Playwright/Puppeteer over CDP"
  },
  "tags": [
   "cloud-browser",
   "fast-coldstart",
   "unikernel",
   "computer-use",
   "replays",
   "yc"
  ],
  "useCases": []
 },
 {
  "slug": "notte",
  "name": "Notte",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Browser platform for AI that turns any web workflow into a reliable, deployable API, with web agents and a perception layer for LLMs.",
  "blurb": "Browser platform for AI that turns any web workflow into a reliable, deployable API, with web agents and a perception layer for LLMs.",
  "website": "https://www.notte.cc/",
  "docsUrl": "https://docs.notte.cc",
  "signupUrl": "https://console.notte.cc",
  "pricingModel": "freemium",
  "pricingNote": "Free: 100 browser-hrs + 5 concurrent; paid from $20/mo; $0.05/browser-hr",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup gives an instant key (NOTTE_API_KEY); 100 free browser-hours, no card. Open-source framework on GitHub.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from notte_sdk import NotteClient\nclient = NotteClient()  # reads NOTTE_API_KEY\nwith client.Session() as session:\n    agent = client.Agent(session=session)\n    print(agent.run(task=\"Find the top post on Hacker News\"))"
  },
  "tags": [
   "cloud-browser",
   "web-agents",
   "workflow-to-api",
   "open-source",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "bright-data-browser-api",
  "name": "Bright Data Browser API",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Enterprise-grade unblocking browser (Scraping Browser) with automatic CAPTCHA/fingerprint handling over a huge residential proxy network.",
  "blurb": "Enterprise-grade unblocking browser (Scraping Browser) with automatic CAPTCHA/fingerprint handling over a huge residential proxy network.",
  "website": "https://brightdata.com/products/scraping-browser",
  "docsUrl": "https://docs.brightdata.com/scraping-automation/scraping-browser/overview",
  "signupUrl": "https://brightdata.com/",
  "pricingModel": "usage-based",
  "pricingNote": "No free tier; Browser API ~$5/GB; free trial + first-deposit match up to $500",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Account needs KYC/verification and typically a deposit; no instant free key — not practical for autonomous agent self-signup.",
  "mcpServer": "",
  "sdks": [
   "Playwright",
   "Puppeteer",
   "Selenium",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from playwright.sync_api import sync_playwright\nSBR = \"wss://brd-customer-<id>-zone-<zone>:<password>@brd.superproxy.io:9222\"\nwith sync_playwright() as p:\n    browser = p.chromium.connect_over_cdp(SBR)\n    page = browser.new_page()\n    page.goto(\"https://example.com\")"
  },
  "tags": [
   "unblocker",
   "residential-proxies",
   "captcha",
   "enterprise",
   "scraping",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "amazon-nova-act",
  "name": "Amazon Nova Act",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "AWS service + SDK for building reliable browser agents that automate production UI workflows, with an IDE extension and AWS deploy path.",
  "blurb": "AWS service + SDK for building reliable browser agents that automate production UI workflows, with an IDE extension and AWS deploy path.",
  "website": "https://aws.amazon.com/nova/act/",
  "docsUrl": "https://github.com/aws/nova-act",
  "signupUrl": "https://nova.amazon.com/act",
  "pricingModel": "usage-based",
  "pricingNote": "Now GA as an AWS service (usage-based via AWS); the earlier SDK preview was free",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Requires a human Amazon/AWS account (US-based); the NOVA_ACT_API_KEY is generated at nova.amazon.com after login — not agent-self-serve.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Playwright"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from nova_act import NovaAct  # export NOVA_ACT_API_KEY=...\nwith NovaAct(starting_page=\"https://www.amazon.com\") as nova:\n    nova.act(\"search for a coffee maker and open the first result\")"
  },
  "tags": [
   "aws",
   "browser-agent",
   "ui-automation",
   "enterprise",
   "sdk"
  ],
  "useCases": []
 },
 {
  "slug": "lightpanda",
  "name": "Lightpanda",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "An open-source headless browser written from scratch in Zig for AI/automation — ~11x faster and ~9x lighter than Chrome, CDP-compatible.",
  "blurb": "An open-source headless browser written from scratch in Zig for AI/automation — ~11x faster and ~9x lighter than Chrome, CDP-compatible.",
  "website": "https://lightpanda.io/",
  "docsUrl": "https://github.com/lightpanda-io/browser",
  "signupUrl": "https://lightpanda.io/",
  "pricingModel": "open-source",
  "pricingNote": "Self-host free (AGPL-3.0); managed cloud in early access, pricing not yet public",
  "authType": "none",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-host (AGPL) needs NO signup or key at all — fully agent-autonomous, connect any Playwright/Puppeteer client over CDP. Managed cloud is early-access/waitlist.",
  "mcpServer": "",
  "sdks": [
   "CDP",
   "Playwright",
   "Puppeteer",
   "CLI"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "# Self-host: run the browser, then drive it over CDP with Playwright/Puppeteer\nlightpanda serve --host 127.0.0.1 --port 9222\n# ws endpoint -> ws://127.0.0.1:9222"
  },
  "tags": [
   "open-source",
   "headless-browser",
   "fast",
   "low-memory",
   "self-host",
   "zig"
  ],
  "useCases": []
 },
 {
  "slug": "stagehand",
  "name": "Stagehand",
  "category": "browser-automation",
  "kind": "api",
  "oneLiner": "Open-source SDK for browser agents (act/extract/observe/agent) that mixes natural-language and code; runs locally or on Browserbase.",
  "blurb": "Open-source SDK for browser agents (act/extract/observe/agent) that mixes natural-language and code; runs locally or on Browserbase.",
  "website": "https://stagehand.dev/",
  "docsUrl": "https://docs.stagehand.dev",
  "signupUrl": "https://github.com/browserbase/stagehand",
  "pricingModel": "open-source",
  "pricingNote": "Free (MIT); you pay only your own LLM usage + optional Browserbase hosting",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "No Stagehand account — open-source SDK; an agent just needs an existing LLM API key. Runs locally (free) or on Browserbase (self-serve instant key).",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "Playwright"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Stagehand } from \"@browserbasehq/stagehand\";\nconst stagehand = new Stagehand({ env: \"LOCAL\" });\nawait stagehand.init();\nconst page = stagehand.page;\nawait page.goto(\"https://example.com\");\nawait page.act(\"click the login button\");"
  },
  "tags": [
   "open-source",
   "agent-sdk",
   "natural-language",
   "self-healing",
   "byok"
  ],
  "useCases": []
 },
 {
  "slug": "openrouter",
  "name": "OpenRouter",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "A single OpenAI-compatible API that routes to 300+ LLMs from every major provider, with per-key budgets and programmatic key provisioning.",
  "blurb": "A single OpenAI-compatible API that routes to 300+ LLMs from every major provider, with per-key budgets and programmatic key provisioning.",
  "website": "https://openrouter.ai",
  "docsUrl": "https://openrouter.ai/docs",
  "signupUrl": "https://openrouter.ai/keys",
  "pricingModel": "usage-based",
  "pricingNote": "Pass-through provider prices + flat 5.5% credit-purchase fee; $1 free credits on signup; 20+ genuinely free models",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Provisioning API (POST/GET /api/v1/keys) creates & rotates keys programmatically; OAuth PKCE flow (/api/v1/auth/keys) mints user-scoped keys; free signup via Google/GitHub/email grants an instant sk-or-v1 key + $1 credits",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://openrouter.ai/api/v1\",\n                api_key=\"sk-or-...\")\nr = client.chat.completions.create(\n    model=\"anthropic/claude-3.5-sonnet\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "llm-router",
   "openai-compatible",
   "multi-provider"
  ],
  "useCases": []
 },
 {
  "slug": "together-ai",
  "name": "Together AI",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Serverless and dedicated inference for 200+ open models (Llama, DeepSeek, Qwen, FLUX) plus fine-tuning, aimed at production AI teams.",
  "blurb": "Serverless and dedicated inference for 200+ open models (Llama, DeepSeek, Qwen, FLUX) plus fine-tuning, aimed at production AI teams.",
  "website": "https://www.together.ai",
  "docsUrl": "https://docs.together.ai/",
  "signupUrl": "https://api.together.ai/",
  "pricingModel": "usage-based",
  "pricingNote": "Serverless ~$0.03-$4.50 /M tokens; $5 free credits on signup; Batch API up to 50% off",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free email/OAuth signup, $5 credits, instant key from API Keys settings; creating a key is free (pay per use)",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from together import Together\nclient = Together(api_key=\"TOGETHER_API_KEY\")\nr = client.chat.completions.create(\n    model=\"meta-llama/Llama-3.3-70B-Instruct-Turbo\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "open-models",
   "fine-tuning"
  ],
  "useCases": []
 },
 {
  "slug": "fireworks-ai",
  "name": "Fireworks AI",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Fast serverless inference for open models with serverless, on-demand, and reserved-capacity deployment tiers.",
  "blurb": "Fast serverless inference for open models with serverless, on-demand, and reserved-capacity deployment tiers.",
  "website": "https://fireworks.ai",
  "docsUrl": "https://docs.fireworks.ai/",
  "signupUrl": "https://fireworks.ai/account/api-keys",
  "pricingModel": "usage-based",
  "pricingNote": "~$0.07-$0.90 /M input tokens; cached input & batch at 50%; $1 free starter credit",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up at fireworks.ai, generate key in dashboard; $1 free credit (~1M tokens on a 70B model)",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://api.fireworks.ai/inference/v1\",\n                api_key=\"FIREWORKS_API_KEY\")\nr = client.chat.completions.create(\n    model=\"accounts/fireworks/models/llama-v3p3-70b-instruct\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "open-models",
   "fast-inference"
  ],
  "useCases": []
 },
 {
  "slug": "groq",
  "name": "Groq (GroqCloud)",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Ultra-fast inference on custom LPU chips (500+ tokens/sec) for open models like Llama, Qwen, and DeepSeek distills.",
  "blurb": "Ultra-fast inference on custom LPU chips (500+ tokens/sec) for open models like Llama, Qwen, and DeepSeek distills.",
  "website": "https://groq.com",
  "docsUrl": "https://console.groq.com/docs",
  "signupUrl": "https://console.groq.com/keys",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (no CC, ~30 RPM); paid ~$0.05-$0.90 /M input; batch 50% off",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup (email verify), no credit card; instant key at console.groq.com/keys; Developer tier adds a card for higher limits",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from groq import Groq\nclient = Groq(api_key=\"GROQ_API_KEY\")\nr = client.chat.completions.create(\n    model=\"llama-3.3-70b-versatile\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "fast-inference",
   "lpu",
   "open-models"
  ],
  "useCases": []
 },
 {
  "slug": "replicate",
  "name": "Replicate",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Run thousands of community and official AI models (image, video, audio, LLM) via one HTTP API with no ML infra to manage.",
  "blurb": "Run thousands of community and official AI models (image, video, audio, LLM) via one HTTP API with no ML infra to manage.",
  "website": "https://replicate.com",
  "docsUrl": "https://replicate.com/docs",
  "signupUrl": "https://replicate.com/account/api-tokens",
  "pricingModel": "usage-based",
  "pricingNote": "Pay per second of GPU time or per output (e.g. FLUX ~$0.003-$0.04/image); no subscription, idle/setup time free",
  "authType": "api-key",
  "agentSignup": "oauth",
  "agentSignupNote": "Account creation is GitHub/Google OAuth (human step); a default API token is issued on account creation; billing/card needed for most models beyond free runs",
  "mcpServer": "https://mcp.replicate.com",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import replicate\nout = replicate.run(\n    \"black-forest-labs/flux-schnell\",\n    input={\"prompt\": \"an astronaut riding a horse\"})\nprint(out)"
  },
  "tags": [
   "model-hosting",
   "image-video",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "portkey",
  "name": "Portkey",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Production AI gateway routing to 1,600+ LLMs with observability, guardrails, governance, and an MCP gateway in one API.",
  "blurb": "Production AI gateway routing to 1,600+ LLMs with observability, guardrails, governance, and an MCP gateway in one API.",
  "website": "https://portkey.ai",
  "docsUrl": "https://portkey.ai/docs",
  "signupUrl": "https://app.portkey.ai/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (logging stops after 10k logs but routing continues); paid tiers priced mainly by log volume/retention; self-host/VPC options",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Control-plane/admin API mints virtual keys & API keys programmatically with budgets and access control; parent account created via free web signup",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from portkey_ai import Portkey\nclient = Portkey(api_key=\"PORTKEY_API_KEY\",\n                 virtual_key=\"OPENAI_VIRTUAL_KEY\")\nr = client.chat.completions.create(\n    model=\"gpt-4o\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "ai-gateway",
   "observability",
   "guardrails"
  ],
  "useCases": []
 },
 {
  "slug": "litellm",
  "name": "LiteLLM",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Open-source Python SDK + proxy server (AI gateway) that calls 100+ LLM APIs in OpenAI format with cost tracking, budgets, and virtual keys.",
  "blurb": "Open-source Python SDK + proxy server (AI gateway) that calls 100+ LLM APIs in OpenAI format with cost tracking, budgets, and virtual keys.",
  "website": "https://www.litellm.ai",
  "docsUrl": "https://docs.litellm.ai/",
  "signupUrl": "https://www.litellm.ai/",
  "pricingModel": "open-source",
  "pricingNote": "MIT-licensed core is free; managed/Enterprise (SSO, guardrails, audit logs) from ~$250/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Proxy exposes /key/generate to mint per-user/per-team virtual keys (budgets, RPM/TPM limits) programmatically with the master key; hides upstream provider keys",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import litellm\nr = litellm.completion(\n    model=\"openai/gpt-4o\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "ai-gateway",
   "open-source",
   "proxy"
  ],
  "useCases": []
 },
 {
  "slug": "baseten",
  "name": "Baseten",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Production inference platform: per-token Model APIs plus dedicated GPU deployments for custom and open models.",
  "blurb": "Production inference platform: per-token Model APIs plus dedicated GPU deployments for custom and open models.",
  "website": "https://www.baseten.co",
  "docsUrl": "https://docs.baseten.co/",
  "signupUrl": "https://app.baseten.co/settings/api_keys",
  "pricingModel": "usage-based",
  "pricingNote": "Per-token Model APIs (median ~$0.60/M in, $2.20/M out) + GPU-minute billing for dedicated deployments; pay-as-you-go, no monthly minimum",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up and generate a key at app.baseten.co/settings/api_keys; OpenAI- and Anthropic-compatible endpoints",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://inference.baseten.co/v1\",\n                api_key=\"BASETEN_API_KEY\")\nr = client.chat.completions.create(\n    model=\"deepseek-ai/DeepSeek-V3\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "model-hosting",
   "dedicated-gpu"
  ],
  "useCases": []
 },
 {
  "slug": "modal",
  "name": "Modal",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Serverless GPU/CPU cloud where you define container + hardware in Python code and run per-second-billed inference, batch, and training jobs.",
  "blurb": "Serverless GPU/CPU cloud where you define container + hardware in Python code and run per-second-billed inference, batch, and training jobs.",
  "website": "https://modal.com",
  "docsUrl": "https://modal.com/docs",
  "signupUrl": "https://modal.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Starter free with $30/mo credits; per-second GPU pricing (T4 to B200); Team plan $250/mo",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Account via GitHub/Google login, then tokens are created with the `modal token new` CLI (browser step) — human-in-the-loop; $30/mo free credits after",
  "mcpServer": "",
  "sdks": [
   "Python",
   "CLI"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import modal\napp = modal.App(\"hello\")\n\n@app.function(gpu=\"A100\")\ndef generate(prompt: str):\n    # load model + run inference on the GPU\n    return prompt.upper()\n\n@app.local_entrypoint()\ndef main():\n    print(generate.remote(\"hello from a serverless GPU\"))"
  },
  "tags": [
   "serverless-gpu",
   "infrastructure",
   "python"
  ],
  "useCases": []
 },
 {
  "slug": "fal",
  "name": "fal",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Generative-media inference platform serving 600+ image/video/audio/3D models (FLUX, Kling, Sora) through one fast, queue-based API.",
  "blurb": "Generative-media inference platform serving 600+ image/video/audio/3D models (FLUX, Kling, Sora) through one fast, queue-based API.",
  "website": "https://fal.ai",
  "docsUrl": "https://docs.fal.ai/",
  "signupUrl": "https://fal.ai/dashboard/keys",
  "pricingModel": "usage-based",
  "pricingNote": "Prepaid credits, billed per successful output (e.g. FLUX schnell $0.025/image); queue wait & server errors not billed; $20 free credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Business-email signup grants $20 free credits and an instant key from the dashboard",
  "mcpServer": "",
  "sdks": [
   "Python",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import fal_client\nresult = fal_client.subscribe(\n    \"fal-ai/flux/schnell\",\n    arguments={\"prompt\": \"a cyberpunk city at night\"})\nprint(result[\"images\"][0][\"url\"])"
  },
  "tags": [
   "generative-media",
   "image-video",
   "inference"
  ],
  "useCases": []
 },
 {
  "slug": "deepinfra",
  "name": "DeepInfra",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Low-cost pay-per-use API for 50+ top open models via an OpenAI-compatible endpoint, no infra to manage.",
  "blurb": "Low-cost pay-per-use API for 50+ top open models via an OpenAI-compatible endpoint, no infra to manage.",
  "website": "https://deepinfra.com",
  "docsUrl": "https://deepinfra.com/docs",
  "signupUrl": "https://deepinfra.com/dash/api_keys",
  "pricingModel": "usage-based",
  "pricingNote": "~$0.06-$1.74 /M tokens; $1 free credits on signup, no credit card",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up (GitHub OAuth or email), $1 free credits with no card, key from the dashboard; OpenAI SDK works by swapping base_url",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://api.deepinfra.com/v1/openai\",\n                api_key=\"DEEPINFRA_API_KEY\")\nr = client.chat.completions.create(\n    model=\"meta-llama/Llama-3.3-70B-Instruct\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "low-cost",
   "open-models"
  ],
  "useCases": []
 },
 {
  "slug": "cerebras",
  "name": "Cerebras Inference",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "The fastest LLM inference in 2026 (1,800+ tokens/sec) on wafer-scale CS-3 chips, for open models like Llama and Qwen.",
  "blurb": "The fastest LLM inference in 2026 (1,800+ tokens/sec) on wafer-scale CS-3 chips, for open models like Llama and Qwen.",
  "website": "https://www.cerebras.ai",
  "docsUrl": "https://inference-docs.cerebras.ai/",
  "signupUrl": "https://cloud.cerebras.ai/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (no CC/waitlist); Developer tier 10x higher limits; per-token ~$0.60-$3.90 /M; add $10 to start dev tier",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Zero-friction email signup at cloud.cerebras.ai, no credit card or waitlist; instant key + free tier access",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from cerebras.cloud.sdk import Cerebras\nclient = Cerebras(api_key=\"CEREBRAS_API_KEY\")\nr = client.chat.completions.create(\n    model=\"llama-3.3-70b\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "fast-inference",
   "wafer-scale",
   "open-models"
  ],
  "useCases": []
 },
 {
  "slug": "sambanova-cloud",
  "name": "SambaNova Cloud",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Fast RDU-hardware inference for large open models (up to 405B) with an OpenAI-compatible API and a free developer tier.",
  "blurb": "Fast RDU-hardware inference for large open models (up to 405B) with an OpenAI-compatible API and a free developer tier.",
  "website": "https://sambanova.ai",
  "docsUrl": "https://docs.sambanova.ai/",
  "signupUrl": "https://cloud.sambanova.ai/",
  "pricingModel": "freemium",
  "pricingNote": "Free developer tier ($5 credit, no CC); paid from ~$0.10/M in to ~$4.50/M; undercuts major providers on large models",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Instant API key on signup with $5 free credit and no credit card required",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://api.sambanova.ai/v1\",\n                api_key=\"SAMBANOVA_API_KEY\")\nr = client.chat.completions.create(\n    model=\"Meta-Llama-3.3-70B-Instruct\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "fast-inference",
   "rdu",
   "large-models"
  ],
  "useCases": []
 },
 {
  "slug": "vercel-ai-gateway",
  "name": "Vercel AI Gateway",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "One API key and endpoint to reach hundreds of models across providers, with zero markup, BYOK, budgets, and native AI SDK integration.",
  "blurb": "One API key and endpoint to reach hundreds of models across providers, with zero markup, BYOK, budgets, and native AI SDK integration.",
  "website": "https://vercel.com/ai-gateway",
  "docsUrl": "https://vercel.com/docs/ai-gateway",
  "signupUrl": "https://vercel.com/ai-gateway",
  "pricingModel": "freemium",
  "pricingNote": "$5/mo included AI Gateway credits per team; pay-as-you-go with zero markup, including on BYOK",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "API keys created/rotated with per-key budgets via dashboard or Vercel CLI/API; parent Vercel team account created via web/GitHub OAuth (human step)",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "JavaScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { generateText } from 'ai';\n// Reads AI_GATEWAY_API_KEY; model routed through Vercel AI Gateway\nconst { text } = await generateText({\n  model: 'openai/gpt-4o',\n  prompt: 'Hello',\n});\nconsole.log(text);"
  },
  "tags": [
   "ai-gateway",
   "multi-provider",
   "byok"
  ],
  "useCases": []
 },
 {
  "slug": "cloudflare-ai-gateway",
  "name": "Cloudflare AI Gateway / Workers AI",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Free edge AI gateway (caching, rate/spend limits, observability) in front of any provider, plus Workers AI for serverless model inference.",
  "blurb": "Free edge AI gateway (caching, rate/spend limits, observability) in front of any provider, plus Workers AI for serverless model inference.",
  "website": "https://www.cloudflare.com",
  "docsUrl": "https://developers.cloudflare.com/ai-gateway/",
  "signupUrl": "https://dash.cloudflare.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "AI Gateway free (pass-through, no markup); free tier 100k logs/mo; Workers AI ~$0.30/M tokens with 10k free Neurons/day",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Full Cloudflare REST API creates API tokens, gateways, and Workers programmatically; Workers AI has a free daily allocation; account signup itself is web-based",
  "mcpServer": "https://github.com/cloudflare/mcp-server-cloudflare",
  "sdks": [
   "JavaScript",
   "TypeScript",
   "Python",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "export default {\n  async fetch(request, env) {\n    const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {\n      prompt: 'Hello',\n    });\n    return Response.json(res);\n  },\n};"
  },
  "tags": [
   "ai-gateway",
   "edge",
   "serverless-inference"
  ],
  "useCases": []
 },
 {
  "slug": "novita-ai",
  "name": "Novita AI",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "AI-native cloud: serverless access to 200+ open models, dedicated endpoints, GPU instances, and agent sandboxes through unified APIs.",
  "blurb": "AI-native cloud: serverless access to 200+ open models, dedicated endpoints, GPU instances, and agent sandboxes through unified APIs.",
  "website": "https://novita.ai",
  "docsUrl": "https://novita.ai/docs",
  "signupUrl": "https://novita.ai/",
  "pricingModel": "usage-based",
  "pricingNote": "Per-token from ~$0.02/M; GPUs from ~$0.35/hr; batch 50% intro discount; small free credit on signup",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up and get an API key from the dashboard; OpenAI SDK works by swapping base_url; pay per call",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://api.novita.ai/v3/openai\",\n                api_key=\"NOVITA_API_KEY\")\nr = client.chat.completions.create(\n    model=\"meta-llama/llama-3.3-70b-instruct\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "open-models",
   "gpu-cloud"
  ],
  "useCases": []
 },
 {
  "slug": "hyperbolic",
  "name": "Hyperbolic",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "Open-access GPU and AI cloud with OpenAI-compatible serverless inference for 25+ open models plus on-demand GPU rental.",
  "blurb": "Open-access GPU and AI cloud with OpenAI-compatible serverless inference for 25+ open models plus on-demand GPU rental.",
  "website": "https://www.hyperbolic.ai",
  "docsUrl": "https://docs.hyperbolic.xyz/",
  "signupUrl": "https://app.hyperbolic.ai/",
  "pricingModel": "usage-based",
  "pricingNote": "Pay-as-you-go per token (e.g. Llama 3.1 405B ~$4/M); tiers by rate limit (Basic 60 RPM, Pro 600 RPM); zero data retention",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up at app.hyperbolic.ai and generate a key from the API Keys section; pay-as-you-go",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from openai import OpenAI\nclient = OpenAI(base_url=\"https://api.hyperbolic.xyz/v1\",\n                api_key=\"HYPERBOLIC_API_KEY\")\nr = client.chat.completions.create(\n    model=\"meta-llama/Meta-Llama-3.1-70B-Instruct\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}])\nprint(r.choices[0].message.content)"
  },
  "tags": [
   "inference",
   "gpu-cloud",
   "open-models"
  ],
  "useCases": []
 },
 {
  "slug": "nebius-ai-studio",
  "name": "Nebius AI Studio (Token Factory)",
  "category": "llm-gateways",
  "kind": "api",
  "oneLiner": "OpenAI-compatible inference and fine-tuning for open models with base/fast checkpoint variants and transparent per-token pricing.",
  "blurb": "OpenAI-compatible inference and fine-tuning for open models with base/fast checkpoint variants and transparent per-token pricing.",
  "website": "https://nebius.com",
  "docsUrl": "https://docs.nebius.com/studio",
  "signupUrl": "https://nebius.com/services/token-factory",
  "pricingModel": "usage-based",
  "pricingNote": "Transparent per-token from ~$0.06/M input; 'fast' variants cost slightly more for lower latency; $5-$10 trial credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up, get $5-$10 trial credits, generate an API key from Project Settings in the web console",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "OpenAI-compatible"
  ],
  "codeSample": null,
  "tags": [
   "inference",
   "fine-tuning",
   "open-models"
  ],
  "useCases": []
 },
 {
  "slug": "arcade",
  "name": "Arcade",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "MCP runtime that handles OAuth and authorized tool-calling so AI agents can act on behalf of a specific user across 7,500+ agent-optimized tools.",
  "blurb": "MCP runtime that handles OAuth and authorized tool-calling so AI agents can act on behalf of a specific user across 7,500+ agent-optimized tools.",
  "website": "https://www.arcade.dev/",
  "docsUrl": "https://docs.arcade.dev/",
  "signupUrl": "https://api.arcade.dev/dashboard/register",
  "pricingModel": "freemium",
  "pricingNote": "Free to start; usage-based pricing for agent scale",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free dashboard signup issues an API key instantly; per-tool user authorization runs through OAuth (client.tools.authorize returns an auth URL for the human the agent acts for).",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from arcadepy import Arcade\n\nclient = Arcade(api_key=\"ARCADE_API_KEY\")\nuser_id = \"user@example.com\"\n\nauth = client.tools.authorize(tool_name=\"GoogleNews.SearchNewsStories\", user_id=user_id)\nif auth.status != \"completed\":\n    print(f\"Authorize here: {auth.url}\")\n    client.auth.wait_for_completion(auth.id)\n\nresult = client.tools.execute(\n    tool_name=\"GoogleNews.SearchNewsStories\",\n    input={\"keywords\": \"MCP\"},\n    user_id=user_id,\n)"
  },
  "tags": [
   "tool-calling",
   "oauth",
   "mcp",
   "authorized-actions",
   "runtime"
  ],
  "useCases": []
 },
 {
  "slug": "composio",
  "name": "Composio",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Managed auth plus 1,000+ pre-authenticated toolkits that give AI agents per-user, scoped access to SaaS apps with automatic OAuth/token refresh.",
  "blurb": "Managed auth plus 1,000+ pre-authenticated toolkits that give AI agents per-user, scoped access to SaaS apps with automatic OAuth/token refresh.",
  "website": "https://composio.dev/",
  "docsUrl": "https://docs.composio.dev/",
  "signupUrl": "https://app.composio.dev/",
  "pricingModel": "freemium",
  "pricingNote": "Free 20K tool calls/mo; $29 (200K) and $229 (2M) plans, per-1K overage; enterprise custom",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; API key retrieved from the dashboard settings. End-user OAuth to each toolkit is handled on the fly and scoped per user_id.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from composio import Composio\n\ncomposio = Composio(api_key=\"COMPOSIO_API_KEY\")\n\n# Pre-authenticated tools scoped to one end user\ntools = composio.tools.get(user_id=\"user_123\", toolkits=[\"GITHUB\"])\n\n# Pass `tools` to your LLM/agent framework, then execute a call:\nresult = composio.tools.execute(\n    \"GITHUB_STAR_A_REPOSITORY\",\n    user_id=\"user_123\",\n    arguments={\"owner\": \"composiohq\", \"repo\": \"composio\"},\n)"
  },
  "tags": [
   "tool-calling",
   "oauth",
   "mcp",
   "toolkits",
   "per-user-auth"
  ],
  "useCases": []
 },
 {
  "slug": "toolhouse",
  "name": "Toolhouse",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Cloud tool infrastructure and Agent Studio that equip any LLM with hosted, low-latency tools (code exec, web, RAG, MCP) by wrapping your completion in a few lines.",
  "blurb": "Cloud tool infrastructure and Agent Studio that equip any LLM with hosted, low-latency tools (code exec, web, RAG, MCP) by wrapping your completion in a few lines.",
  "website": "https://toolhouse.ai/",
  "docsUrl": "https://docs.toolhouse.ai/",
  "signupUrl": "https://app.toolhouse.ai/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier to start; usage-based paid plans for production",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup issues an API key from the dashboard; SDK works provider-agnostically (OpenAI, Anthropic, Vercel AI, LlamaIndex).",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from toolhouse import Toolhouse\nfrom openai import OpenAI\n\nclient = OpenAI()\nth = Toolhouse(api_key=\"TOOLHOUSE_API_KEY\", provider=\"openai\")\n\nmessages = [{\"role\": \"user\", \"content\": \"Search the web and summarize the top AI news.\"}]\nresponse = client.chat.completions.create(\n    model=\"gpt-4o\", messages=messages, tools=th.get_tools()\n)\nmessages += th.run_tools(response)"
  },
  "tags": [
   "tool-calling",
   "mcp",
   "code-execution",
   "rag",
   "agent-studio"
  ],
  "useCases": []
 },
 {
  "slug": "anon",
  "name": "Anon",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "User-permissioned auth layer that lets agents securely log into and act inside third-party apps that lack APIs (SSO, OAuth, 2FA) without ever storing user credentials.",
  "blurb": "User-permissioned auth layer that lets agents securely log into and act inside third-party apps that lack APIs (SSO, OAuth, 2FA) without ever storing user credentials.",
  "website": "https://www.anon.com/",
  "docsUrl": "https://docs.anon.com/",
  "signupUrl": "",
  "pricingModel": "paid",
  "pricingNote": "Enterprise, sales-led; no public pricing (SOC2-audited, credentials never stored)",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Enterprise deployment model; access requires contacting Anon and human onboarding rather than a self-serve key.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "auth",
   "act-on-behalf",
   "no-api-apps",
   "enterprise",
   "sandboxed"
  ],
  "useCases": []
 },
 {
  "slug": "pipedream-connect",
  "name": "Pipedream Connect",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Embedded integration API and managed auth that lets your app or agent connect accounts and run actions across 3,000+ apps on behalf of end users.",
  "blurb": "Embedded integration API and managed auth that lets your app or agent connect accounts and run actions across 3,000+ apps on behalf of end users.",
  "website": "https://pipedream.com/connect",
  "docsUrl": "https://pipedream.com/docs/connect/",
  "signupUrl": "https://pipedream.com/auth/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free in development; usage-based in production (credits per action + billed per connected end user)",
  "authType": "oauth",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup; project OAuth client credentials + a REST API and JS SDK issue per-end-user connect tokens. Note: Pipedream acquired by Workday (closed Jan 2026).",
  "mcpServer": "",
  "sdks": [
   "Node.js",
   "TypeScript",
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "# Create a Connect token for one of your end users\ncurl -X POST https://api.pipedream.com/v1/connect/{project_id}/tokens \\\n  -H \"Authorization: Bearer {access_token}\" \\\n  -H \"X-PD-Environment: development\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"external_user_id\": \"your-end-user-id\"}'"
  },
  "tags": [
   "embedded-integrations",
   "oauth",
   "managed-auth",
   "actions",
   "3000-apps"
  ],
  "useCases": []
 },
 {
  "slug": "klavis",
  "name": "Klavis AI",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Hosted, production MCP servers with built-in OAuth and multi-tenant auth across 600+ tools, plus the open-source Strata server for self-hosting.",
  "blurb": "Hosted, production MCP servers with built-in OAuth and multi-tenant auth across 600+ tools, plus the open-source Strata server for self-hosting.",
  "website": "https://www.klavis.ai/",
  "docsUrl": "https://www.klavis.ai/docs",
  "signupUrl": "https://www.klavis.ai/",
  "pricingModel": "freemium",
  "pricingNote": "Free Hobby plan; Pro/Team/Enterprise for production. Strata server is open source (pipx install strata-mcp)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup issues an API key; the REST API and Python/TypeScript SDKs can programmatically provision per-user MCP server instances with OAuth wired in. YC X25.",
  "mcpServer": "https://github.com/Klavis-AI/klavis",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP",
   "Docker"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from klavis import Klavis\nfrom klavis.types import McpServerName\n\nklavis = Klavis(api_key=\"KLAVIS_API_KEY\")\n\n# Spin up a hosted MCP server with built-in OAuth for a specific user\nserver = klavis.mcp_server.create_strata_server(\n    user_id=\"user_123\",\n    servers=[McpServerName.GMAIL, McpServerName.GITHUB],\n)\nprint(server.strata_server_url)"
  },
  "tags": [
   "mcp",
   "hosted-mcp",
   "oauth",
   "multi-tenant",
   "open-source",
   "yc"
  ],
  "useCases": []
 },
 {
  "slug": "paragon-actionkit",
  "name": "Paragon ActionKit",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Unified integration API exposing 1,000+ prebuilt actions across 130+ connectors (plus an MCP server and triggers) so agents can act in CRMs, ticketing, email and messaging.",
  "blurb": "Unified integration API exposing 1,000+ prebuilt actions across 130+ connectors (plus an MCP server and triggers) so agents can act in CRMs, ticketing, email and messaging.",
  "website": "https://www.useparagon.com/actionkit",
  "docsUrl": "https://docs.useparagon.com/",
  "signupUrl": "https://www.useparagon.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier for experimentation; usage-based paid plans, enterprise sales for production",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free experimentation tier with self-serve keys; managed embedded auth flow handles end-user OAuth. Some connectors/enterprise features are sales-gated.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "JavaScript",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "unified-api",
   "actions",
   "mcp",
   "embedded-auth",
   "connectors"
  ],
  "useCases": []
 },
 {
  "slug": "nango",
  "name": "Nango",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Open-source integration platform providing OAuth, token refresh and credential storage for 800+ APIs, with each integration exposed to agents over MCP.",
  "blurb": "Open-source integration platform providing OAuth, token refresh and credential storage for 800+ APIs, with each integration exposed to agents over MCP.",
  "website": "https://nango.dev/",
  "docsUrl": "https://docs.nango.dev/",
  "signupUrl": "https://app.nango.dev/signup",
  "pricingModel": "open-source",
  "pricingNote": "Elastic License v2, self-host free; usage-based cloud (~$1 per extra active connection/mo, $0.10 per 1K proxy requests), no per-account fees",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-host free, or free Nango Cloud signup with instant keys; handles end-user OAuth flows, token refresh and multi-tenant credential vaulting.",
  "mcpServer": "https://github.com/NangoHQ/nango",
  "sdks": [
   "Node.js",
   "Python",
   "Go",
   "Java",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "open-source",
   "oauth",
   "unified-api",
   "mcp",
   "token-vault",
   "self-host"
  ],
  "useCases": []
 },
 {
  "slug": "descope-agentic-identity",
  "name": "Descope Agentic Identity Hub",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Identity platform for AI agents and MCP: turn any app into an OAuth provider (Inbound Apps), vault and refresh third-party tokens, and give each agent a scoped identity.",
  "blurb": "Identity platform for AI agents and MCP: turn any app into an OAuth provider (Inbound Apps), vault and refresh third-party tokens, and give each agent a scoped identity.",
  "website": "https://www.descope.com/use-cases/ai",
  "docsUrl": "https://docs.descope.com/agentic-identity-hub",
  "signupUrl": "https://www.descope.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Free tier for developers; usage-based paid tiers",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup with instant project keys; adds OAuth 2.1 + tool-level scopes to MCP servers and includes 50+ out-of-the-box tool templates (Gmail, HubSpot, GitHub, Slack...).",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python",
   "Node.js",
   "Go",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "identity",
   "oauth2.1",
   "mcp",
   "credential-vault",
   "inbound-apps",
   "human-in-the-loop"
  ],
  "useCases": []
 },
 {
  "slug": "stytch-connected-apps",
  "name": "Stytch Connected Apps",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Turns your app into an OAuth 2.1/OIDC provider giving agents and MCP servers scoped, revocable, auditable access with a drop-in consent UI and human-in-the-loop approvals.",
  "blurb": "Turns your app into an OAuth 2.1/OIDC provider giving agents and MCP servers scoped, revocable, auditable access with a drop-in consent UI and human-in-the-loop approvals.",
  "website": "https://stytch.com/connected-apps",
  "docsUrl": "https://stytch.com/docs",
  "signupUrl": "https://stytch.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free developer tier; usage-based paid plans",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve dashboard signup issues API keys; the hosted Stytch MCP Server can configure OAuth flows programmatically with no dashboard. Note: Stytch acquired by Twilio (Nov 2025).",
  "mcpServer": "",
  "sdks": [
   "Node.js",
   "Python",
   "Go",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "identity",
   "oauth2.1",
   "mcp",
   "consent-ui",
   "revocable",
   "ciam"
  ],
  "useCases": []
 },
 {
  "slug": "auth0-for-ai-agents",
  "name": "Auth0 for AI Agents",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Auth0's identity stack for GenAI: a Token Vault that stores and refreshes third-party OAuth tokens for agents, async (CIBA) human approvals, and fine-grained authorization for RAG.",
  "blurb": "Auth0's identity stack for GenAI: a Token Vault that stores and refreshes third-party OAuth tokens for agents, async (CIBA) human approvals, and fine-grained authorization for RAG.",
  "website": "https://auth0.com/ai",
  "docsUrl": "https://auth0.com/ai/docs",
  "signupUrl": "https://auth0.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free tier includes 2 Token Vault connected apps, async authorization and core features",
  "authType": "oauth",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup provisions a tenant with client credentials instantly; Token Vault lets agents fetch/refresh third-party tokens without seeing raw secrets.",
  "mcpServer": "",
  "sdks": [
   "Node.js",
   "Python",
   "REST",
   "LangChain",
   "Vercel AI SDK"
  ],
  "codeSample": null,
  "tags": [
   "identity",
   "token-vault",
   "ciba",
   "fga",
   "rag",
   "human-in-the-loop"
  ],
  "useCases": []
 },
 {
  "slug": "pica",
  "name": "Pica (One)",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Agent tooling platform (OneTool) connecting agents to 100+ APIs and 25,000+ actions through a single SDK, with AuthKit for managed auth; community edition is open source.",
  "blurb": "Agent tooling platform (OneTool) connecting agents to 100+ APIs and 25,000+ actions through a single SDK, with AuthKit for managed auth; community edition is open source.",
  "website": "https://www.picaos.com/",
  "docsUrl": "https://docs.picaos.com/",
  "signupUrl": "https://app.picaos.com/",
  "pricingModel": "freemium",
  "pricingNote": "Open-source community edition plus hosted plans; usage-based",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup issues API keys; AuthKit manages end-user auth and the Passthrough API exposes one endpoint over all integrations.",
  "mcpServer": "https://github.com/picahq/pica",
  "sdks": [
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "tool-calling",
   "passthrough-api",
   "authkit",
   "mcp",
   "open-source",
   "onetool"
  ],
  "useCases": []
 },
 {
  "slug": "scalekit",
  "name": "Scalekit",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Modular auth stack for AI apps: puts an OAuth 2.1 authorization server in front of MCP servers, adds delegated agent identity and a token vault, plus enterprise SSO/SCIM.",
  "blurb": "Modular auth stack for AI apps: puts an OAuth 2.1 authorization server in front of MCP servers, adds delegated agent identity and a token vault, plus enterprise SSO/SCIM.",
  "website": "https://www.scalekit.com/",
  "docsUrl": "https://docs.scalekit.com/",
  "signupUrl": "https://www.scalekit.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier; Growth plan $99/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup with instant keys; delegation model means agents act as a specific user with that user's approved scopes (never over-privileged service accounts).",
  "mcpServer": "",
  "sdks": [
   "Node.js",
   "Python",
   "Go",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "identity",
   "oauth2.1",
   "mcp-auth",
   "delegated-identity",
   "token-vault",
   "sso"
  ],
  "useCases": []
 },
 {
  "slug": "workos-authkit",
  "name": "WorkOS AuthKit",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "With one config value AuthKit becomes an MCP-compliant OAuth 2.1 authorization server; adds SSO, SCIM, audit logs and fine-grained tool-level authorization for agents.",
  "blurb": "With one config value AuthKit becomes an MCP-compliant OAuth 2.1 authorization server; adds SSO, SCIM, audit logs and fine-grained tool-level authorization for agents.",
  "website": "https://workos.com/",
  "docsUrl": "https://workos.com/docs/authkit/mcp",
  "signupUrl": "https://dashboard.workos.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "AuthKit free up to 1M monthly active users; enterprise add-ons priced separately",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve dashboard signup issues API keys instantly. Used by OpenAI, Anthropic, Cursor, Perplexity, Vercel and others for production MCP auth.",
  "mcpServer": "",
  "sdks": [
   "Node.js",
   "Python",
   "Ruby",
   "Go",
   "PHP",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "identity",
   "oauth2.1",
   "mcp",
   "sso",
   "scim",
   "fga"
  ],
  "useCases": []
 },
 {
  "slug": "integration-app",
  "name": "Integration.app",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "AI-native integration platform with prebuilt connectors, configurable actions/flows and MCP so agents get authenticated, mapped access to your customers' SaaS apps.",
  "blurb": "AI-native integration platform with prebuilt connectors, configurable actions/flows and MCP so agents get authenticated, mapped access to your customers' SaaS apps.",
  "website": "https://integration.app/",
  "docsUrl": "https://docs.integration.app/",
  "signupUrl": "https://integration.app/",
  "pricingModel": "freemium",
  "pricingNote": "Flexible pricing by connector or by customer; free/trial tier to start",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with keys; handles end-user OAuth, field mapping and app schemas, with JavaScript code blocks to transform any API request/response.",
  "mcpServer": "",
  "sdks": [
   "JavaScript",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "integrations",
   "connectors",
   "field-mapping",
   "mcp",
   "flows",
   "ai-native"
  ],
  "useCases": []
 },
 {
  "slug": "merge-agent-handler",
  "name": "Merge Agent Handler",
  "category": "agent-auth-tools",
  "kind": "api",
  "oneLiner": "Gives agents secure, authenticated access to thousands of prebuilt tools across 220+ integrations via custom MCP servers, with enterprise governance and normalized data.",
  "blurb": "Gives agents secure, authenticated access to thousands of prebuilt tools across 220+ integrations via custom MCP servers, with enterprise governance and normalized data.",
  "website": "https://www.merge.dev/",
  "docsUrl": "https://docs.merge.dev/",
  "signupUrl": "https://www.merge.dev/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (3 linked accounts); Agent Handler free start with 2,000 monthly credits; Launch plan $650/mo",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup issues API keys; Agent Handler (launched Oct 2025) lets you create scoped custom MCP servers over Merge's managed end-user auth.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node.js",
   "Ruby",
   "Go",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "unified-api",
   "mcp",
   "agent-handler",
   "governance",
   "normalized-data",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "stripe",
  "name": "Stripe",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "The default payments, billing and subscriptions API — now with an Agent Toolkit and Agentic Commerce suite so AI agents can accept and make payments.",
  "blurb": "The default payments, billing and subscriptions API — now with an Agent Toolkit and Agentic Commerce suite so AI agents can accept and make payments.",
  "website": "https://stripe.com",
  "docsUrl": "https://docs.stripe.com/agents",
  "signupUrl": "https://dashboard.stripe.com/register",
  "pricingModel": "usage-based",
  "pricingNote": "2.9% + 30¢ per successful card charge; Stripe Billing adds ~0.5-0.8% of billed volume",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Account creation requires human KYC. Once an account exists, restricted (scoped) API keys can be minted for agents, and the Stripe Agent Toolkit (LangChain/CrewAI/OpenAI Agents SDK/Vercel AI SDK) exposes Stripe as tool calls.",
  "mcpServer": "https://mcp.stripe.com",
  "sdks": [
   "Python",
   "TypeScript",
   "Ruby",
   "PHP",
   "Java",
   "Go",
   ".NET",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import Stripe from \"stripe\";\nconst stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);\n\n// Charge for an agent's metered usage\nconst intent = await stripe.paymentIntents.create({\n  amount: 500, // $5.00 in cents\n  currency: \"usd\",\n  confirm: true,\n  payment_method: \"pm_card_visa\",\n});\nconsole.log(intent.status);"
  },
  "tags": [
   "payments",
   "subscriptions",
   "agent-toolkit",
   "agentic-commerce",
   "cards",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "polar",
  "name": "Polar",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open-source Merchant of Record — payments, subscriptions and usage-based billing with global tax handled for you, built for the AI era.",
  "blurb": "Open-source Merchant of Record — payments, subscriptions and usage-based billing with global tax handled for you, built for the AI era.",
  "website": "https://polar.sh",
  "docsUrl": "https://docs.polar.sh",
  "signupUrl": "https://polar.sh/signup",
  "pricingModel": "usage-based",
  "pricingNote": "MoR fee 5% + 50¢ per transaction (orgs before May 2026 grandfathered at 4% + 40¢); no monthly fee on the free Starter plan",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve signup; create Organization Access Tokens instantly and a full sandbox environment (sandbox.polar.sh) with its own tokens for automated/agent testing.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "PHP",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Polar } from \"@polar-sh/sdk\";\nconst polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });\n\nconst checkout = await polar.checkouts.create({\n  products: [\"<product_id>\"],\n  successUrl: \"https://example.com/success\",\n});\nconsole.log(checkout.url);"
  },
  "tags": [
   "merchant-of-record",
   "open-source",
   "subscriptions",
   "usage-billing",
   "tax",
   "indie"
  ],
  "useCases": []
 },
 {
  "slug": "autumn",
  "name": "Autumn",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open-source pricing & billing layer over Stripe — one API for entitlements, credits and usage enforcement, built for AI startups.",
  "blurb": "Open-source pricing & billing layer over Stripe — one API for entitlements, credits and usage enforcement, built for AI startups.",
  "website": "https://useautumn.com",
  "docsUrl": "https://docs.useautumn.com",
  "signupUrl": "https://app.useautumn.com",
  "pricingModel": "freemium",
  "pricingNote": "Free until $8K/mo revenue; open-source (self-hostable) or managed",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup gives an instant API key; also fully open-source so an agent can self-host and mint its own credentials.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "React",
   "Node",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { useAutumn } from \"autumn-js/react\";\nconst { attach, check, track } = useAutumn();\n\n// Gate a feature by entitlement/usage\nconst { data } = await check({ featureId: \"ai_tokens\" });\nif (data.allowed) {\n  // ...run the work, then record usage\n  await track({ featureId: \"ai_tokens\", value: 1312 });\n}\n// Start a purchase / upgrade\nawait attach({ productId: \"pro\" });"
  },
  "tags": [
   "billing",
   "entitlements",
   "credits",
   "usage-based",
   "stripe-layer",
   "open-source",
   "ai-startups"
  ],
  "useCases": []
 },
 {
  "slug": "orb",
  "name": "Orb",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Usage-based billing and revenue platform for high-volume AI/software — event metering, price modeling and automated invoicing.",
  "blurb": "Usage-based billing and revenue platform for high-volume AI/software — event metering, price modeling and automated invoicing.",
  "website": "https://www.withorb.com",
  "docsUrl": "https://docs.withorb.com",
  "signupUrl": "",
  "pricingModel": "paid",
  "pricingNote": "Sales-led, no public pricing (historically ~$720/mo platform fee); stress-tested to 250k+ events/sec",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Enterprise/sales-led onboarding; API keys issued after a sales conversation. Launched Agentic Payment Methods in 2026.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "Java",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "usage-based",
   "metering",
   "invoicing",
   "revenue",
   "ai-billing",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "schematic",
  "name": "Schematic",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Entitlements, feature gating and usage-based packaging on top of Stripe — ship pricing and plan changes without shipping code.",
  "blurb": "Entitlements, feature gating and usage-based packaging on top of Stripe — ship pricing and plan changes without shipping code.",
  "website": "https://schematichq.com",
  "docsUrl": "https://docs.schematichq.com",
  "signupUrl": "https://app.schematichq.com",
  "pricingModel": "freemium",
  "pricingNote": "Free tier; built on Stripe. Raised $6.5M in April 2026 (entitlements-as-a-primitive Stripe App)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with API keys; enforces entitlements/limits (incl. per-agent) at runtime.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "React",
   "Node",
   "Python",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "entitlements",
   "feature-flags",
   "packaging",
   "usage-based",
   "stripe-layer",
   "monetization"
  ],
  "useCases": []
 },
 {
  "slug": "lago",
  "name": "Lago",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open-source metering and usage-based billing API — consumption tracking, subscriptions, payment orchestration and revenue analytics, self-host or cloud.",
  "blurb": "Open-source metering and usage-based billing API — consumption tracking, subscriptions, payment orchestration and revenue analytics, self-host or cloud.",
  "website": "https://getlago.com",
  "docsUrl": "https://getlago.com/docs",
  "signupUrl": "",
  "pricingModel": "open-source",
  "pricingNote": "Self-host free (AGPLv3), no usage/revenue caps; Cloud free up to first $250K cumulative invoiced revenue. Ingests ~15k events/sec",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-host via Docker/Kubernetes and generate your own API key with no human gatekeeper; Cloud offers a free self-serve tier.",
  "mcpServer": "",
  "sdks": [
   "Ruby",
   "Python",
   "JavaScript",
   "Go",
   "PHP",
   "Java",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "open-source",
   "metering",
   "usage-based",
   "self-hosted",
   "subscriptions",
   "revenue-analytics"
  ],
  "useCases": []
 },
 {
  "slug": "paid",
  "name": "Paid",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Results/outcome-based billing for AI agents — attach value to what an agent does, track cost & margin, and invoice on outcomes.",
  "blurb": "Results/outcome-based billing for AI agents — attach value to what an agent does, track cost & margin, and invoice on outcomes.",
  "website": "https://paid.ai",
  "docsUrl": "",
  "signupUrl": "",
  "pricingModel": "unknown",
  "pricingNote": "Early-stage (raised $21.6M seed led by Lightspeed, 2025; ~$100M+ valuation). Founded by Outreach's Manny Medina",
  "authType": "account",
  "agentSignup": "unknown",
  "agentSignupNote": "Contact/sign up via the site; built for agent makers to price agents (fixed or variable) with margin visibility and ROI tracking.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript"
  ],
  "codeSample": null,
  "tags": [
   "agent-billing",
   "outcome-based",
   "results-based",
   "margin",
   "ai-agents",
   "monetization"
  ],
  "useCases": []
 },
 {
  "slug": "skyfire",
  "name": "Skyfire",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Identity + payments rails for autonomous agents — Know-Your-Agent (KYA) identity, self-funded wallets and USDC micropayments via the open KYAPay protocol.",
  "blurb": "Identity + payments rails for autonomous agents — Know-Your-Agent (KYA) identity, self-funded wallets and USDC micropayments via the open KYAPay protocol.",
  "website": "https://skyfire.xyz",
  "docsUrl": "https://docs.skyfire.xyz",
  "signupUrl": "",
  "pricingModel": "usage-based",
  "pricingNote": "USDC micropayments with instant settlement; agents pre-fund a Skyfire wallet and stream per-request payments (e.g. $0.05/API call)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Purpose-built for agents: register an agent to get a KYA credential (signed JWT binding platform+agent+human) and a self-funded wallet; the wallet is funded once by a human/enterprise via card/ACH/USDC, then the agent transacts programmatically. Demonstrated with Visa Intelligent Commerce.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "agent-payments",
   "agent-identity",
   "kya",
   "stablecoin",
   "usdc",
   "micropayments",
   "agent-commerce"
  ],
  "useCases": []
 },
 {
  "slug": "metronome",
  "name": "Metronome",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Usage-based billing and enterprise contract management for high-volume AI/software companies (now a Stripe company).",
  "blurb": "Usage-based billing and enterprise contract management for high-volume AI/software companies (now a Stripe company).",
  "website": "https://metronome.com",
  "docsUrl": "https://docs.metronome.com",
  "signupUrl": "",
  "pricingModel": "paid",
  "pricingNote": "Enterprise, sales-led (no public self-serve pricing). Acquired by Stripe, completed Jan 14, 2026",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Enterprise onboarding; API access provisioned after a sales conversation. Meters tokens, API calls, compute hours and outcomes at scale.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "usage-based",
   "metering",
   "enterprise-contracts",
   "ai-billing",
   "stripe",
   "high-volume"
  ],
  "useCases": []
 },
 {
  "slug": "stigg",
  "name": "Stigg",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Pricing, packaging and entitlements runtime — the 'usage runtime' that decides what every customer, user and agent is allowed to do, with per-agent budget caps.",
  "blurb": "Pricing, packaging and entitlements runtime — the 'usage runtime' that decides what every customer, user and agent is allowed to do, with per-agent budget caps.",
  "website": "https://www.stigg.io",
  "docsUrl": "https://docs.stigg.io",
  "signupUrl": "https://app.stigg.io",
  "pricingModel": "freemium",
  "pricingNote": "Free 'Build' plan (no credit card); Pro $399/mo includes 10k entities + 25M events, then graduated per-tier rates",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free self-serve Build plan gives instant API access; layers over your existing billing provider (no migration) and enforces per-user/team/agent budget caps at call time.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "React",
   "Node",
   "Python",
   "Go",
   "Ruby",
   "REST",
   "GraphQL"
  ],
  "codeSample": null,
  "tags": [
   "entitlements",
   "packaging",
   "pricing",
   "usage-runtime",
   "budget-caps",
   "monetization",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "x402",
  "name": "Coinbase x402",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open HTTP-native payment protocol that revives the '402 Payment Required' status code — agents and apps pay per API call in stablecoins with no account or login.",
  "blurb": "Open HTTP-native payment protocol that revives the '402 Payment Required' status code — agents and apps pay per API call in stablecoins with no account or login.",
  "website": "https://x402.org",
  "docsUrl": "https://docs.cdp.coinbase.com/x402/welcome",
  "signupUrl": "",
  "pricingModel": "open-source",
  "pricingNote": "Zero protocol fee; pay-per-call in USDC on Base/Solana/etc. Coinbase's hosted CDP facilitator has a free tier of 1,000 tx/mo. ~$600M annualized volume by early 2026",
  "authType": "none",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "The most agent-native option: NO account, session, or human needed — an agent pays with a crypto wallet signature over HTTP headers. An optional CDP API key is only needed for Coinbase's hosted facilitator.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "Go"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "// SELLER: require payment on a route (Express)\nimport { paymentMiddleware } from \"x402-express\";\napp.use(paymentMiddleware(payTo, {\n  \"GET /weather\": { price: \"$0.001\", network: \"base\" },\n}));\n\n// BUYER (agent): pay automatically from a wallet — no account\nimport { wrapFetchWithPayment } from \"x402-fetch\";\nconst fetchWithPay = wrapFetchWithPayment(fetch, account);\nconst res = await fetchWithPay(\"https://api.example.com/weather\");"
  },
  "tags": [
   "agent-payments",
   "protocol",
   "http-402",
   "stablecoin",
   "usdc",
   "pay-per-call",
   "micropayments",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "paypal-agent-toolkit",
  "name": "PayPal Agent Toolkit",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open-source toolkit plus a remote MCP server that exposes PayPal payments, invoices, subscriptions, orders and disputes to AI agents.",
  "blurb": "Open-source toolkit plus a remote MCP server that exposes PayPal payments, invoices, subscriptions, orders and disputes to AI agents.",
  "website": "https://www.paypal.ai",
  "docsUrl": "https://www.paypal.ai/docs/tools/agent-toolkit-quickstart",
  "signupUrl": "https://developer.paypal.com/dashboard/applications",
  "pricingModel": "open-source",
  "pricingNote": "Toolkit is free/OSS; standard PayPal transaction fees apply on real payments",
  "authType": "oauth",
  "agentSignup": "oauth",
  "agentSignupNote": "Create a developer app self-serve to get client ID + secret (OAuth2 client-credentials); sandbox is instant. Works with MCP, LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK and Amazon Bedrock.",
  "mcpServer": "https://mcp.paypal.com/http",
  "sdks": [
   "TypeScript",
   "MCP",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "agent-toolkit",
   "payments",
   "invoices",
   "subscriptions",
   "mcp",
   "agentic-commerce"
  ],
  "useCases": []
 },
 {
  "slug": "killbill",
  "name": "Kill Bill",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Mature open-source subscription billing and payments platform (Java) — self-host with a decade-deep plugin ecosystem for complex billing.",
  "blurb": "Mature open-source subscription billing and payments platform (Java) — self-host with a decade-deep plugin ecosystem for complex billing.",
  "website": "https://killbill.io",
  "docsUrl": "https://docs.killbill.io",
  "signupUrl": "",
  "pricingModel": "open-source",
  "pricingNote": "Free, Apache-2.0; self-hosted (Java + MariaDB). Best for complex/enterprise billing with custom accounting workflows",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-host and create your own tenant + API credentials (X-Killbill-ApiKey/ApiSecret) with no external gatekeeper.",
  "mcpServer": "",
  "sdks": [
   "Java",
   "Ruby",
   "Python",
   "PHP",
   "Node",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "open-source",
   "subscriptions",
   "self-hosted",
   "payments",
   "plugins",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "dodo-payments",
  "name": "Dodo Payments",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Merchant-of-Record payments and billing for AI-first companies — sell in 220+ countries with tax, compliance and disputes handled behind one API.",
  "blurb": "Merchant-of-Record payments and billing for AI-first companies — sell in 220+ countries with tax, compliance and disputes handled behind one API.",
  "website": "https://dodopayments.com",
  "docsUrl": "https://docs.dodopayments.com",
  "signupUrl": "https://app.dodopayments.com",
  "pricingModel": "usage-based",
  "pricingNote": "4% + 40¢ per transaction (payments + tax + billing included); ~6-7% effective on non-US subscription cards. 0% setup fee, startup credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with instant test-mode API keys and SDKs/webhooks; live payouts require MoR/KYC verification.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "TypeScript",
   "Python",
   "PHP",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "merchant-of-record",
   "global-payments",
   "tax",
   "billing",
   "ai-first",
   "subscriptions"
  ],
  "useCases": []
 },
 {
  "slug": "payman",
  "name": "Payman",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Agent-native wallet and payouts — let AI agents send and hold money under programmable, human-in-the-loop spend policies.",
  "blurb": "Agent-native wallet and payouts — let AI agents send and hold money under programmable, human-in-the-loop spend policies.",
  "website": "https://paymanai.com",
  "docsUrl": "https://docs.paymanai.com",
  "signupUrl": "https://app.paymanai.com",
  "pricingModel": "freemium",
  "pricingNote": "Test wallets free; USD/USDC payouts via Fifth Third Bank custody + Stripe. SOC 2 / PCI compliant",
  "authType": "oauth",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve: create an app to get OAuth client credentials and an isolated test wallet instantly. Policy engine enforces per-transaction/daily caps, recipient whitelists and human-approval thresholds before any payment executes.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "agent-wallet",
   "payouts",
   "human-in-the-loop",
   "spend-controls",
   "usdc",
   "agent-payments"
  ],
  "useCases": []
 },
 {
  "slug": "crossmint",
  "name": "Crossmint",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Agent payments infrastructure — give each AI agent a wallet, virtual card and cross-chain stablecoin rails under human-controlled delegation.",
  "blurb": "Agent payments infrastructure — give each AI agent a wallet, virtual card and cross-chain stablecoin rails under human-controlled delegation.",
  "website": "https://www.crossmint.com",
  "docsUrl": "https://docs.crossmint.com",
  "signupUrl": "https://www.crossmint.com/console",
  "pricingModel": "freemium",
  "pricingNote": "Free staging/API keys from the console; usage-based in production. Launched agentic Cards API (Visa Intelligent Commerce + Basis Theory) June 2026",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign in to the Crossmint console to get instant staging API keys; provision agent wallets, virtual cards and stablecoin payments (x402-supported) programmatically.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Node",
   "React",
   "Python",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "agent-wallet",
   "virtual-cards",
   "stablecoin",
   "x402",
   "agentic-commerce",
   "delegation"
  ],
  "useCases": []
 },
 {
  "slug": "chargebee",
  "name": "Chargebee",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Subscription billing and monetization for B2B SaaS and AI companies — mix usage, credits, outcome-based and seat pricing on one billing record.",
  "blurb": "Subscription billing and monetization for B2B SaaS and AI companies — mix usage, credits, outcome-based and seat pricing on one billing record.",
  "website": "https://www.chargebee.com",
  "docsUrl": "https://apidocs.chargebee.com",
  "signupUrl": "",
  "pricingModel": "freemium",
  "pricingNote": "Free/trial tier for early revenue, then paid; enterprise plans sales-led. Ingests up to 200k usage events/sec; serves 6,500+ SaaS/AI companies",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve trial creates a test site with instant API keys; also ships an MCP server and agent framework for billing-aware agents.",
  "mcpServer": "",
  "sdks": [
   "Node",
   "Python",
   "Ruby",
   "PHP",
   "Java",
   "Go",
   ".NET",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "subscriptions",
   "usage-based",
   "monetization",
   "saas-billing",
   "outcome-based",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "ap2",
  "name": "Google AP2 (Agent Payments Protocol)",
  "category": "payments-billing",
  "kind": "api",
  "oneLiner": "Open protocol for agent-led payments — cryptographically-signed 'mandates' let agents transact on a user's behalf across cards, bank transfers and stablecoins (via the x402 extension).",
  "blurb": "Open protocol for agent-led payments — cryptographically-signed 'mandates' let agents transact on a user's behalf across cards, bank transfers and stablecoins (via the x402 extension).",
  "website": "https://ap2-protocol.org",
  "docsUrl": "https://github.com/google-agentic-commerce/AP2",
  "signupUrl": "",
  "pricingModel": "open-source",
  "pricingNote": "Open, payment-agnostic spec (announced Sept 2025 with 60+ partners incl. Mastercard, PayPal, Coinbase, Amex). Reference SDK + samples on GitHub",
  "authType": "none",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "No signup — it's an open specification. Agents implement AP2's Intent/Cart/Payment mandate objects directly (Python/Android reference SDK); the x402 extension adds stablecoin settlement with no human.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST",
   "JSON-Schema"
  ],
  "codeSample": null,
  "tags": [
   "agent-payments",
   "protocol",
   "mandates",
   "open-standard",
   "x402",
   "agentic-commerce",
   "interoperable"
  ],
  "useCases": []
 },
 {
  "slug": "neon",
  "name": "Neon",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Serverless Postgres with pgvector plus a Claimable-Postgres API that spins up a live database with zero human involvement — purpose-built as a backend for apps and AI agents.",
  "blurb": "Serverless Postgres with pgvector plus a Claimable-Postgres API that spins up a live database with zero human involvement — purpose-built as a backend for apps and AI agents.",
  "website": "https://neon.com",
  "docsUrl": "https://neon.com/docs/extensions/pgvector",
  "signupUrl": "https://console.neon.tech/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free plan includes pgvector on all plans; Launchpad claimable DBs are free (100MB, expire in 72h until claimed)",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "BEST for agents: neon.new / Launchpad 'Claimable Postgres' provisions a Postgres+pgvector DB via a single HTTP call with NO account and NO credit card (100MB, 72h TTL), claimable later. Full Management API + official MCP server + published agent skill for autonomous provisioning.",
  "mcpServer": "https://github.com/neondatabase/mcp-server-neon",
  "sdks": [
   "JavaScript/TypeScript",
   "Python",
   "REST",
   "SQL"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { neon } from \"@neondatabase/serverless\";\n\nconst sql = neon(process.env.DATABASE_URL);\n// pgvector nearest-neighbour search\nconst rows = await sql`\n  SELECT id, content\n  FROM items\n  ORDER BY embedding <-> ${\"[0.1,0.2,0.3]\"}::vector\n  LIMIT 5;\n`;"
  },
  "tags": [
   "vector-db",
   "postgres",
   "pgvector",
   "serverless",
   "rag",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "pinecone",
  "name": "Pinecone",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "The managed serverless vector database most RAG teams reach for — autoscales to zero, with a control-plane Admin API for programmatic project and key provisioning.",
  "blurb": "The managed serverless vector database most RAG teams reach for — autoscales to zero, with a control-plane Admin API for programmatic project and key provisioning.",
  "website": "https://www.pinecone.io",
  "docsUrl": "https://docs.pinecone.io",
  "signupUrl": "https://app.pinecone.io",
  "pricingModel": "freemium",
  "pricingNote": "Free Starter (2GB storage, ~2M writes / 1M reads per mo, AWS us-east-1); Builder $20/mo flat; Standard from $50/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Free Starter signup returns an instant API key (no CC). Admin API: create a service account in console (client_id/secret), exchange for a token, then create projects and scoped API keys programmatically (roles like ProjectEditor). Official developer MCP server.",
  "mcpServer": "@pinecone-database/mcp",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pinecone import Pinecone\n\npc = Pinecone(api_key=\"YOUR_API_KEY\")\nindex = pc.Index(\"my-index\")\nindex.upsert(vectors=[{\"id\": \"a1\", \"values\": [0.1, 0.2, 0.3]}])\nres = index.query(vector=[0.1, 0.2, 0.3], top_k=3, include_metadata=True)"
  },
  "tags": [
   "vector-db",
   "serverless",
   "rag",
   "agents",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "upstash",
  "name": "Upstash (Vector + Redis)",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Serverless, HTTP-first Vector and Redis with pay-per-request pricing and a full Developer API + MCP server for provisioning databases from code or agents.",
  "blurb": "Serverless, HTTP-first Vector and Redis with pay-per-request pricing and a full Developer API + MCP server for provisioning databases from code or agents.",
  "website": "https://upstash.com",
  "docsUrl": "https://upstash.com/docs/vector",
  "signupUrl": "https://console.upstash.com",
  "pricingModel": "freemium",
  "pricingNote": "Permanent free tiers (Redis 256MB/500K cmds; Vector free tier); Vector pay-as-you-go $0.40/100K req + $0.25/GB storage; fixed Vector plans from $60/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Free signup yields an instant REST URL + token. Developer API v2 (Account > Management API) provisions Redis/Vector/QStash databases and keys programmatically; official Upstash MCP server + Pulumi/Terraform provider for full IaC.",
  "mcpServer": "@upstash/mcp-server",
  "sdks": [
   "TypeScript",
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Index } from \"@upstash/vector\";\n\nconst index = new Index({\n  url: process.env.UPSTASH_VECTOR_REST_URL,\n  token: process.env.UPSTASH_VECTOR_REST_TOKEN,\n});\n\nawait index.upsert({ id: \"a1\", vector: [0.1, 0.2, 0.3] });\nconst res = await index.query({ vector: [0.1, 0.2, 0.3], topK: 3 });"
  },
  "tags": [
   "vector-db",
   "redis",
   "serverless",
   "edge",
   "rag",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "supabase",
  "name": "Supabase Vector",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Open-source Postgres backend where pgvector is included free on every plan, with a Management API and OAuth2 for programmatically creating and managing projects.",
  "blurb": "Open-source Postgres backend where pgvector is included free on every plan, with a Management API and OAuth2 for programmatically creating and managing projects.",
  "website": "https://supabase.com",
  "docsUrl": "https://supabase.com/docs/guides/ai",
  "signupUrl": "https://supabase.com/dashboard/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "pgvector included at no extra cost on all plans; Free plan available, Pro from $25/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Management API with Personal Access Tokens automates project + key management; OAuth2 lets a third-party app create/manage Supabase projects on behalf of a user without their credentials. Official Supabase MCP server.",
  "mcpServer": "@supabase/mcp-server-supabase",
  "sdks": [
   "Python",
   "JavaScript/TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import vecs\n\ndb = vecs.create_client(\"postgresql://user:pass@host:5432/postgres\")\ndocs = db.get_or_create_collection(name=\"docs\", dimension=3)\ndocs.upsert(records=[(\"a1\", [0.1, 0.2, 0.3], {\"title\": \"hello\"})])\ndocs.create_index()\nresults = docs.query(data=[0.1, 0.2, 0.3], limit=3)"
  },
  "tags": [
   "vector-db",
   "postgres",
   "pgvector",
   "backend",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "mongodb-atlas-vector-search",
  "name": "MongoDB Atlas Vector Search",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Vector search built into MongoDB Atlas so embeddings live next to your operational documents — free on the M0 tier, provisionable via the Atlas Admin API.",
  "blurb": "Vector search built into MongoDB Atlas so embeddings live next to your operational documents — free on the M0 tier, provisionable via the Atlas Admin API.",
  "website": "https://www.mongodb.com/products/platform/atlas-vector-search",
  "docsUrl": "https://www.mongodb.com/docs/atlas/atlas-vector-search/",
  "signupUrl": "https://www.mongodb.com/cloud/atlas/register",
  "pricingModel": "freemium",
  "pricingNote": "Vector Search included at no extra software cost; M0 free (512MB), Flex $8-30/mo, Dedicated from ~$57/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Atlas Admin API (digest-auth key pairs, org/project scoped) provisions clusters, users and indexes for CI/CD, Terraform and agents. Caveat: the FIRST API key must be created by a human in the Atlas UI to bootstrap. Official MongoDB MCP server.",
  "mcpServer": "https://github.com/mongodb-js/mongodb-mcp-server",
  "sdks": [
   "Python",
   "Node.js",
   "Java",
   "Go",
   "C#",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pymongo import MongoClient\n\nclient = MongoClient(\"mongodb+srv://user:pass@cluster.mongodb.net\")\ncol = client.mydb.docs\npipeline = [{\n    \"$vectorSearch\": {\n        \"index\": \"vector_index\",\n        \"path\": \"embedding\",\n        \"queryVector\": [0.1, 0.2, 0.3],\n        \"numCandidates\": 100,\n        \"limit\": 3,\n    }\n}]\nresults = list(col.aggregate(pipeline))"
  },
  "tags": [
   "vector-db",
   "document-db",
   "managed",
   "rag",
   "hybrid-search"
  ],
  "useCases": []
 },
 {
  "slug": "qdrant-cloud",
  "name": "Qdrant Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Managed cloud for the popular open-source Qdrant vector engine, with a genuinely free-forever 1GB cluster (no credit card) and a cloud management API.",
  "blurb": "Managed cloud for the popular open-source Qdrant vector engine, with a genuinely free-forever 1GB cluster (no credit card) and a cloud management API.",
  "website": "https://qdrant.tech",
  "docsUrl": "https://qdrant.tech/documentation/",
  "signupUrl": "https://cloud.qdrant.io",
  "pricingModel": "freemium",
  "pricingNote": "Free-forever cluster (0.5 vCPU, 1GB RAM, 4GB disk, no CC); Standard ~$0.078/GB-hr (~$57/mo per GB RAM)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up with no credit card, create a free cluster and receive an API key instantly; a Cloud Management API and official MCP server allow programmatic cluster/key control. Caveat: idle free clusters suspend after 1 week, delete after 4 weeks.",
  "mcpServer": "https://github.com/qdrant/mcp-server-qdrant",
  "sdks": [
   "Python",
   "TypeScript",
   "Rust",
   "Go",
   "REST/gRPC"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from qdrant_client import QdrantClient\nfrom qdrant_client.models import PointStruct\n\nclient = QdrantClient(url=\"https://YOUR-CLUSTER.qdrant.io\", api_key=\"YOUR_API_KEY\")\nclient.upsert(\n    collection_name=\"docs\",\n    points=[PointStruct(id=1, vector=[0.1, 0.2, 0.3], payload={\"title\": \"hello\"})],\n)\nhits = client.query_points(collection_name=\"docs\", query=[0.1, 0.2, 0.3], limit=3)"
  },
  "tags": [
   "vector-db",
   "open-source",
   "managed",
   "rag",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "weaviate-cloud",
  "name": "Weaviate Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Managed cloud for the open-source Weaviate vector database, with built-in hybrid search and vectorizer modules and a free 14-day sandbox to start instantly.",
  "blurb": "Managed cloud for the open-source Weaviate vector database, with built-in hybrid search and vectorizer modules and a free 14-day sandbox to start instantly.",
  "website": "https://weaviate.io",
  "docsUrl": "https://weaviate.io/developers/wcs",
  "signupUrl": "https://console.weaviate.cloud",
  "pricingModel": "freemium",
  "pricingNote": "Free Sandbox (50K objects, auto-expires after 14 days); Flex from $45/mo, billed on vector dimensions + storage",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Create a free Sandbox in the console and get a cluster URL + API key immediately (no CC). Caveat: the free Sandbox auto-expires after 14 days and cannot be extended — data is lost, so it's for prototyping, not persistence.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "Java"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import weaviate\nfrom weaviate.classes.init import Auth\n\nclient = weaviate.connect_to_weaviate_cloud(\n    cluster_url=\"https://YOUR-CLUSTER.weaviate.cloud\",\n    auth_credentials=Auth.api_key(\"YOUR_API_KEY\"),\n)\ndocs = client.collections.get(\"Docs\")\nres = docs.query.near_vector(near_vector=[0.1, 0.2, 0.3], limit=3)\nclient.close()"
  },
  "tags": [
   "vector-db",
   "open-source",
   "hybrid-search",
   "rag",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "zilliz-cloud",
  "name": "Zilliz Cloud (Milvus)",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "The fully-managed cloud from the makers of Milvus — serverless vector search that scales to billions of vectors, with a free tier and startup credits.",
  "blurb": "The fully-managed cloud from the makers of Milvus — serverless vector search that scales to billions of vectors, with a free tier and startup credits.",
  "website": "https://zilliz.com",
  "docsUrl": "https://docs.zilliz.com",
  "signupUrl": "https://cloud.zilliz.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free tier: 5GB storage + compute credits; Serverless ~$0.096/CU-hr compute + ~$0.04/GB/mo storage; $100 signup credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup provisions a serverless cluster and API token (public endpoint) instantly, no CC, plus $100 credits. Cloud control-plane API for cluster management; Milvus/Zilliz MCP server available.",
  "mcpServer": "https://github.com/zilliztech/mcp-server-milvus",
  "sdks": [
   "Python",
   "Node.js",
   "Go",
   "Java",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pymilvus import MilvusClient\n\nclient = MilvusClient(uri=\"https://YOUR-CLUSTER.zillizcloud.com\", token=\"YOUR_API_KEY\")\nclient.insert(collection_name=\"docs\", data=[{\"id\": 1, \"vector\": [0.1, 0.2, 0.3]}])\nres = client.search(collection_name=\"docs\", data=[[0.1, 0.2, 0.3]], limit=3)"
  },
  "tags": [
   "vector-db",
   "milvus",
   "open-source",
   "serverless",
   "rag",
   "scale"
  ],
  "useCases": []
 },
 {
  "slug": "turbopuffer",
  "name": "Turbopuffer",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Object-storage-native search engine offering vector + full-text search at roughly 10x lower cost than in-memory vector DBs, now with self-serve signup.",
  "blurb": "Object-storage-native search engine offering vector + full-text search at roughly 10x lower cost than in-memory vector DBs, now with self-serve signup.",
  "website": "https://turbopuffer.com",
  "docsUrl": "https://turbopuffer.com/docs",
  "signupUrl": "https://turbopuffer.com/join",
  "pricingModel": "usage-based",
  "pricingNote": "Pure usage: ~$1/PB queried (cut from $5 in Feb 2026), ~$0.02/GB-mo storage; monthly tier minimums $64 / $256 / $4,096; limited free dev usage",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Launch and Scale tiers are product-led / self-serve — sign up, create an API key in the console and start indexing immediately (Enterprise is sales-led). Note the $64/mo tier minimum kicks in beyond limited free dev usage.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "vector-db",
   "full-text-search",
   "object-storage",
   "serverless",
   "cost-efficient"
  ],
  "useCases": []
 },
 {
  "slug": "cloudflare-vectorize",
  "name": "Cloudflare Vectorize",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Serverless vector database that runs on Cloudflare's global edge network, wired directly into Workers and Workers AI for low-latency RAG.",
  "blurb": "Serverless vector database that runs on Cloudflare's global edge network, wired directly into Workers and Workers AI for low-latency RAG.",
  "website": "https://www.cloudflare.com/products/vectorize/",
  "docsUrl": "https://developers.cloudflare.com/vectorize/",
  "signupUrl": "https://dash.cloudflare.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Free tier: 30M queried + 5M stored dimensions/mo; paid $0.01 per million queried dimensions",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Cloudflare account is instant; create an API token in the dashboard, then create/query indexes via the wrangler CLI or HTTP API (or a Worker binding). Cloudflare MCP servers exist for docs/build workflows. Bootstrap (account + token) needs one human step.",
  "mcpServer": "https://github.com/cloudflare/mcp-server-cloudflare",
  "sdks": [
   "JavaScript (Workers)",
   "REST",
   "Wrangler CLI"
  ],
  "codeSample": {
   "lang": "javascript",
   "code": "export default {\n  async fetch(request, env) {\n    await env.VECTORIZE.upsert([\n      { id: \"a1\", values: [0.1, 0.2, 0.3], metadata: { title: \"hello\" } },\n    ]);\n    const results = await env.VECTORIZE.query([0.1, 0.2, 0.3], { topK: 3 });\n    return Response.json(results);\n  },\n};"
  },
  "tags": [
   "vector-db",
   "edge",
   "serverless",
   "workers",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "chroma-cloud",
  "name": "Chroma Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Fully-managed serverless hosting for the developer-favorite open-source Chroma, with the same API as local Chroma and per-database scoped keys.",
  "blurb": "Fully-managed serverless hosting for the developer-favorite open-source Chroma, with the same API as local Chroma and per-database scoped keys.",
  "website": "https://www.trychroma.com",
  "docsUrl": "https://docs.trychroma.com/cloud/getting-started",
  "signupUrl": "https://www.trychroma.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (~1M embeddings) + free credits; usage-based beyond — storage ~$0.02/GB/mo plus query/write ops",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up free, create databases (dev/staging/prod) and scope individual API keys to specific databases from the console; same API as OSS Chroma so code ports 1:1. Official Chroma MCP server.",
  "mcpServer": "https://github.com/chroma-core/chroma-mcp",
  "sdks": [
   "Python",
   "JavaScript/TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import chromadb\n\nclient = chromadb.CloudClient(\n    tenant=\"YOUR_TENANT\",\n    database=\"YOUR_DB\",\n    api_key=\"YOUR_API_KEY\",\n)\ncol = client.get_or_create_collection(\"docs\")\ncol.add(ids=[\"a1\"], embeddings=[[0.1, 0.2, 0.3]], metadatas=[{\"title\": \"hello\"}])\nres = col.query(query_embeddings=[[0.1, 0.2, 0.3]], n_results=3)"
  },
  "tags": [
   "vector-db",
   "open-source",
   "serverless",
   "rag",
   "embeddings"
  ],
  "useCases": []
 },
 {
  "slug": "redis-cloud",
  "name": "Redis Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Managed Redis with a built-in query engine for vector, full-text, geospatial and hybrid search — real-time speed for agent memory and RAG.",
  "blurb": "Managed Redis with a built-in query engine for vector, full-text, geospatial and hybrid search — real-time speed for agent memory and RAG.",
  "website": "https://redis.io/cloud/",
  "docsUrl": "https://redis.io/docs/latest/develop/ai/",
  "signupUrl": "https://redis.io/try-free/",
  "pricingModel": "freemium",
  "pricingNote": "Free 30MB tier (30 connections) including vector search; pay-as-you-go beyond",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup provisions a 30MB database with connection credentials instantly. Redis Cloud REST API manages subscriptions/databases programmatically; official Redis MCP server for agent access.",
  "mcpServer": "https://github.com/redis/mcp-redis",
  "sdks": [
   "Python",
   "Node.js",
   "Java",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "vector-db",
   "redis",
   "in-memory",
   "real-time",
   "agent-memory",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "lancedb-cloud",
  "name": "LanceDB Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Fully-managed serverless vector search for multimodal AI, built on the open-source Lance columnar format — pay only for storage you use.",
  "blurb": "Fully-managed serverless vector search for multimodal AI, built on the open-source Lance columnar format — pay only for storage you use.",
  "website": "https://www.lancedb.com",
  "docsUrl": "https://docs.lancedb.com/cloud",
  "signupUrl": "https://cloud.lancedb.com",
  "pricingModel": "freemium",
  "pricingNote": "Free during public beta; usage-based (pay for storage, scale compute up/down) at GA; OSS embedded version is free",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up for the cloud console, create a project and get an API key; connect via db:// URI + api_key + region. Caveat: LanceDB Cloud is still public beta (GA pricing pending).",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Rust",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import lancedb\n\ndb = lancedb.connect(uri=\"db://your-project\", api_key=\"YOUR_API_KEY\", region=\"us-east-1\")\ntbl = db.create_table(\"docs\", data=[{\"id\": \"a1\", \"vector\": [0.1, 0.2, 0.3]}])\nres = tbl.search([0.1, 0.2, 0.3]).limit(3).to_list()"
  },
  "tags": [
   "vector-db",
   "multimodal",
   "open-source",
   "serverless",
   "lakehouse"
  ],
  "useCases": []
 },
 {
  "slug": "convex",
  "name": "Convex",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Reactive serverless backend-as-a-service with built-in vector search alongside your app data — well suited to real-time AI apps and agents.",
  "blurb": "Reactive serverless backend-as-a-service with built-in vector search alongside your app data — well suited to real-time AI apps and agents.",
  "website": "https://www.convex.dev",
  "docsUrl": "https://docs.convex.dev/search/vector-search",
  "signupUrl": "https://dashboard.convex.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free tier includes vector storage/search; Starter is pay-as-you-go beyond included resources",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup; the Convex CLI generates deploy keys, and vector search is available on all tiers including free. Convex CLI ships an MCP mode for agent-driven backend work.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "JavaScript",
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "// convex/search.ts — vector search must run inside an action\nimport { action } from \"./_generated/server\";\n\nexport const search = action(async (ctx, { embedding }) => {\n  return await ctx.vectorSearch(\"docs\", \"by_embedding\", {\n    vector: embedding,\n    limit: 3,\n  });\n});"
  },
  "tags": [
   "vector-db",
   "backend",
   "serverless",
   "reactive",
   "real-time",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "tiger-cloud",
  "name": "Tiger Cloud (Timescale / TigerData)",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Managed Postgres tuned for scale with pgvector + pgvectorscale and hybrid vector/BM25 search — a Postgres-native RAG backend, no per-vector pricing.",
  "blurb": "Managed Postgres tuned for scale with pgvector + pgvectorscale and hybrid vector/BM25 search — a Postgres-native RAG backend, no per-vector pricing.",
  "website": "https://www.tigerdata.com",
  "docsUrl": "https://www.tigerdata.com/docs/use-timescale/latest/extensions/pgvector",
  "signupUrl": "https://www.tigerdata.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free trial ($1,000 credits / free first month), spin up in minutes with no credit card; then usage-based compute (hourly) + storage",
  "authType": "account",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up without a credit card and spin up a service in minutes, getting a Postgres connection string; pgvector/pgvectorscale/pgai enabled via SQL. Standard Postgres tooling (drivers, Terraform) applies.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Node.js",
   "any Postgres driver",
   "SQL"
  ],
  "codeSample": {
   "lang": "sql",
   "code": "CREATE EXTENSION IF NOT EXISTS vector;\nCREATE TABLE docs (id bigserial PRIMARY KEY, embedding vector(3));\nINSERT INTO docs (embedding) VALUES ('[0.1,0.2,0.3]');\nSELECT id FROM docs ORDER BY embedding <-> '[0.1,0.2,0.3]' LIMIT 3;"
  },
  "tags": [
   "vector-db",
   "postgres",
   "pgvector",
   "pgvectorscale",
   "hybrid-search",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "vespa-cloud",
  "name": "Vespa Cloud",
  "category": "vector-db-infra",
  "kind": "api",
  "oneLiner": "Managed cloud for Vespa, the big-data search-and-inference platform combining vector search, ML-ranked retrieval and real-time inference at massive scale.",
  "blurb": "Managed cloud for Vespa, the big-data search-and-inference platform combining vector search, ML-ranked retrieval and real-time inference at massive scale.",
  "website": "https://vespa.ai",
  "docsUrl": "https://cloud.vespa.ai",
  "signupUrl": "https://console.vespa-cloud.com",
  "pricingModel": "usage-based",
  "pricingNote": "$300 free trial credits, no credit card (Google or GitHub login); then charged by the machine resources your app allocates per hour",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Onboard with a Google/GitHub account (no CC) and get $300 credits; create a tenant at console.vespa-cloud.com. Deployment uses application packages (not a one-line insert), so setup is heavier than a plain vector DB.",
  "mcpServer": "",
  "sdks": [
   "Java",
   "Python (pyvespa)",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "vector-db",
   "search",
   "ml-ranking",
   "hybrid-search",
   "scale",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "langsmith",
  "name": "LangSmith",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "LangChain's managed tracing, evaluation and prompt-engineering platform for LLM and agent apps.",
  "blurb": "LangChain's managed tracing, evaluation and prompt-engineering platform for LLM and agent apps.",
  "website": "https://www.langchain.com/langsmith",
  "docsUrl": "https://docs.langchain.com/langsmith/observability",
  "signupUrl": "https://smith.langchain.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free Developer: 5k traces/mo, 14-day retention, 1 seat; Plus $39/seat/mo (10k traces incl., $2.50/1k overage); Enterprise custom.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup via Google/GitHub/email, no credit card; create an API key in Settings instantly. No public account-provisioning API for autonomous agents.",
  "mcpServer": "https://github.com/langchain-ai/langsmith-mcp-server",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import openai\nfrom langsmith import wrappers, traceable\n\n# set LANGSMITH_TRACING=true and LANGSMITH_API_KEY=lsv2_...\nclient = wrappers.wrap_openai(openai.OpenAI())\n\n@traceable\ndef answer(question: str):\n    return client.chat.completions.create(\n        model=\"gpt-4o-mini\",\n        messages=[{\"role\": \"user\", \"content\": question}],\n    )\n\nanswer(\"What is LLM observability?\")"
  },
  "tags": [
   "tracing",
   "evals",
   "agents",
   "prompt-management",
   "langchain",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "langfuse-cloud",
  "name": "Langfuse Cloud",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Open-source-core LLM observability with tracing, evals, prompt management and playground, offered as a managed cloud.",
  "blurb": "Open-source-core LLM observability with tracing, evals, prompt management and playground, offered as a managed cloud.",
  "website": "https://langfuse.com",
  "docsUrl": "https://langfuse.com/docs",
  "signupUrl": "https://cloud.langfuse.com",
  "pricingModel": "freemium",
  "pricingNote": "Cloud: Hobby $0, Core $29/mo, Pro $199/mo, Enterprise $2,499/mo; usage overage ~$8 / 100k units. Core product is MIT open-source (self-host free).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Cloud Hobby tier free with no credit card; project keys (pk-lf-.../sk-lf-...) are created instantly in the UI. Programmatic org/project/key provisioning (Instance-Management/Admin API) exists ONLY on self-hosted Enterprise, not on Cloud.",
  "mcpServer": "https://langfuse.com/docs/api-and-data-platform/features/mcp-server",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# env: LANGFUSE_PUBLIC_KEY=pk-lf-..., LANGFUSE_SECRET_KEY=sk-lf-..., LANGFUSE_HOST=https://cloud.langfuse.com\n# drop-in OpenAI wrapper auto-traces every call\nfrom langfuse.openai import openai\n\nresp = openai.chat.completions.create(\n    model=\"gpt-4o\",\n    messages=[{\"role\": \"user\", \"content\": \"Trace this call\"}],\n)\nprint(resp.choices[0].message.content)"
  },
  "tags": [
   "tracing",
   "evals",
   "prompt-management",
   "open-source",
   "opentelemetry",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "braintrust",
  "name": "Braintrust",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Eval-first AI platform unifying evaluations, tracing/logging and prompt playground for shipping quality AI products.",
  "blurb": "Eval-first AI platform unifying evaluations, tracing/logging and prompt playground for shipping quality AI products.",
  "website": "https://www.braintrust.dev",
  "docsUrl": "https://www.braintrust.dev/docs",
  "signupUrl": "https://www.braintrust.dev/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free Starter: 1 GB processed data, 10k scores, 14-day retention; Pro $249/mo (5 GB, 50k scores); Enterprise custom. No per-seat charge.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up free with no credit card and generate an API key from the dashboard. Ships a mature MCP server for IDE-native trace/eval querying (Cursor, Claude Code, VS Code).",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install braintrust autoevals ; export BRAINTRUST_API_KEY=...\nfrom braintrust import Eval\nfrom autoevals import Levenshtein\n\nEval(\n    \"my-project\",\n    data=lambda: [{\"input\": \"Hi\", \"expected\": \"Hello\"}],\n    task=lambda text: text.replace(\"Hi\", \"Hello\"),\n    scores=[Levenshtein],\n)"
  },
  "tags": [
   "evals",
   "tracing",
   "experiments",
   "prompt-playground",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "arize-phoenix",
  "name": "Arize Phoenix / AX",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Open-source LLM/agent observability (Phoenix) plus Arize AX, the commercial platform for production monitoring and online evals.",
  "blurb": "Open-source LLM/agent observability (Phoenix) plus Arize AX, the commercial platform for production monitoring and online evals.",
  "website": "https://arize.com/phoenix/",
  "docsUrl": "https://arize.com/docs/phoenix",
  "signupUrl": "https://app.phoenix.arize.com",
  "pricingModel": "freemium",
  "pricingNote": "Phoenix OSS is free/self-hostable; Arize hosts a free Phoenix cloud tier; Arize AX (production monitoring, online evals, Alyx assistant) is paid/enterprise.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Phoenix OSS needs NO signup and NO API key for local/self-hosted tracing (pip install arize-phoenix). Phoenix Cloud (app.phoenix.arize.com) uses a free instant API key after signup.",
  "mcpServer": "@arizeai/phoenix-mcp",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install arize-phoenix openinference-instrumentation-openai\nfrom phoenix.otel import register\n\n# auto-instruments OpenAI, LangChain, LlamaIndex, etc.\ntracer_provider = register(\n    project_name=\"my-app\",\n    auto_instrument=True,\n)\n# For Phoenix Cloud, also set PHOENIX_API_KEY + PHOENIX_COLLECTOR_ENDPOINT"
  },
  "tags": [
   "tracing",
   "evals",
   "open-source",
   "opentelemetry",
   "rag",
   "agents",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "comet-opik",
  "name": "Comet Opik",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Open-source LLM tracing, LLM-as-a-judge evals and experiment management from Comet, with a managed cloud.",
  "blurb": "Open-source LLM tracing, LLM-as-a-judge evals and experiment management from Comet, with a managed cloud.",
  "website": "https://www.comet.com/site/products/opik/",
  "docsUrl": "https://www.comet.com/docs/opik/",
  "signupUrl": "https://www.comet.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Opik Cloud free tier + Opik Pro ~$19/mo with higher limits; OSS edition is free/self-hosted (docker compose).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up for Comet free and get an API key instantly; `pip install opik` then `opik configure` (or set OPIK_API_KEY/OPIK_WORKSPACE). Self-host needs no key.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install opik ; opik configure  (or set OPIK_API_KEY / OPIK_WORKSPACE)\nimport opik\nfrom opik.integrations.openai import track_openai\nfrom openai import OpenAI\n\nclient = track_openai(OpenAI())\n\n@opik.track\ndef pipeline(q: str):\n    return client.chat.completions.create(\n        model=\"gpt-4o-mini\",\n        messages=[{\"role\": \"user\", \"content\": q}],\n    )"
  },
  "tags": [
   "tracing",
   "evals",
   "llm-as-judge",
   "open-source",
   "agents",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "galileo",
  "name": "Galileo",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Enterprise AI evaluation + observability platform where offline evals become production guardrails (now part of Cisco).",
  "blurb": "Enterprise AI evaluation + observability platform where offline evals become production guardrails (now part of Cisco).",
  "website": "https://galileo.ai/",
  "docsUrl": "https://docs.galileo.ai",
  "signupUrl": "https://app.galileo.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free: 5,000 traces/mo, unlimited users & custom evals; Pro $100/mo (billed yearly, 50k traces/mo); Enterprise custom. Cisco completed acquisition May 2026.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free plan self-serve; create an account and generate an API key in-app. Enterprise deployment options require sales.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "evals",
   "guardrails",
   "observability",
   "enterprise",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "honeyhive",
  "name": "HoneyHive",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "OpenTelemetry-based observability and evaluation platform purpose-built for production AI agents.",
  "blurb": "OpenTelemetry-based observability and evaluation platform purpose-built for production AI agents.",
  "website": "https://www.honeyhive.ai/",
  "docsUrl": "https://docs.honeyhive.ai/introduction/what-is-hhai",
  "signupUrl": "https://app.honeyhive.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free tier: up to 10k events/mo, 5 users, 30-day retention, 1 workspace; Enterprise custom (SSO/SAML, PII scrubbing). Startup discounts for <$5M raised.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free tier self-serve; initialize the tracer with an API key created in the dashboard. Enterprise limits require contacting sales.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install honeyhive\nfrom honeyhive import HoneyHiveTracer\n\nHoneyHiveTracer.init(\n    api_key=\"<HONEYHIVE_API_KEY>\",\n    project=\"my-project\",\n    session_name=\"prod-run\",\n)\n# subsequent LLM/tool calls are auto-traced via OpenTelemetry"
  },
  "tags": [
   "tracing",
   "evals",
   "agents",
   "opentelemetry",
   "human-in-the-loop"
  ],
  "useCases": []
 },
 {
  "slug": "traceloop",
  "name": "Traceloop",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "LLM reliability platform built on OpenLLMetry, an OpenTelemetry-native tracing layer for LLM apps.",
  "blurb": "LLM reliability platform built on OpenLLMetry, an OpenTelemetry-native tracing layer for LLM apps.",
  "website": "https://www.traceloop.com/",
  "docsUrl": "https://www.traceloop.com/docs/openllmetry/introduction",
  "signupUrl": "https://app.traceloop.com",
  "pricingModel": "freemium",
  "pricingNote": "Free up to 50,000 spans/mo, no seat limit, all features open; OpenLLMetry SDK is Apache-2.0 and can export to 25+ backends.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up free at app.traceloop.com; generate a per-environment (Dev/Staging/Prod) API key shown once at creation. OpenLLMetry SDK itself needs no Traceloop account.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install traceloop-sdk ; export TRACELOOP_API_KEY=...\nfrom traceloop.sdk import Traceloop\n\nTraceloop.init(app_name=\"my-app\")\n# OpenAI / Anthropic / LangChain calls are now auto-instrumented"
  },
  "tags": [
   "tracing",
   "opentelemetry",
   "open-source",
   "openllmetry",
   "monitoring"
  ],
  "useCases": []
 },
 {
  "slug": "promptlayer",
  "name": "PromptLayer",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Prompt management + LLM observability platform for versioning prompts, running evals and tracing agents in production.",
  "blurb": "Prompt management + LLM observability platform for versioning prompts, running evals and tracing agents in production.",
  "website": "https://www.promptlayer.com/",
  "docsUrl": "https://docs.promptlayer.com",
  "signupUrl": "https://www.promptlayer.com/",
  "pricingModel": "freemium",
  "pricingNote": "Free tier available; prompt registry, evals and request logging across OpenAI/Anthropic and others. Paid tiers for team features.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Create an account and click to generate an API key; REST API available for logging and prompt retrieval. No account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install promptlayer\nfrom promptlayer import PromptLayer\n\npl = PromptLayer(api_key=\"pl_...\")\nOpenAI = pl.openai.OpenAI          # drop-in, logs every request\nclient = OpenAI()\nresp = client.chat.completions.create(\n    model=\"gpt-4o-mini\",\n    messages=[{\"role\": \"user\", \"content\": \"logged to PromptLayer\"}],\n)"
  },
  "tags": [
   "prompt-management",
   "tracing",
   "evals",
   "versioning",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "wandb-weave",
  "name": "W&B Weave",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Weights & Biases' LLM observability and evaluation toolkit that auto-traces calls and runs LLM-judge scorers.",
  "blurb": "Weights & Biases' LLM observability and evaluation toolkit that auto-traces calls and runs LLM-judge scorers.",
  "website": "https://wandb.ai/site/weave",
  "docsUrl": "https://docs.wandb.ai/weave",
  "signupUrl": "https://wandb.ai/signup",
  "pricingModel": "freemium",
  "pricingNote": "Generous free tier for individuals; paid scales per seat, bundled into the W&B Models pricing surface (per-seat + tracked hours). Confirm on the W&B pricing page.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free W&B account; grab your API key instantly at wandb.ai/authorize, then weave.init(project). No account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install weave ; key from https://wandb.ai/authorize\nimport weave\nweave.init(\"my-project\")\n\n@weave.op\ndef generate(prompt: str) -> str:\n    # any LLM call here is captured with inputs/outputs/cost/latency\n    return call_model(prompt)"
  },
  "tags": [
   "tracing",
   "evals",
   "llm-as-judge",
   "experiments",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "datadog-llm-observability",
  "name": "Datadog LLM Observability",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "LLM/agent observability inside Datadog's APM suite, billing only on LLM spans with built-in online/offline evals.",
  "blurb": "LLM/agent observability inside Datadog's APM suite, billing only on LLM spans with built-in online/offline evals.",
  "website": "https://www.datadoghq.com/product/ai/llm-observability/",
  "docsUrl": "https://docs.datadoghq.com/llm_observability/",
  "signupUrl": "https://www.datadoghq.com/free-datadog-trial/",
  "pricingModel": "freemium",
  "pricingNote": "Free: up to 40k LLM spans/mo, 15-day retention; Pro from $160/mo for 100k LLM spans + on-demand overage; only LLM spans are billed (tool/agent/retrieval spans free).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Requires a Datadog account (free trial, no CC); API key + application key are self-serve in Organization Settings. Enterprise/account-based, no autonomous account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install ddtrace\nfrom ddtrace.llmobs import LLMObs\n\nLLMObs.enable(\n    ml_app=\"my-app\",\n    api_key=\"<DD_API_KEY>\",\n    site=\"datadoghq.com\",\n    agentless_enabled=True,\n)\n# LLM calls within traced functions now appear in LLM Observability"
  },
  "tags": [
   "tracing",
   "evals",
   "apm",
   "enterprise",
   "agents",
   "monitoring"
  ],
  "useCases": []
 },
 {
  "slug": "confident-ai",
  "name": "Confident AI (DeepEval)",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Cloud AI-quality platform on top of the open-source DeepEval framework: test management, tracing and analytics.",
  "blurb": "Cloud AI-quality platform on top of the open-source DeepEval framework: test management, tracing and analytics.",
  "website": "https://www.confident-ai.com/",
  "docsUrl": "https://www.confident-ai.com/docs",
  "signupUrl": "https://app.confident-ai.com",
  "pricingModel": "freemium",
  "pricingNote": "Free tier available; paid Starter around $19-$20/mo (approx $9.99/user/mo entry) for team dashboards & RBAC. DeepEval framework is Apache-2.0, free.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "`pip install deepeval` then `deepeval login` (or sign up in-app) to get an API key; every feature — including project provisioning, datasets, traces — is exposed via API once authenticated.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install deepeval ; deepeval login  (to sync to Confident AI cloud)\nfrom deepeval import evaluate\nfrom deepeval.test_case import LLMTestCase\nfrom deepeval.metrics import AnswerRelevancyMetric\n\ntest_case = LLMTestCase(\n    input=\"What's the capital of France?\",\n    actual_output=\"Paris\",\n)\nevaluate(test_cases=[test_case], metrics=[AnswerRelevancyMetric()])"
  },
  "tags": [
   "evals",
   "testing",
   "deepeval",
   "open-source",
   "llm-as-judge",
   "rag"
  ],
  "useCases": []
 },
 {
  "slug": "maxim-ai",
  "name": "Maxim AI",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "End-to-end GenAI platform to simulate, evaluate and observe agents, with prompt versioning and online evals.",
  "blurb": "End-to-end GenAI platform to simulate, evaluate and observe agents, with prompt versioning and online evals.",
  "website": "https://www.getmaxim.ai/",
  "docsUrl": "https://www.getmaxim.ai/docs",
  "signupUrl": "https://app.getmaxim.ai",
  "pricingModel": "freemium",
  "pricingNote": "Developer free; Professional $29/seat/mo; Business $49/seat/mo (RBAC, PII management); Enterprise custom. 14-day trial, no credit card.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Developer tier, no credit card; get an API key in-app. SDKs + REST APIs can programmatically trigger test runs and fetch deployed prompts once authenticated.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Java",
   "Go",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "evals",
   "simulation",
   "agents",
   "observability",
   "prompt-management"
  ],
  "useCases": []
 },
 {
  "slug": "langtrace",
  "name": "Langtrace",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "OpenTelemetry-native, open-source tracing and metrics for LLM, vector-DB and framework calls, with a hosted cloud.",
  "blurb": "OpenTelemetry-native, open-source tracing and metrics for LLM, vector-DB and framework calls, with a hosted cloud.",
  "website": "https://www.langtrace.ai/",
  "docsUrl": "https://docs.langtrace.ai/",
  "signupUrl": "https://app.langtrace.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free for 5,000 spans/mo, then roughly $31/user/mo; app is self-hostable (AGPL-3.0) with Apache-2.0 SDKs.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up, create a project and generate an API key in-app; or self-host (Next.js + Postgres + ClickHouse via Docker) with no external key. No account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "OpenTelemetry"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install langtrace-python-sdk  (import BEFORE your LLM libraries)\nfrom langtrace_python_sdk import langtrace\nlangtrace.init(api_key=\"<LANGTRACE_API_KEY>\")\n\nfrom openai import OpenAI\nclient = OpenAI()\nclient.chat.completions.create(\n    model=\"gpt-4o-mini\",\n    messages=[{\"role\": \"user\", \"content\": \"auto-traced via OTel\"}],\n)"
  },
  "tags": [
   "tracing",
   "opentelemetry",
   "open-source",
   "vector-db",
   "metrics"
  ],
  "useCases": []
 },
 {
  "slug": "lunary",
  "name": "Lunary",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "Lightweight open-source LLM observability, prompt management and analytics, tuned for chatbots and RAG.",
  "blurb": "Lightweight open-source LLM observability, prompt management and analytics, tuned for chatbots and RAG.",
  "website": "https://lunary.ai/",
  "docsUrl": "https://lunary.ai/docs",
  "signupUrl": "https://app.lunary.ai",
  "pricingModel": "freemium",
  "pricingNote": "Free tier ~1,000 daily events; paid from ~$30/mo. Apache-2.0 open-source, self-hostable; cloud is SOC 2 Type II / ISO 27001.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Grab a public/project key from the Lunary dashboard after free signup, or self-host with your own keys. No account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# pip install lunary ; export LUNARY_PUBLIC_KEY=...\nimport lunary\nfrom openai import OpenAI\n\nclient = OpenAI()\nlunary.monitor(client)   # wraps the client to log every call\nclient.chat.completions.create(\n    model=\"gpt-4o-mini\",\n    messages=[{\"role\": \"user\", \"content\": \"tracked by Lunary\"}],\n)"
  },
  "tags": [
   "tracing",
   "prompt-management",
   "analytics",
   "open-source",
   "rag",
   "chatbots"
  ],
  "useCases": []
 },
 {
  "slug": "future-agi",
  "name": "Future AGI",
  "category": "observability-eval",
  "kind": "api",
  "oneLiner": "All-in-one evaluate/observe/improve platform for LLM and agent apps: tracing, evals, simulations, gateway and guardrails.",
  "blurb": "All-in-one evaluate/observe/improve platform for LLM and agent apps: tracing, evals, simulations, gateway and guardrails.",
  "website": "https://futureagi.com/",
  "docsUrl": "https://docs.futureagi.com",
  "signupUrl": "https://futureagi.com/pricing",
  "pricingModel": "freemium",
  "pricingNote": "Free plan for small teams; Pro from $50/mo flat (not per seat). Multi-dimensional usage billing (storage, AI credits, gateway, cache, simulation); BYOK $0. Apache-2.0 self-hostable.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free 'Start Free' signup; generate an API key in-app. Self-hostable OSS build available with your own keys. No autonomous account-provisioning API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "evals",
   "tracing",
   "simulation",
   "guardrails",
   "gateway",
   "open-source",
   "agents"
  ],
  "useCases": []
 },
 {
  "slug": "mem0-cloud",
  "name": "Mem0 (Cloud)",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Universal memory layer that adds persistent, personalized long-term memory to AI agents and apps in a few lines of code.",
  "blurb": "Universal memory layer that adds persistent, personalized long-term memory to AI agents and apps in a few lines of code.",
  "website": "https://mem0.ai",
  "docsUrl": "https://docs.mem0.ai",
  "signupUrl": "https://app.mem0.ai/get-api-key",
  "pricingModel": "freemium",
  "pricingNote": "Free Hobby tier (10k memories, 1k retrievals/mo); Starter ~$19/mo; Pro ~$249/mo",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Agent-first signup: `mem0 init --agent --agent-caller <name>` (or one API call) mints a working key in <5s in a JSON envelope, no email/OTP/human; ~5 signups/day/IP. Core is also open-source (self-host, no key).",
  "mcpServer": "https://github.com/mem0ai/mem0",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from mem0 import MemoryClient\n\nclient = MemoryClient(api_key=\"your-api-key\")  # or run: mem0 init --agent\nclient.add(\n    [{\"role\": \"user\", \"content\": \"I'm vegetarian and allergic to nuts\"}],\n    user_id=\"alex\",\n)\nresults = client.search(\"What can Alex eat?\", user_id=\"alex\")"
  },
  "tags": [
   "memory",
   "agents",
   "personalization",
   "vector",
   "graph",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "zep-cloud",
  "name": "Zep Cloud",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Temporal knowledge-graph memory for agents that tracks what was true and when, engineered from chat history and business data.",
  "blurb": "Temporal knowledge-graph memory for agents that tracks what was true and when, engineered from chat history and business data.",
  "website": "https://www.getzep.com",
  "docsUrl": "https://help.getzep.com",
  "signupUrl": "https://www.getzep.com",
  "pricingModel": "freemium",
  "pricingNote": "Free tier 10k credits/mo; paid plans from ~$125/mo (credits metered by episode size, ~1 credit / 350 bytes)",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Human signs up at app.getzep.com and copies the API key from the dashboard; no self-serve provisioning API.",
  "mcpServer": "https://github.com/getzep/graphiti",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from zep_cloud.client import Zep\nfrom zep_cloud import Message\n\nclient = Zep(api_key=\"your-api-key\")\nclient.thread.add_messages(\n    thread_id=\"thread-1\",\n    messages=[Message(name=\"Jane\", role=\"user\", content=\"I want to upgrade to Pro\")],\n)\ncontext = client.thread.get_user_context(thread_id=\"thread-1\")"
  },
  "tags": [
   "memory",
   "agents",
   "knowledge-graph",
   "temporal",
   "context"
  ],
  "useCases": []
 },
 {
  "slug": "letta-cloud",
  "name": "Letta Cloud",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Fully-managed API for stateful agents that manage their own memory like an OS (context = RAM, archival = disk) and self-improve over time.",
  "blurb": "Fully-managed API for stateful agents that manage their own memory like an OS (context = RAM, archival = disk) and self-improve over time.",
  "website": "https://www.letta.com",
  "docsUrl": "https://docs.letta.com",
  "signupUrl": "https://app.letta.com/api-keys",
  "pricingModel": "usage-based",
  "pricingNote": "Free personal tier to start; API billed usage-based on the underlying model's token costs",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Human creates a key at app.letta.com/api-keys. Letta server is open-source and can be self-hosted with no external key.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from letta_client import Letta\n\nclient = Letta(token=\"LETTA_API_KEY\")\nagent = client.agents.create(\n    model=\"openai/gpt-4o-mini\",\n    embedding=\"openai/text-embedding-3-small\",\n    memory_blocks=[{\"label\": \"human\", \"value\": \"The human's name is Chad.\"}],\n)\nresp = client.agents.messages.create(\n    agent_id=agent.id,\n    messages=[{\"role\": \"user\", \"content\": \"Remember I love hiking.\"}],\n)"
  },
  "tags": [
   "memory",
   "agents",
   "stateful",
   "self-improving",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "supermemory",
  "name": "Supermemory",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Hosted universal memory API that stores, indexes, and retrieves long-term context, RAG, and user profiles for AI apps with one API.",
  "blurb": "Hosted universal memory API that stores, indexes, and retrieves long-term context, RAG, and user profiles for AI apps with one API.",
  "website": "https://supermemory.ai",
  "docsUrl": "https://docs.supermemory.ai",
  "signupUrl": "https://console.supermemory.ai",
  "pricingModel": "usage-based",
  "pricingNote": "Free plan; usage-based ~$0.005 / 1k tokens (text), ~$0.010 / 1k (rich media); startup program: $1k credits",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Key from console.supermemory.ai after email/OAuth signup. Open-source engine can be self-hosted (base_url) with no external key.",
  "mcpServer": "https://github.com/supermemoryai/supermemory",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from supermemory import Supermemory\n\nclient = Supermemory(api_key=\"SUPERMEMORY_API_KEY\")\nclient.add(content=\"Alex prefers dark mode\", container_tags=[\"user_alex\"])\nresults = client.search.documents(q=\"UI preferences\", container_tags=[\"user_alex\"])"
  },
  "tags": [
   "memory",
   "agents",
   "rag",
   "context",
   "open-source",
   "coding-agents"
  ],
  "useCases": []
 },
 {
  "slug": "cognee",
  "name": "cognee",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Open-source AI memory platform that builds a knowledge-graph-plus-vector memory for agents via a self-improving cognify pipeline.",
  "blurb": "Open-source AI memory platform that builds a knowledge-graph-plus-vector memory for agents via a self-improving cognify pipeline.",
  "website": "https://www.cognee.ai",
  "docsUrl": "https://docs.cognee.ai",
  "signupUrl": "https://platform.cognee.ai/sign-in",
  "pricingModel": "freemium",
  "pricingNote": "OSS core free (MIT); Cloud free 1M tokens, no card, 14-day trial; ~$2.50 per 1M tokens processed",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Cloud key via Google/GitHub signup at platform.cognee.ai (no card), created in the dashboard. OSS self-host (pip install cognee) needs no external key.",
  "mcpServer": "https://github.com/topoteretes/cognee",
  "sdks": [
   "Python",
   "REST",
   "MCP"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import cognee, asyncio\n\nasync def main():\n    await cognee.add(\"Alex is a founder building an AI publication.\")\n    await cognee.cognify()          # builds the knowledge graph\n    print(await cognee.search(\"What is Alex building?\"))\n\nasyncio.run(main())"
  },
  "tags": [
   "memory",
   "agents",
   "knowledge-graph",
   "graphrag",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "redis-agent-memory",
  "name": "Redis Agent Memory Server",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Redis-based dual-tier memory (working + long-term semantic) server and managed context engine for agents, with LangCache semantic caching.",
  "blurb": "Redis-based dual-tier memory (working + long-term semantic) server and managed context engine for agents, with LangCache semantic caching.",
  "website": "https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/",
  "docsUrl": "https://redis.github.io/agent-memory-server/",
  "signupUrl": "https://redis.io/cloud/",
  "pricingModel": "freemium",
  "pricingNote": "agent-memory-server is open-source (free); managed via Redis Cloud / LangCache with a free tier + paid usage",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Managed Redis Cloud needs a human account. The open-source agent-memory-server self-hosts (docker) with no external key and exposes REST + MCP interfaces.",
  "mcpServer": "https://github.com/redis/agent-memory-server",
  "sdks": [
   "Python",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "memory",
   "agents",
   "vector",
   "semantic-cache",
   "open-source",
   "redis"
  ],
  "useCases": []
 },
 {
  "slug": "memobase",
  "name": "Memobase",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "User-profile-based long-term memory that batches conversations into structured profiles to personalize LLM apps cheaply and fast.",
  "blurb": "User-profile-based long-term memory that batches conversations into structured profiles to personalize LLM apps cheaply and fast.",
  "website": "https://www.memobase.io",
  "docsUrl": "https://docs.memobase.io",
  "signupUrl": "https://www.memobase.io/pricing",
  "pricingModel": "freemium",
  "pricingNote": "OSS self-host free; cloud free tier + pay-as-you-go token pricing (positions ~5x cheaper/faster than some alternatives)",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Cloud API key via signup. Open-source server can be self-hosted (docker) with no external key.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from memobase import MemoBaseClient, ChatBlob\n\nclient = MemoBaseClient(project_url=\"https://api.memobase.dev\", api_key=\"your-key\")\nuid = client.add_user()\nuser = client.get_user(uid)\nuser.insert(ChatBlob(messages=[{\"role\": \"user\", \"content\": \"I love sushi\"}]))\nuser.flush()\nprint(user.context())   # profile-based memory for the system prompt"
  },
  "tags": [
   "memory",
   "agents",
   "user-profile",
   "personalization",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "cloudflare-agent-memory",
  "name": "Cloudflare Agent Memory",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Managed persistent memory service for agents built on Durable Objects + Vectorize, handling extraction, storage, search, and summarization.",
  "blurb": "Managed persistent memory service for agents built on Durable Objects + Vectorize, handling extraction, storage, search, and summarization.",
  "website": "https://developers.cloudflare.com/agent-memory/",
  "docsUrl": "https://developers.cloudflare.com/agents/concepts/memory/",
  "signupUrl": "https://dash.cloudflare.com/sign-up",
  "pricingModel": "usage-based",
  "pricingNote": "Beta; usage-based on the Cloudflare platform (Workers/Durable Objects free tier available)",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Requires a Cloudflare account + API token; token creation is scriptable via the Cloudflare API once the (human-created) account exists.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "memory",
   "agents",
   "edge",
   "durable-objects",
   "vector",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "vertex-ai-memory-bank",
  "name": "Vertex AI Memory Bank",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Google Cloud's managed long-term memory for agents (Agent Engine) that uses Gemini to extract facts and preferences scoped per user.",
  "blurb": "Google Cloud's managed long-term memory for agents (Agent Engine) that uses Gemini to extract facts and preferences scoped per user.",
  "website": "https://cloud.google.com/blog/products/ai-machine-learning/vertex-ai-memory-bank-in-public-preview",
  "docsUrl": "https://docs.cloud.google.com/agent-builder/agent-engine/memory-bank/overview",
  "signupUrl": "https://console.cloud.google.com",
  "pricingModel": "usage-based",
  "pricingNote": "GA; ~$0.25 per 1,000 stored session events or memories (from Jan 28, 2026)",
  "authType": "oauth",
  "agentSignup": "manual-only",
  "agentSignupNote": "Requires a GCP project with service-account / Application Default Credentials (OAuth); human/IAM setup needed before an agent can call it.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "Java",
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "memory",
   "agents",
   "google-cloud",
   "gemini",
   "adk",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "pinecone-assistant",
  "name": "Pinecone Assistant",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Managed knowledge/context layer on Pinecone that ingests files and serves grounded chat + context retrieval for production AI apps.",
  "blurb": "Managed knowledge/context layer on Pinecone that ingests files and serves grounded chat + context retrieval for production AI apps.",
  "website": "https://www.pinecone.io/blog/assistant-managed-knowledge-layer/",
  "docsUrl": "https://docs.pinecone.io/guides/assistant/pricing-and-limits",
  "signupUrl": "https://app.pinecone.io",
  "pricingModel": "usage-based",
  "pricingNote": "Free tier (1 index, 2GB); Assistant usage-based, Standard plan ~$50/mo minimum then pay-as-you-go",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Human signs up at app.pinecone.io and copies the API key from the console.",
  "mcpServer": "https://github.com/pinecone-io/pinecone-mcp",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pinecone import Pinecone\n\npc = Pinecone(api_key=\"YOUR_API_KEY\")\nassistant = pc.assistant.create_assistant(assistant_name=\"support\")\nassistant.upload_file(file_path=\"handbook.pdf\")\nresp = assistant.chat(messages=[{\"role\": \"user\", \"content\": \"Summarize the refund policy\"}])"
  },
  "tags": [
   "memory",
   "context",
   "rag",
   "vector",
   "managed",
   "knowledge"
  ],
  "useCases": []
 },
 {
  "slug": "graphlit",
  "name": "Graphlit",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Cloud-native context layer that ingests documents, audio, video, and web data into semantic memory retrievable by agents via one API.",
  "blurb": "Cloud-native context layer that ingests documents, audio, video, and web data into semantic memory retrievable by agents via one API.",
  "website": "https://www.graphlit.com",
  "docsUrl": "https://docs.graphlit.dev",
  "signupUrl": "https://portal.graphlit.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free tier to start (1GB, no card); paid tiers for scale",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Human signs up at portal.graphlit.dev (OAuth/email), creates a project to get Organization ID, Environment ID, and JWT secret for signing tokens.",
  "mcpServer": "https://github.com/graphlit/graphlit-mcp-server",
  "sdks": [
   "Python",
   "TypeScript",
   "REST",
   "MCP"
  ],
  "codeSample": null,
  "tags": [
   "memory",
   "context",
   "multimodal",
   "knowledge-graph",
   "rag",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "langmem",
  "name": "LangMem",
  "category": "memory-context",
  "kind": "api",
  "oneLiner": "Open-source SDK from LangChain that gives LangGraph agents long-term memory (extraction, search, prompt optimization) in your own store.",
  "blurb": "Open-source SDK from LangChain that gives LangGraph agents long-term memory (extraction, search, prompt optimization) in your own store.",
  "website": "https://langchain-ai.github.io/langmem/",
  "docsUrl": "https://langchain-ai.github.io/langmem/",
  "signupUrl": "https://github.com/langchain-ai/langmem",
  "pricingModel": "open-source",
  "pricingNote": "Free open-source; runs in your infra on your existing LangGraph store (Postgres/SQLite/in-memory); managed service on waitlist",
  "authType": "none",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "No signup or API key exists at all — it's an open-source library; an agent can `pip install langmem` and use it immediately against its own store (no human, no credentials).",
  "mcpServer": "",
  "sdks": [
   "Python"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from langgraph.store.memory import InMemoryStore\nfrom langmem import create_manage_memory_tool, create_search_memory_tool\n\nstore = InMemoryStore(index={\"dims\": 1536, \"embed\": \"openai:text-embedding-3-small\"})\nmanage_memory = create_manage_memory_tool(namespace=(\"memories\",))\nsearch_memory = create_search_memory_tool(namespace=(\"memories\",))\n# give these tools to your LangGraph agent; it reads/writes long-term memory in `store`"
  },
  "tags": [
   "memory",
   "agents",
   "langgraph",
   "open-source",
   "sdk"
  ],
  "useCases": []
 },
 {
  "slug": "daytona",
  "name": "Daytona",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Elastic, stateful sandboxes for AI-generated code that cold-start in ~90ms, with parallel forking, snapshots, and SDKs in five languages.",
  "blurb": "Elastic, stateful sandboxes for AI-generated code that cold-start in ~90ms, with parallel forking, snapshots, and SDKs in five languages.",
  "website": "https://www.daytona.io",
  "docsUrl": "https://www.daytona.io/docs",
  "signupUrl": "https://app.daytona.io/dashboard/keys",
  "pricingModel": "usage-based",
  "pricingNote": "$200 free compute credits + 5GB free storage; then vCPU $0.0504/hr, memory $0.0162/GiB-hr, storage $0.000108/GiB-hr. Startup program up to $50k credits",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at app.daytona.io, no card; API key created instantly at /dashboard/keys with $200 credits. No account-creation API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Ruby",
   "Go",
   "Java",
   "REST",
   "CLI"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from daytona import Daytona\n\ndaytona = Daytona()  # reads DAYTONA_API_KEY from env\nsandbox = daytona.create()\nresponse = sandbox.process.code_run('print(\"Hello World\")')\nprint(response.result)\nsandbox.delete()"
  },
  "tags": [
   "fast-start",
   "fork",
   "snapshots",
   "computer-use",
   "mcp",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "fly-machines",
  "name": "Fly.io Machines",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "A REST API that boots ephemeral Firecracker microVMs from OCI containers in a few hundred ms — a low-level sandbox layer for agents (see also Fly Sprites).",
  "blurb": "A REST API that boots ephemeral Firecracker microVMs from OCI containers in a few hundred ms — a low-level sandbox layer for agents (see also Fly Sprites).",
  "website": "https://fly.io",
  "docsUrl": "https://fly.io/docs/machines/api/",
  "signupUrl": "https://fly.io/app/sign-up",
  "pricingModel": "usage-based",
  "pricingNote": "Pay per second running; shared-cpu-1x/256MB ~$0.0028/hr (~$1.94/mo always-on). Fly Sprites sandbox (Jan 2026): $0.07/CPU-hr, $0.04375/GB-hr memory",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Fly account requires a payment card before Machines will run, so an agent cannot bootstrap alone. Once set up, tokens are fully programmatic via `fly tokens create` and the REST API needs only a Bearer token.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Go",
   "CLI"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST \"https://api.machines.dev/v1/apps/$FLY_APP/machines\" \\\n  -H \"Authorization: Bearer $FLY_API_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"config\":{\"image\":\"python:3.12-slim\",\"guest\":{\"cpu_kind\":\"shared\",\"cpus\":1,\"memory_mb\":256}}}'"
  },
  "tags": [
   "firecracker",
   "microvm",
   "rest-api",
   "sprites",
   "oci"
  ],
  "useCases": []
 },
 {
  "slug": "northflank",
  "name": "Northflank",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Developer platform with secure microVM sandboxes (Kata/gVisor) for multi-tenant AI code execution, self-serve BYOC across AWS/GCP/Azure and public pricing.",
  "blurb": "Developer platform with secure microVM sandboxes (Kata/gVisor) for multi-tenant AI code execution, self-serve BYOC across AWS/GCP/Azure and public pricing.",
  "website": "https://northflank.com",
  "docsUrl": "https://northflank.com/docs",
  "signupUrl": "https://app.northflank.com/signup",
  "pricingModel": "usage-based",
  "pricingNote": "CPU $0.01667/vCPU-hr, memory $0.00833/GB-hr; H100 GPU $2.74/hr all-in. Self-serve BYOC available (e.g. 200 sandboxes ~$2,060 on BYOC vs ~$7,200 PaaS)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at app.northflank.com; API token generated in dashboard. No account-creation API; token then drives the REST API/CLI programmatically.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "CLI",
   "JavaScript"
  ],
  "codeSample": null,
  "tags": [
   "microvm",
   "kata",
   "gvisor",
   "byoc",
   "gpu",
   "multi-tenant"
  ],
  "useCases": []
 },
 {
  "slug": "cloudflare-sandboxes",
  "name": "Cloudflare Sandboxes",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "GA (April 2026) container-backed sandboxes that give Workers-based agents a persistent isolated computer — exec, code interpreters, PTY terminals, backup/restore — on Cloudflare's edge.",
  "blurb": "GA (April 2026) container-backed sandboxes that give Workers-based agents a persistent isolated computer — exec, code interpreters, PTY terminals, backup/restore — on Cloudflare's edge.",
  "website": "https://www.cloudflare.com/products/sandboxes/",
  "docsUrl": "https://developers.cloudflare.com/sandbox/",
  "signupUrl": "https://dash.cloudflare.com/sign-up",
  "pricingModel": "usage-based",
  "pricingNote": "Active-CPU pricing: $0.00002 per vCPU-second (billed only for CPU actually used). Requires the Workers Paid plan ($5/mo minimum)",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "Cloudflare account is free but Containers/Sandboxes require the Workers Paid plan ($5/mo, card required), so an agent cannot self-provision from zero. API tokens for wrangler deploys are self-serve once the paid account exists.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "JavaScript"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { getSandbox } from \"@cloudflare/sandbox\";\n\nexport default {\n  async fetch(request: Request, env: Env) {\n    const sandbox = getSandbox(env.Sandbox, \"session-1\");\n    const result = await sandbox.exec('python3 -c \"print(40 + 2)\"');\n    return Response.json({ stdout: result.stdout, exitCode: result.exitCode });\n  },\n};"
  },
  "tags": [
   "edge",
   "containers",
   "code-interpreter",
   "pty",
   "workers",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "runloop",
  "name": "Runloop",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Enterprise-grade Devboxes for AI coding agents on a custom bare-metal hypervisor — ~100ms command exec, ~25ms resume-from-standby at zero idle cost.",
  "blurb": "Enterprise-grade Devboxes for AI coding agents on a custom bare-metal hypervisor — ~100ms command exec, ~25ms resume-from-standby at zero idle cost.",
  "website": "https://runloop.ai",
  "docsUrl": "https://docs.runloop.ai",
  "signupUrl": "https://platform.runloop.ai",
  "pricingModel": "freemium",
  "pricingNote": "Basic free subscription + usage; Pro $250/mo (suspend/resume, benchmarks). Usage: $0.108/CPU-hr, $0.0252/GB-hr memory. New accounts get $50 credits, no card",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup with $50 credits and full Pro features, no credit card required; RUNLOOP_API_KEY issued instantly. No signup API; key drives the REST/Python/TS SDKs.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "CLI"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import os\nfrom runloop_api_client import Runloop\n\nclient = Runloop(bearer_token=os.environ[\"RUNLOOP_API_KEY\"])\ndevbox = client.devboxes.create_and_await_running()\nresult = client.devboxes.execute_sync(devbox.id, command=\"echo 'hello'\")\nprint(result.stdout)"
  },
  "tags": [
   "devbox",
   "resume",
   "snapshots",
   "benchmarks",
   "coding-agents",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "blaxel",
  "name": "Blaxel",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Perpetual-sandbox agent runtime — spin up isolated sandboxes in milliseconds (resume ~25ms with memory intact), plus hosted agents, MCP servers, and batch jobs.",
  "blurb": "Perpetual-sandbox agent runtime — spin up isolated sandboxes in milliseconds (resume ~25ms with memory intact), plus hosted agents, MCP servers, and batch jobs.",
  "website": "https://blaxel.ai",
  "docsUrl": "https://docs.blaxel.ai",
  "signupUrl": "https://app.blaxel.ai",
  "pricingModel": "usage-based",
  "pricingNote": "Sandboxes runtime $0.0000115/GB-sec; Agents $0.0000095/GB-sec; standby snapshot storage $0.20/GB-mo. Up to $200 free credits, no card. Native provider in OpenAI Agents SDK v2",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup, up to $200 credits, no credit card; set BL_WORKSPACE + BL_API_KEY from dashboard. No account-creation API.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "Go"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { SandboxInstance } from \"@blaxel/core\";\n\nconst sandbox = await SandboxInstance.createIfNotExists({\n  name: \"my-sandbox\",\n  memory: 4096,\n});\nconst result = await sandbox.process.run({ command: \"echo\", args: [\"hello\"] });\nconsole.log(result.stdout);"
  },
  "tags": [
   "agent-runtime",
   "serverless",
   "snapshots",
   "mcp",
   "openai-agents-sdk"
  ],
  "useCases": []
 },
 {
  "slug": "codesandbox-sdk",
  "name": "CodeSandbox SDK",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Programmatic API over CodeSandbox's microVMs that lets agents create, run, hibernate, and instantly fork() a live VM (with memory snapshot) for parallel/A-B agent runs.",
  "blurb": "Programmatic API over CodeSandbox's microVMs that lets agents create, run, hibernate, and instantly fork() a live VM (with memory snapshot) for parallel/A-B agent runs.",
  "website": "https://codesandbox.io/sdk",
  "docsUrl": "https://codesandbox.io/docs/sdk",
  "signupUrl": "https://codesandbox.io/t/api",
  "pricingModel": "usage-based",
  "pricingNote": "VM credits pay-as-you-go at $0.01486/credit; free tier with $100 one-time credit; Pro $150/mo (24-hr sessions, configurable CPU/RAM)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Create an API key at codesandbox.io/t/api (enable all scopes), expose as CSB_API_KEY. Free signup, no card for the $100 credit tier. No signup API.",
  "mcpServer": "",
  "sdks": [
   "TypeScript"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { CodeSandbox } from \"@codesandbox/sdk\";\n\nconst sdk = new CodeSandbox(process.env.CSB_API_KEY);\nconst sandbox = await sdk.sandboxes.create();\nconst client = await sandbox.connect();\nconst output = await client.commands.run(\"echo 'Hello World'\");\nconsole.log(output);"
  },
  "tags": [
   "microvm",
   "fork",
   "hibernate",
   "memory-snapshot",
   "parallel-agents"
  ],
  "useCases": []
 },
 {
  "slug": "vercel-sandbox",
  "name": "Vercel Sandbox",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Ephemeral Firecracker microVMs for running untrusted/agent-generated code on Vercel — Node & Python runtimes, root access, persistent-by-default, millisecond starts.",
  "blurb": "Ephemeral Firecracker microVMs for running untrusted/agent-generated code on Vercel — Node & Python runtimes, root access, persistent-by-default, millisecond starts.",
  "website": "https://vercel.com/sandbox",
  "docsUrl": "https://vercel.com/docs/sandbox",
  "signupUrl": "https://vercel.com/signup",
  "pricingModel": "usage-based",
  "pricingNote": "Billed on Active CPU (only while CPU is used) + provisioned memory (per GB-hr, 2GB/vCPU) + per Sandbox.create() call + data transfer; 32GB ephemeral NVMe per sandbox",
  "authType": "oauth",
  "agentSignup": "oauth",
  "agentSignupNote": "Auth uses Vercel OIDC tokens tied to a Vercel project (auto in production, `vercel link`+`vercel env pull` locally) or account access tokens. A human sets up the Vercel project/token first; no standalone signup API.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "JavaScript",
   "Python",
   "CLI"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Sandbox } from \"@vercel/sandbox\";\n\nconst sandbox = await Sandbox.create();\nconst cmd = await sandbox.runCommand({ cmd: \"python3\", args: [\"-c\", \"print(40 + 2)\"] });\nconsole.log(await cmd.stdout());\nawait sandbox.stop();"
  },
  "tags": [
   "firecracker",
   "microvm",
   "oidc",
   "persistent",
   "nodejs",
   "python"
  ],
  "useCases": []
 },
 {
  "slug": "beam-cloud",
  "name": "Beam Cloud",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "On-demand serverless sandboxes (gVisor isolation) with GPU support, persistent snapshots, and an open-source core (beta9) you can self-host as BYOC.",
  "blurb": "On-demand serverless sandboxes (gVisor isolation) with GPU support, persistent snapshots, and an open-source core (beta9) you can self-host as BYOC.",
  "website": "https://www.beam.cloud",
  "docsUrl": "https://docs.beam.cloud/v2/sandbox/overview",
  "signupUrl": "https://platform.beam.cloud",
  "pricingModel": "usage-based",
  "pricingNote": "CPU $0.0000528/core/s ($0.19/hr), RAM $0.0000056/GB/s ($0.02/hr), storage free; H100 $3.50/hr. $30/mo free credits refreshed monthly, no required subscription. Open-source core",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup includes $30/mo credits, no card; API token from dashboard. Scale-to-zero, no billing during image pulls/queue. No account-creation API.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "CLI"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from beam import Image, Sandbox\n\nsb = Sandbox(image=Image(python_version=\"python3.11\")).create()\nsb.process.run_code(\"print('Hello from sandbox!')\")\nsb.terminate()"
  },
  "tags": [
   "gvisor",
   "gpu",
   "open-source",
   "snapshots",
   "scale-to-zero",
   "byoc"
  ],
  "useCases": []
 },
 {
  "slug": "morph-cloud",
  "name": "Morph Cloud",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Sandbox VMs built around Infinibranch — snapshot, branch, and restore an entire running environment (files + processes + memory) in under 250ms for parallel agent forks.",
  "blurb": "Sandbox VMs built around Infinibranch — snapshot, branch, and restore an entire running environment (files + processes + memory) in under 250ms for parallel agent forks.",
  "website": "https://cloud.morph.so",
  "docsUrl": "https://cloud.morph.so/docs/developers",
  "signupUrl": "https://cloud.morph.so",
  "pricingModel": "usage-based",
  "pricingNote": "Usage-based (self-hosted or Morph Cloud); Infinibranch snapshot/branch/restore in <250ms with cached setup steps. Free credits on signup",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at cloud.morph.so; MORPH_API_KEY from dashboard. No account-creation API; key drives the Python/TS SDKs.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from morphcloud.api import MorphCloudClient\n\nclient = MorphCloudClient()  # reads MORPH_API_KEY\nsnapshot = client.snapshots.create(image_id=\"morphvm-minimal\", vcpus=1, memory=1024, disk_size=10000)\ninstance = client.instances.start(snapshot_id=snapshot.id)\nresult = instance.exec(command=\"echo hello\")\nprint(result.stdout)\n\n# fork the live environment into 3 parallel clones\nsnap, clones = instance.branch(count=3)"
  },
  "tags": [
   "snapshot",
   "branch",
   "infinibranch",
   "fork",
   "vm"
  ],
  "useCases": []
 },
 {
  "slug": "freestyle",
  "name": "Freestyle",
  "category": "sandboxes-runtime",
  "kind": "api",
  "oneLiner": "Full Linux VMs plus Git for code your AI writes — serverless Runs bill per millisecond of execution and support external npm modules and env vars for agent code.",
  "blurb": "Full Linux VMs plus Git for code your AI writes — serverless Runs bill per millisecond of execution and support external npm modules and env vars for agent code.",
  "website": "https://www.freestyle.sh",
  "docsUrl": "https://docs.freestyle.sh",
  "signupUrl": "https://dash.freestyle.sh",
  "pricingModel": "freemium",
  "pricingNote": "Free to start, no credit card; serverless Runs billed only for actual milliseconds of execution; persistent VMs & snapshots require Hobby plan or higher",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Sign up at dash.freestyle.sh and create a key (FREESTYLE_API_KEY), no card to start. No account-creation API.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { FreestyleSandboxes } from \"freestyle-sandboxes\";\n\nconst api = new FreestyleSandboxes({ apiKey: process.env.FREESTYLE_API_KEY });\nconst res = await api.executeScript(\"export default () => 40 + 2\");\nconsole.log(res.result);"
  },
  "tags": [
   "vm",
   "git",
   "code-execution",
   "app-builder",
   "serverless"
  ],
  "useCases": []
 },
 {
  "slug": "cursor",
  "name": "Cursor",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "AI code editor whose agent is now scriptable via a headless CLI, TypeScript SDK, and cloud Background Agents for developers and CI.",
  "blurb": "AI code editor whose agent is now scriptable via a headless CLI, TypeScript SDK, and cloud Background Agents for developers and CI.",
  "website": "https://cursor.com",
  "docsUrl": "https://cursor.com/docs/cli/overview",
  "signupUrl": "https://cursor.com/dashboard",
  "pricingModel": "freemium",
  "pricingNote": "Free Hobby; Pro $20/mo, Pro+ $60, Ultra $200, Teams $40/user/mo. SDK/agent runs billed on token usage.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "API key generated from the web dashboard; SDK and Background Agents require a paid plan, so a human must sign up and pay first.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "CLI",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "# install: curl https://cursor.com/install -fsS | bash\ncursor-agent -p \"fix the failing tests in this repo\" --output-format text"
  },
  "tags": [
   "ide",
   "coding-agent",
   "cli",
   "background-agents"
  ],
  "useCases": []
 },
 {
  "slug": "devin",
  "name": "Devin (Cognition)",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Autonomous software-engineer agent that runs long-horizon tasks in its own cloud VM and is triggerable via a REST API from CI, hooks, or cron.",
  "blurb": "Autonomous software-engineer agent that runs long-horizon tasks in its own cloud VM and is triggerable via a REST API from CI, hooks, or cron.",
  "website": "https://devin.ai",
  "docsUrl": "https://docs.devin.ai/api-reference/overview",
  "signupUrl": "https://app.devin.ai",
  "pricingModel": "freemium",
  "pricingNote": "Core from $20/mo with pay-as-you-go ACUs (~$2.25 each ≈ 15 min of work); API access on Core/Team+.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Bearer API key from app settings, but a human must create and pay for a Core/Team plan before the key works.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "curl -X POST https://api.devin.ai/v1/sessions \\\n  -H \"Authorization: Bearer $DEVIN_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"prompt\": \"Review the PR at https://github.com/acme/app/pull/123\", \"idempotent\": true}'"
  },
  "tags": [
   "autonomous-agent",
   "swe-agent",
   "rest-api",
   "ci"
  ],
  "useCases": []
 },
 {
  "slug": "cline",
  "name": "Cline",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Open-source autonomous coding agent (VS Code/JetBrains extension, CLI, and SDK) that runs on any LLM you plug in — fully BYOK.",
  "blurb": "Open-source autonomous coding agent (VS Code/JetBrains extension, CLI, and SDK) that runs on any LLM you plug in — fully BYOK.",
  "website": "https://cline.bot",
  "docsUrl": "https://docs.cline.bot",
  "signupUrl": "https://cline.bot",
  "pricingModel": "open-source",
  "pricingNote": "Free & open-source; you pay only your own LLM provider. Optional Cline cloud/enterprise (SSO, SCIM, audit logs) is paid.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "No Cline account needed — it's BYOK: supply your own Anthropic/OpenAI/Bedrock/etc. key. Cline cloud credits do require a human signup.",
  "mcpServer": "",
  "sdks": [
   "SDK",
   "CLI",
   "VS Code",
   "JetBrains"
  ],
  "codeSample": null,
  "tags": [
   "open-source",
   "byok",
   "coding-agent",
   "mcp-client"
  ],
  "useCases": []
 },
 {
  "slug": "aider",
  "name": "Aider",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Open-source terminal pair-programmer that edits your local git repo with AI — not hosted; you bring your own model key.",
  "blurb": "Open-source terminal pair-programmer that edits your local git repo with AI — not hosted; you bring your own model key.",
  "website": "https://aider.chat",
  "docsUrl": "https://aider.chat/docs/",
  "signupUrl": "",
  "pricingModel": "open-source",
  "pricingNote": "Free & open-source CLI; cost is only your LLM provider's API usage. No hosted/managed Aider service.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Local CLI with no vendor account or API of its own; needs your own OpenAI/Anthropic/etc. key set as an env var.",
  "mcpServer": "",
  "sdks": [
   "CLI",
   "Python"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "python -m pip install aider-chat\nexport ANTHROPIC_API_KEY=sk-...\naider --model sonnet   # starts an AI pair-programming session in your repo"
  },
  "tags": [
   "open-source",
   "cli",
   "byok",
   "git"
  ],
  "useCases": []
 },
 {
  "slug": "codegen",
  "name": "Codegen",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Cloud coding agents you run at scale via a Python SDK/REST API, wired into GitHub, Slack, and Linear to open PRs autonomously.",
  "blurb": "Cloud coding agents you run at scale via a Python SDK/REST API, wired into GitHub, Slack, and Linear to open PRs autonomously.",
  "website": "https://codegen.com",
  "docsUrl": "https://docs.codegen.com",
  "signupUrl": "https://codegen.com/token",
  "pricingModel": "freemium",
  "pricingNote": "Individual and Teams plans; Teams ~$150/mo usage cap; BYOK to bypass model limits. 30-day money-back on paid plans.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Org ID + API token are self-serve at codegen.com/token after signup; drive agents from the Python SDK or REST.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from codegen.agents.agent import Agent\n\nagent = Agent(org_id=\"YOUR_ORG_ID\", token=\"YOUR_API_TOKEN\")\ntask = agent.run(prompt=\"Implement a feature to sort users by last login.\")\n\ntask.refresh()\nif task.status == \"completed\":\n    print(task.result)"
  },
  "tags": [
   "cloud-agent",
   "python-sdk",
   "github",
   "pr-automation"
  ],
  "useCases": []
 },
 {
  "slug": "amp",
  "name": "Amp (Sourcegraph)",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Sourcegraph's agentic coding tool with a headless CLI and streaming-JSON output for automation — pay-as-you-go with no markup.",
  "blurb": "Sourcegraph's agentic coding tool with a headless CLI and streaming-JSON output for automation — pay-as-you-go with no markup.",
  "website": "https://ampcode.com",
  "docsUrl": "https://ampcode.com/manual",
  "signupUrl": "https://ampcode.com/settings",
  "pricingModel": "usage-based",
  "pricingNote": "Pay-as-you-go, no markup for individuals, free credits to start. (Sourcegraph's older Cody is enterprise-only at $59/user/mo.)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "AMP_API_KEY self-serve from ampcode.com/settings; run headless with `amp -x \"…\" --stream-json` in CI/scripts.",
  "mcpServer": "",
  "sdks": [
   "CLI",
   "VS Code",
   "JSON-stream"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "export AMP_API_KEY=\"your-key\"   # from ampcode.com/settings\namp -x \"fix all the eslint errors and commit\" --stream-json"
  },
  "tags": [
   "coding-agent",
   "cli",
   "sourcegraph",
   "automation"
  ],
  "useCases": []
 },
 {
  "slug": "replit-agent",
  "name": "Replit Agent",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Browser-based agent that builds, runs, and deploys full apps end-to-end inside Replit's cloud IDE for non-technical builders.",
  "blurb": "Browser-based agent that builds, runs, and deploys full apps end-to-end inside Replit's cloud IDE for non-technical builders.",
  "website": "https://replit.com",
  "docsUrl": "https://docs.replit.com",
  "signupUrl": "https://replit.com/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free (public repls); Core $25/mo includes $25 AI credits; effort-based Agent billing (simple edits <$0.25/checkpoint).",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "No public API to trigger Agent runs; it's an interactive browser product requiring a human account and credits.",
  "mcpServer": "",
  "sdks": [
   "Web"
  ],
  "codeSample": null,
  "tags": [
   "app-builder",
   "cloud-ide",
   "no-code",
   "deploy"
  ],
  "useCases": []
 },
 {
  "slug": "v0",
  "name": "v0 by Vercel",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Vercel's generative UI/app agent with a real Platform API (TypeScript SDK + REST) to create chats and generate React/frontend code programmatically.",
  "blurb": "Vercel's generative UI/app agent with a real Platform API (TypeScript SDK + REST) to create chats and generate React/frontend code programmatically.",
  "website": "https://v0.app",
  "docsUrl": "https://v0.app/docs/api/platform/overview",
  "signupUrl": "https://v0.app/chat/settings/keys",
  "pricingModel": "freemium",
  "pricingNote": "Free with $5 credits; Team $30/user, Business $100/user, Enterprise custom. Platform API billed on Mini/Pro/Max model tokens.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "V0_API_KEY self-serve from settings; free tier grants $5 credits so an agent can start generating immediately.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { v0 } from 'v0-sdk' // npm i v0-sdk; set V0_API_KEY\n\nconst chat = await v0.chats.create({\n  message: 'Build a pricing page with three tiers',\n})\nconsole.log(chat.demo) // preview URL of the generated app"
  },
  "tags": [
   "ui-generation",
   "frontend",
   "platform-api",
   "vercel"
  ],
  "useCases": []
 },
 {
  "slug": "lovable",
  "name": "Lovable",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "AI app builder that ships full-stack products from chat, with backend/auth/DB — popular with non-technical founders.",
  "blurb": "AI app builder that ships full-stack products from chat, with backend/auth/DB — popular with non-technical founders.",
  "website": "https://lovable.dev",
  "docsUrl": "https://docs.lovable.dev",
  "signupUrl": "https://lovable.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free (5 daily build credits); Pro $25/mo (100 credits), Business $50/mo. Cloud (DB/bandwidth) and in-app AI billed separately by usage.",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "Chat/UI-driven builder with no public API to generate apps programmatically; a human creates the account (SSO on Business).",
  "mcpServer": "",
  "sdks": [
   "Web"
  ],
  "codeSample": null,
  "tags": [
   "app-builder",
   "full-stack",
   "no-code",
   "founders"
  ],
  "useCases": []
 },
 {
  "slug": "bolt-new",
  "name": "Bolt.new",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "StackBlitz's in-browser agent that prompts, runs, edits, and deploys full-stack apps using WebContainers — no local setup.",
  "blurb": "StackBlitz's in-browser agent that prompts, runs, edits, and deploys full-stack apps using WebContainers — no local setup.",
  "website": "https://bolt.new",
  "docsUrl": "https://support.bolt.new",
  "signupUrl": "https://bolt.new",
  "pricingModel": "freemium",
  "pricingNote": "Free 1M tokens/mo (300K/day); Pro $25/mo (10M tokens); Teams $30/member; Enterprise custom.",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "No public build API for the Bolt agent itself; a human signs up. (StackBlitz's WebContainer API is a separate, embeddable product.)",
  "mcpServer": "",
  "sdks": [
   "Web"
  ],
  "codeSample": null,
  "tags": [
   "app-builder",
   "webcontainers",
   "stackblitz",
   "deploy"
  ],
  "useCases": []
 },
 {
  "slug": "factory-droid",
  "name": "Factory (Droid)",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Agent-native dev platform whose Droids run in managed cloud sandboxes; a headless `droid exec` CLI drops them into CI and scripts.",
  "blurb": "Agent-native dev platform whose Droids run in managed cloud sandboxes; a headless `droid exec` CLI drops them into CI and scripts.",
  "website": "https://factory.ai",
  "docsUrl": "https://docs.factory.ai/cli/droid-exec/overview",
  "signupUrl": "https://app.factory.ai",
  "pricingModel": "paid",
  "pricingNote": "No free tier; Pro $20/mo, Plus $100, Max $200; usage-sensitive with pay-as-you-go extra credits ($10 min). Cloud sandboxes on Plus+.",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "Headless `droid exec` is great for automation, but there's no free tier — a human must create a paid account first.",
  "mcpServer": "",
  "sdks": [
   "CLI"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "droid exec --auto low \"Audit for sync child_process usage and write fixes to sec-audit.md\""
  },
  "tags": [
   "swe-agent",
   "cli",
   "cloud-sandbox",
   "ci"
  ],
  "useCases": []
 },
 {
  "slug": "jules",
  "name": "Jules (Google)",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Google's async coding agent that works on your GitHub repo in a cloud VM, now with an alpha REST API for programmatic sessions.",
  "blurb": "Google's async coding agent that works on your GitHub repo in a cloud VM, now with an alpha REST API for programmatic sessions.",
  "website": "https://jules.google",
  "docsUrl": "https://jules.google/docs",
  "signupUrl": "https://jules.google",
  "pricingModel": "freemium",
  "pricingNote": "Free intro plan (15 tasks/day); bundled into Google AI Pro $19.99/mo (100/day) and Ultra $124.99/mo (300/day).",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "REST API in alpha at jules.googleapis.com/v1alpha; X-Goog-Api-Key keys are self-serve in Jules web Settings (max 3). Google account (OAuth) to sign up.",
  "mcpServer": "",
  "sdks": [
   "REST",
   "Web"
  ],
  "codeSample": null,
  "tags": [
   "async-agent",
   "github",
   "rest-api",
   "google"
  ],
  "useCases": []
 },
 {
  "slug": "openai-codex",
  "name": "OpenAI Codex",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "OpenAI's coding agent across CLI, IDE, and cloud; `codex exec` runs headless and the gpt-5-codex models are callable via the OpenAI API.",
  "blurb": "OpenAI's coding agent across CLI, IDE, and cloud; `codex exec` runs headless and the gpt-5-codex models are callable via the OpenAI API.",
  "website": "https://openai.com/codex",
  "docsUrl": "https://developers.openai.com/codex",
  "signupUrl": "https://platform.openai.com/api-keys",
  "pricingModel": "freemium",
  "pricingNote": "Included in every ChatGPT plan (Free/Plus $20/Pro $100+); API: gpt-5.x-codex ~$1.75/1M input, $14/1M output tokens.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "OPENAI_API_KEY is self-serve at platform.openai.com (billing required); the Codex CLI also supports ChatGPT sign-in (OAuth).",
  "mcpServer": "",
  "sdks": [
   "CLI",
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "bash",
   "code": "npm i -g @openai/codex\ncodex exec \"add unit tests for the auth module\"   # OPENAI_API_KEY or ChatGPT sign-in"
  },
  "tags": [
   "coding-agent",
   "cli",
   "cloud-agent",
   "openai"
  ],
  "useCases": []
 },
 {
  "slug": "windsurf",
  "name": "Windsurf",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Agentic IDE (formerly Codeium) whose Cascade agent does multi-file, codebase-aware autonomous edits.",
  "blurb": "Agentic IDE (formerly Codeium) whose Cascade agent does multi-file, codebase-aware autonomous edits.",
  "website": "https://windsurf.com",
  "docsUrl": "https://docs.windsurf.com",
  "signupUrl": "https://windsurf.com",
  "pricingModel": "freemium",
  "pricingNote": "Free; Pro $20/mo, Max $200, Teams $40/seat. March 2026 moved to daily/weekly quotas; overages billed at API pricing.",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "Editor-bound Cascade agent with no public API to trigger runs externally; requires a human account/subscription.",
  "mcpServer": "",
  "sdks": [
   "IDE",
   "Plugins"
  ],
  "codeSample": null,
  "tags": [
   "ide",
   "cascade",
   "coding-agent",
   "codeium"
  ],
  "useCases": []
 },
 {
  "slug": "warp",
  "name": "Warp",
  "category": "coding-agents-devtools",
  "kind": "api",
  "oneLiner": "Agentic terminal that runs multi-agent coding/debugging workflows from natural language, with BYOK model support on every plan.",
  "blurb": "Agentic terminal that runs multi-agent coding/debugging workflows from natural language, with BYOK model support on every plan.",
  "website": "https://warp.dev",
  "docsUrl": "https://docs.warp.dev",
  "signupUrl": "https://app.warp.dev/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free (150 credits/mo, then 75); Build $20/user (1,500 credits); Business $50/user. BYOK on all plans (own OpenAI/Anthropic/Google key).",
  "authType": "account",
  "agentSignup": "manual-only",
  "agentSignupNote": "Terminal app requiring a human account; a Warp API exists for paid users (1000 req/min) but the app is not self-provisionable by an agent.",
  "mcpServer": "",
  "sdks": [
   "Terminal",
   "API"
  ],
  "codeSample": null,
  "tags": [
   "terminal",
   "agentic",
   "byok",
   "multi-agent"
  ],
  "useCases": []
 },
 {
  "slug": "temporal-cloud",
  "name": "Temporal Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Fully managed durable-execution platform where you write Workflows as ordinary code that survive crashes, retries, and multi-day sleeps.",
  "blurb": "Fully managed durable-execution platform where you write Workflows as ordinary code that survive crashes, retries, and multi-day sleeps.",
  "website": "https://temporal.io",
  "docsUrl": "https://docs.temporal.io/cloud",
  "signupUrl": "https://cloud.temporal.io",
  "pricingModel": "usage-based",
  "pricingNote": "Essentials from the greater of $100/mo or 5% of consumption; ~$50 per million Actions; $1,000 free credits to start",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "A human creates the Cloud account (free trial, no CC). After that the open-source Cloud Ops API (HTTP + gRPC), tcld CLI, and Terraform provider programmatically create namespaces, service accounts, and API keys — so agents can self-provision infra.",
  "mcpServer": "",
  "sdks": [
   "Go",
   "Java",
   "TypeScript",
   "Python",
   ".NET",
   "PHP",
   "Ruby"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Client } from \"@temporalio/client\";\n\n// Reads TEMPORAL_ADDRESS + API key (or mTLS) from env\nconst client = new Client();\n\nconst handle = await client.workflow.start(myWorkflow, {\n  taskQueue: \"orders\",\n  workflowId: \"order-123\",\n  args: [{ orderId: \"123\" }],\n});\n\nconsole.log(await handle.result());"
  },
  "tags": [
   "durable-execution",
   "workflows",
   "managed",
   "saga",
   "long-running"
  ],
  "useCases": []
 },
 {
  "slug": "inngest",
  "name": "Inngest",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Event-driven durable functions and AI workflows for TypeScript/Python/Go — steps, retries, sleeps, and flow control with zero queues to run.",
  "blurb": "Event-driven durable functions and AI workflows for TypeScript/Python/Go — steps, retries, sleeps, and flow control with zero queues to run.",
  "website": "https://www.inngest.com",
  "docsUrl": "https://www.inngest.com/docs",
  "signupUrl": "https://app.inngest.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Free tier ~50K executions/mo, 3 users; paid from ~$75/mo, usage-based",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free account (email/GitHub, no CC) issues an Event Key + Signing Key instantly from the dashboard.",
  "mcpServer": "https://www.inngest.com/docs/ai-dev-tools/mcp",
  "sdks": [
   "TypeScript",
   "Python",
   "Go"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Inngest } from \"inngest\";\n\nconst inngest = new Inngest({ id: \"my-app\" });\n\nexport const importData = inngest.createFunction(\n  { id: \"import-data\" },\n  { event: \"app/data.import\" },\n  async ({ event, step }) => {\n    const user = await step.run(\"load-user\", () => loadUser(event.data.userId));\n    await step.sleep(\"cool-down\", \"1h\");\n    return { userId: user.id };\n  },\n);"
  },
  "tags": [
   "durable-execution",
   "event-driven",
   "background-jobs",
   "ai-workflows",
   "steps"
  ],
  "useCases": []
 },
 {
  "slug": "trigger-dev",
  "name": "Trigger.dev",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Open-source TypeScript platform for long-running background tasks and AI agents with retries, queues, concurrency, and observability, fully managed in the cloud.",
  "blurb": "Open-source TypeScript platform for long-running background tasks and AI agents with retries, queues, concurrency, and observability, fully managed in the cloud.",
  "website": "https://trigger.dev",
  "docsUrl": "https://trigger.dev/docs",
  "signupUrl": "https://cloud.trigger.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free 10K runs/mo (14-day history); Pro $50/mo (250K runs); Team $200/mo (1M runs)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free account + a new project generates dev and prod API keys instantly, no CC.",
  "mcpServer": "",
  "sdks": [
   "TypeScript"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { task } from \"@trigger.dev/sdk/v3\";\n\nexport const helloWorld = task({\n  id: \"hello-world\",\n  run: async (payload: { name: string }) => {\n    return { greeting: `Hello ${payload.name}` };\n  },\n});"
  },
  "tags": [
   "background-jobs",
   "typescript",
   "ai-agents",
   "long-running",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "hatchet",
  "name": "Hatchet",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Postgres-backed orchestration engine for background tasks, AI agents, and durable workflows — a high-throughput task queue with retries, DAGs, and real-time monitoring.",
  "blurb": "Postgres-backed orchestration engine for background tasks, AI agents, and durable workflows — a high-throughput task queue with retries, DAGs, and real-time monitoring.",
  "website": "https://hatchet.run",
  "docsUrl": "https://docs.hatchet.run",
  "signupUrl": "https://hatchet.run/pricing",
  "pricingModel": "freemium",
  "pricingNote": "Free Developer tier (no CC); Team $500/mo; Scale $1,000/mo; Enterprise custom",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve Developer tier requires no credit card; the dashboard issues an API token that workers use to connect.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from pydantic import BaseModel\nfrom hatchet_sdk import Hatchet\n\nhatchet = Hatchet()\n\nclass Input(BaseModel):\n    name: str\n\nworkflow = hatchet.workflow(\"greet\", input_type=Input)\n\n@workflow.task()\ndef greet(input: Input, ctx):\n    return {\"message\": f\"Hello, {input.name}!\"}"
  },
  "tags": [
   "task-queue",
   "durable-execution",
   "ai-agents",
   "dags",
   "open-source"
  ],
  "useCases": []
 },
 {
  "slug": "restate",
  "name": "Restate",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Durable-execution runtime for resilient services, workflows, and AI agents — durable RPC, virtual objects, and state, deployable on serverless (Cloudflare/Vercel/Deno) or as managed Restate Cloud.",
  "blurb": "Durable-execution runtime for resilient services, workflows, and AI agents — durable RPC, virtual objects, and state, deployable on serverless (Cloudflare/Vercel/Deno) or as managed Restate Cloud.",
  "website": "https://www.restate.dev",
  "docsUrl": "https://docs.restate.dev",
  "signupUrl": "https://cloud.restate.dev",
  "pricingModel": "usage-based",
  "pricingNote": "Restate Cloud free to start; usage-based on durable actions",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free public signup via GitHub or Google (no CC) creates an environment plus API key in a few clicks.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Java",
   "Kotlin",
   "Python",
   "Go",
   "Rust"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import * as restate from \"@restatedev/restate-sdk\";\n\nconst greeter = restate.service({\n  name: \"Greeter\",\n  handlers: {\n    greet: async (ctx: restate.Context, name: string) => {\n      // durable step; result is journaled and survives crashes/retries\n      const id = await ctx.run(\"gen-id\", () => crypto.randomUUID());\n      return `Hello ${name} (${id})`;\n    },\n  },\n});\n\nrestate.endpoint().bind(greeter).listen(9080);"
  },
  "tags": [
   "durable-execution",
   "serverless",
   "ai-agents",
   "virtual-objects",
   "workflows"
  ],
  "useCases": []
 },
 {
  "slug": "langgraph-platform",
  "name": "LangGraph Platform (LangSmith Deployment)",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Managed deployment and orchestration for stateful LangGraph agents — persistence, human-in-the-loop, streaming, and horizontal scaling for production AI agents.",
  "blurb": "Managed deployment and orchestration for stateful LangGraph agents — persistence, human-in-the-loop, streaming, and horizontal scaling for production AI agents.",
  "website": "https://www.langchain.com/langgraph",
  "docsUrl": "https://docs.langchain.com/langsmith/deployment",
  "signupUrl": "https://smith.langchain.com",
  "pricingModel": "freemium",
  "pricingNote": "Free Developer plan (no CC); managed cloud deploys need Plus ($39/user/mo), then $0.005/run + $0.0036/min prod uptime",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Developer account at smith.langchain.com issues a LangSmith API key instantly (no CC); a managed cloud deployment requires upgrading to Plus.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from typing import TypedDict\nfrom langgraph.graph import StateGraph, START, END\n\nclass State(TypedDict):\n    messages: list\n\nbuilder = StateGraph(State)\nbuilder.add_node(\"agent\", call_model)\nbuilder.add_edge(START, \"agent\")\nbuilder.add_edge(\"agent\", END)\ngraph = builder.compile()  # deploy this graph to LangSmith Deployment"
  },
  "tags": [
   "ai-agents",
   "langgraph",
   "stateful",
   "human-in-the-loop",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "windmill",
  "name": "Windmill",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Open-source developer platform that turns scripts (TS/Python/Go/Bash/SQL) into workflows, webhooks, and internal UIs — a fast workflow engine and Retool/Temporal alternative.",
  "blurb": "Open-source developer platform that turns scripts (TS/Python/Go/Bash/SQL) into workflows, webhooks, and internal UIs — a fast workflow engine and Retool/Temporal alternative.",
  "website": "https://www.windmill.dev",
  "docsUrl": "https://www.windmill.dev/docs",
  "signupUrl": "https://app.windmill.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free cloud (1,000 executions/day); Team $10/seat/mo (unlimited); self-hosted Community Edition free & unlimited",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free cloud workspace signup; generate API tokens in the UI. Self-hosted OSS is also free and unlimited.",
  "mcpServer": "",
  "sdks": [
   "TypeScript",
   "Python",
   "Go",
   "PHP",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "# A Windmill script: `main` is the entrypoint.\n# Params become an auto-generated UI and a callable webhook/API.\ndef main(name: str = \"world\"):\n    return {\"greeting\": f\"hello {name}\"}"
  },
  "tags": [
   "workflow-engine",
   "scripts",
   "internal-tools",
   "open-source",
   "self-hostable"
  ],
  "useCases": []
 },
 {
  "slug": "n8n-cloud",
  "name": "n8n Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Managed hosting for n8n, the fair-code visual workflow automation and AI-agent builder with 400+ integrations, native AI/LangChain nodes, and an MCP server.",
  "blurb": "Managed hosting for n8n, the fair-code visual workflow automation and AI-agent builder with 400+ integrations, native AI/LangChain nodes, and an MCP server.",
  "website": "https://n8n.io",
  "docsUrl": "https://docs.n8n.io",
  "signupUrl": "https://app.n8n.cloud/register",
  "pricingModel": "freemium",
  "pricingNote": "Cloud: 14-day trial then Starter $20/mo, Pro $50/mo (billed per full-workflow execution); self-hosted Community Edition is free & unlimited",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "n8n Cloud has no free tier — needs a human trial/paid signup; the instance REST API key is created in-app. Self-hosted is free and can be driven end-to-end via its native MCP server.",
  "mcpServer": "https://docs.n8n.io/advanced-ai/mcp/",
  "sdks": [
   "REST"
  ],
  "codeSample": null,
  "tags": [
   "workflow-automation",
   "no-code",
   "ai-agents",
   "integrations",
   "mcp"
  ],
  "useCases": []
 },
 {
  "slug": "dbos",
  "name": "DBOS Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Postgres-backed durable execution as a library — annotate ordinary Python/TS/Go/Java code with decorators to get exactly-once workflows, queues, and recovery, hosted serverlessly on DBOS Cloud.",
  "blurb": "Postgres-backed durable execution as a library — annotate ordinary Python/TS/Go/Java code with decorators to get exactly-once workflows, queues, and recovery, hosted serverlessly on DBOS Cloud.",
  "website": "https://www.dbos.dev",
  "docsUrl": "https://docs.dbos.dev",
  "signupUrl": "https://console.dbos.dev",
  "pricingModel": "freemium",
  "pricingNote": "Free tier (no CC); Pro paid tier; startups get 6 months free Pro (~$600 value)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free DBOS Cloud signup (GitHub/Google, no CC); CLI/cloud API keys issued for deploys and Conductor monitoring.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "Go",
   "Java"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from dbos import DBOS\n\nDBOS()\n\n@DBOS.step()\ndef charge_card(order_id: str):\n    ...\n\n@DBOS.workflow()\ndef checkout(order_id: str):\n    charge_card(order_id)   # durable, recovers exactly-once on crash/retry\n    return \"done\""
  },
  "tags": [
   "durable-execution",
   "postgres",
   "library",
   "exactly-once",
   "serverless"
  ],
  "useCases": []
 },
 {
  "slug": "prefect-cloud",
  "name": "Prefect Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Python-native workflow orchestration for data, ML, and agents — turn functions into observable, retryable flows with scheduling, and a managed control plane plus MCP gateway.",
  "blurb": "Python-native workflow orchestration for data, ML, and agents — turn functions into observable, retryable flows with scheduling, and a managed control plane plus MCP gateway.",
  "website": "https://www.prefect.io",
  "docsUrl": "https://docs.prefect.io",
  "signupUrl": "https://app.prefect.cloud",
  "pricingModel": "freemium",
  "pricingNote": "Free Hobby tier (2 users, 5 workflows); Starter $100/mo; Pro ~$500/mo; seat-based, no per-task charges",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Hobby account creates an API key instantly; service accounts (paid tiers) give non-human tokens for CI/CD automation.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from prefect import flow, task\n\n@task(retries=3)\ndef extract():\n    return [1, 2, 3]\n\n@flow\ndef pipeline():\n    return sum(extract())\n\nif __name__ == \"__main__\":\n    pipeline()"
  },
  "tags": [
   "orchestration",
   "python",
   "data-pipelines",
   "ml",
   "scheduling"
  ],
  "useCases": []
 },
 {
  "slug": "orkes-conductor",
  "name": "Orkes Conductor",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Managed, enterprise Netflix Conductor — a distributed orchestration platform for microservices, workflows, and AI agents with a visual builder and multi-language SDKs.",
  "blurb": "Managed, enterprise Netflix Conductor — a distributed orchestration platform for microservices, workflows, and AI agents with a visual builder and multi-language SDKs.",
  "website": "https://orkes.io",
  "docsUrl": "https://orkes.io/content",
  "signupUrl": "https://orkes.io/get-started",
  "pricingModel": "freemium",
  "pricingNote": "Free managed Developer Playground; production Cloud clusters are subscription-based (by API calls/tasks/workflows)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Developer Playground signup; create an Application to get a key/secret pair. Dedicated production clusters are paid.",
  "mcpServer": "",
  "sdks": [
   "Java",
   "Python",
   "JavaScript",
   "Go",
   "C#",
   "Clojure"
  ],
  "codeSample": null,
  "tags": [
   "orchestration",
   "conductor",
   "microservices",
   "ai-agents",
   "enterprise"
  ],
  "useCases": []
 },
 {
  "slug": "cloudflare-workflows",
  "name": "Cloudflare Workflows",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Serverless durable-execution engine on Cloudflare Workers for long-running, multi-step apps and AI agents — steps persist across failures, sleeps, and retries at the edge.",
  "blurb": "Serverless durable-execution engine on Cloudflare Workers for long-running, multi-step apps and AI agents — steps persist across failures, sleeps, and retries at the edge.",
  "website": "https://developers.cloudflare.com/workflows/",
  "docsUrl": "https://developers.cloudflare.com/workflows/",
  "signupUrl": "https://dash.cloudflare.com/sign-up",
  "pricingModel": "freemium",
  "pricingNote": "Included in Workers Free & Paid ($5/mo base); per-step & storage billing starts no earlier than Aug 10, 2026",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Cloudflare account (email). The Cloudflare API + Wrangler CLI provision Workers/Workflows and can mint scoped API tokens programmatically.",
  "mcpServer": "https://github.com/cloudflare/mcp-server-cloudflare",
  "sdks": [
   "TypeScript",
   "JavaScript",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from \"cloudflare:workers\";\n\nexport class MyWorkflow extends WorkflowEntrypoint<Env, Params> {\n  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {\n    const data = await step.do(\"fetch data\", async () => {\n      return await fetch(\"https://api.example.com\").then((r) => r.json());\n    });\n    await step.sleep(\"wait\", \"1 hour\");\n    return data;\n  }\n}"
  },
  "tags": [
   "durable-execution",
   "edge",
   "serverless",
   "workers",
   "ai-agents"
  ],
  "useCases": []
 },
 {
  "slug": "pipedream",
  "name": "Pipedream (Workflows + Connect)",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Workflow automation plus Connect — SDKs/APIs that let your app or AI agent add 2,500+ integrations and provision end-user account connections and OAuth tokens programmatically.",
  "blurb": "Workflow automation plus Connect — SDKs/APIs that let your app or AI agent add 2,500+ integrations and provision end-user account connections and OAuth tokens programmatically.",
  "website": "https://pipedream.com",
  "docsUrl": "https://pipedream.com/docs",
  "signupUrl": "https://pipedream.com/auth/signup",
  "pricingModel": "freemium",
  "pricingNote": "Free 100 credits/mo, 3 workflows, 3 connected accounts; paid lifts limits; Connect priced by API usage + end users",
  "authType": "api-key",
  "agentSignup": "programmatic-api",
  "agentSignupNote": "Free account (human) yields platform API credentials; Connect's SDK/API then lets an agent provision end-user OAuth connections and short-lived tokens with no dashboard — purpose-built for agents. (Note: Workday acquisition announced Nov 2025.)",
  "mcpServer": "https://mcp.pipedream.com",
  "sdks": [
   "TypeScript",
   "Python",
   "REST"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { createBackendClient } from \"@pipedream/sdk/server\";\n\nconst pd = createBackendClient({\n  environment: \"production\",\n  projectId: process.env.PD_PROJECT_ID!,\n  credentials: {\n    clientId: process.env.PD_CLIENT_ID!,\n    clientSecret: process.env.PD_CLIENT_SECRET!,\n  },\n});\n\n// Agent provisions an end-user account connection programmatically\nconst { token } = await pd.createConnectToken({ external_user_id: \"user-123\" });"
  },
  "tags": [
   "workflow-automation",
   "integrations",
   "connect",
   "oauth-broker",
   "ai-agents"
  ],
  "useCases": []
 },
 {
  "slug": "mastra-cloud",
  "name": "Mastra Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "One-command managed deployment for Mastra, the TypeScript AI-agent framework — agents, tools, workflows, and memory with routing, scaling, and tracing handled for you.",
  "blurb": "One-command managed deployment for Mastra, the TypeScript AI-agent framework — agents, tools, workflows, and memory with routing, scaling, and tracing handled for you.",
  "website": "https://mastra.ai",
  "docsUrl": "https://mastra.ai/docs",
  "signupUrl": "https://cloud.mastra.ai",
  "pricingModel": "free-tier",
  "pricingNote": "Free to start; public pricing was slated for Q1 2026 but remained TBA as of mid-2026 — budget conservatively",
  "authType": "account",
  "agentSignup": "oauth",
  "agentSignupNote": "Sign in with GitHub, connect a repo, deploy with one command; free to start. No documented programmatic account provisioning yet.",
  "mcpServer": "@mastra/mcp-docs-server",
  "sdks": [
   "TypeScript"
  ],
  "codeSample": {
   "lang": "typescript",
   "code": "import { Mastra } from \"@mastra/core\";\nimport { Agent } from \"@mastra/core/agent\";\nimport { openai } from \"@ai-sdk/openai\";\n\nconst support = new Agent({\n  name: \"support\",\n  instructions: \"You are a helpful support agent.\",\n  model: openai(\"gpt-4o\"),\n});\n\nexport const mastra = new Mastra({ agents: { support } });"
  },
  "tags": [
   "ai-agents",
   "typescript",
   "workflows",
   "deployment",
   "framework"
  ],
  "useCases": []
 },
 {
  "slug": "dagster-plus",
  "name": "Dagster+",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Managed, asset-based orchestration for data, ML, and AI pipelines — declarative software-defined assets with lineage, scheduling, and serverless or hybrid compute.",
  "blurb": "Managed, asset-based orchestration for data, ML, and AI pipelines — declarative software-defined assets with lineage, scheduling, and serverless or hybrid compute.",
  "website": "https://dagster.io",
  "docsUrl": "https://docs.dagster.io/deployment/dagster-plus",
  "signupUrl": "https://dagster.io/lp/dagster-plus-trial",
  "pricingModel": "usage-based",
  "pricingNote": "30-day free trial; Solo $10/mo + $0.04/credit; Starter $100/mo + $0.035/credit; Serverless compute $0.01/min (May 2026: base plans no longer bundle credits)",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "30-day free trial signup; user and agent tokens are generated in-app for CI/CD and hybrid deployments.",
  "mcpServer": "",
  "sdks": [
   "Python"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import dagster as dg\n\n@dg.asset\ndef raw_users() -> list[dict]:\n    return fetch_users()\n\n@dg.asset\ndef clean_users(raw_users: list[dict]) -> int:\n    return len(raw_users)\n\ndefs = dg.Definitions(assets=[raw_users, clean_users])"
  },
  "tags": [
   "orchestration",
   "data-assets",
   "lineage",
   "python",
   "serverless"
  ],
  "useCases": []
 },
 {
  "slug": "aws-step-functions",
  "name": "AWS Step Functions",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Serverless visual workflow orchestrator for AWS — coordinate Lambda, containers, and 200+ services as durable state machines with built-in retries, error handling, and history.",
  "blurb": "Serverless visual workflow orchestrator for AWS — coordinate Lambda, containers, and 200+ services as durable state machines with built-in retries, error handling, and history.",
  "website": "https://aws.amazon.com/step-functions/",
  "docsUrl": "https://docs.aws.amazon.com/step-functions/",
  "signupUrl": "https://portal.aws.amazon.com/billing/signup",
  "pricingModel": "usage-based",
  "pricingNote": "Standard $0.025 per 1K state transitions (4K free/mo); Express ~$1 per million requests + duration",
  "authType": "api-key",
  "agentSignup": "manual-only",
  "agentSignupNote": "The root AWS account needs a human + credit card. After that, IAM/STS mint access keys and CloudFormation/CDK/SDKs provision state machines fully programmatically.",
  "mcpServer": "https://github.com/awslabs/mcp",
  "sdks": [
   "Python",
   "TypeScript",
   "Java",
   "Go",
   ".NET",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import boto3\n\nsfn = boto3.client(\"stepfunctions\")\nresp = sfn.start_execution(\n    stateMachineArn=\"arn:aws:states:us-east-1:123456789012:stateMachine:MyMachine\",\n    input='{\"orderId\": \"123\"}',\n)\nprint(resp[\"executionArn\"])"
  },
  "tags": [
   "orchestration",
   "serverless",
   "aws",
   "state-machine",
   "managed"
  ],
  "useCases": []
 },
 {
  "slug": "kestra-cloud",
  "name": "Kestra Cloud",
  "category": "orchestration-workflows",
  "kind": "api",
  "oneLiner": "Managed hosting for Kestra, the declarative YAML-based orchestration platform — event-driven data and infra workflows with 600+ plugins and a code-friendly UI.",
  "blurb": "Managed hosting for Kestra, the declarative YAML-based orchestration platform — event-driven data and infra workflows with 600+ plugins and a code-friendly UI.",
  "website": "https://kestra.io",
  "docsUrl": "https://kestra.io/docs",
  "signupUrl": "https://kestra.io/cloud",
  "pricingModel": "freemium",
  "pricingNote": "OSS is free/self-hostable; Kestra Cloud is in early-access with managed (paid) tiers, priced on executions/resources",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free Kestra Cloud account signup is available, but the managed service is currently early-access (may be gated); OSS self-host has no signup at all.",
  "mcpServer": "",
  "sdks": [
   "YAML",
   "REST"
  ],
  "codeSample": {
   "lang": "yaml",
   "code": "id: hello_world\nnamespace: company.team\ntasks:\n  - id: greet\n    type: io.kestra.plugin.core.log.Log\n    message: \"Hello from Kestra\""
  },
  "tags": [
   "orchestration",
   "declarative",
   "yaml",
   "data-pipelines",
   "plugins"
  ],
  "useCases": []
 },
 {
  "slug": "reducto",
  "name": "Reducto",
  "category": "document-parsing",
  "kind": "api",
  "oneLiner": "Agentic document parsing — layout-aware vision + VLMs + a multi-pass correction loop turn messy PDFs, scans, and spreadsheets into structured, RAG-ready data.",
  "blurb": "Agentic document parsing — layout-aware vision + VLMs + a multi-pass correction loop turn messy PDFs, scans, and spreadsheets into structured, RAG-ready data.",
  "website": "https://reducto.ai",
  "docsUrl": "https://docs.reducto.ai",
  "signupUrl": "https://platform.reducto.ai",
  "pricingModel": "freemium",
  "pricingNote": "Credit-based pay-as-you-go; standard plan includes 15,000 free credits, complexity auto-classified; async batch jobs get a 20% discount (12h SLA). Growth/Enterprise above the free tier.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Self-serve signup with 15,000 free credits and no sales call; Bearer API key from platform.reducto.ai. Onboarding can be completed without a human.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "import os\nfrom reducto import Reducto\n\nclient = Reducto(api_key=os.environ.get(\"REDUCTO_API_KEY\"))\n\nresponse = client.parse.run(\n    input=\"https://pdfobject.com/pdf/sample.pdf\",\n)"
  },
  "tags": [
   "document-parsing",
   "ocr",
   "rag",
   "extraction",
   "vlm"
  ],
  "useCases": []
 },
 {
  "slug": "llamaparse",
  "name": "LlamaParse",
  "category": "document-parsing",
  "kind": "api",
  "oneLiner": "LlamaIndex's managed document parser — per-page tiers from fast heuristics to VLM-agentic, with native LlamaIndex ingestion for RAG.",
  "blurb": "LlamaIndex's managed document parser — per-page tiers from fast heuristics to VLM-agentic, with native LlamaIndex ingestion for RAG.",
  "website": "https://www.llamaindex.ai/llamaparse",
  "docsUrl": "https://developers.llamaindex.ai/llamaparse/",
  "signupUrl": "https://cloud.llamaindex.ai",
  "pricingModel": "freemium",
  "pricingNote": "Per-page credits by tier: Fast 1cr, Cost Effective 3cr, Agentic 10cr, Agentic Plus 45cr. Free plan 10,000 credits/mo; Starter $50/mo (40k), Pro $500/mo (400k), Enterprise custom.",
  "authType": "api-key",
  "agentSignup": "self-serve-instant-key",
  "agentSignupNote": "Free signup at cloud.llamaindex.ai with 10,000 credits/month and an instant API key; no credit card to start.",
  "mcpServer": "",
  "sdks": [
   "Python",
   "TypeScript",
   "REST"
  ],
  "codeSample": {
   "lang": "python",
   "code": "from llama_cloud_services import LlamaParse\n\nparser = LlamaParse(result_type=\"markdown\")  # LLAMA_CLOUD_API_KEY env var\ndocs = parser.load_data(\"./report.pdf\")\nprint(docs[0].text)"
  },
  "tags": [
   "document-parsing",
   "rag",
   "llamaindex",
   "pdf",
   "extraction"
  ],
  "useCases": []
 }
];
