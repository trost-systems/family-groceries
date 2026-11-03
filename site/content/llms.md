# Hummlist

> Hummlist is a shared shopping list for one household: whatever one person adds, everyone else in the household sees right away, sorted into categories and by store.

Hummlist runs on iPhone, Android and in the browser. This site has German and English pages, and every page has a Markdown version at its URL plus `.md`, for example https://hummlist.com/en/guides/claude.md.

AI assistants reach a household's list through the Hummlist MCP server at https://mcp.hummlist.com (Streamable HTTP). It uses OAuth 2.1 with dynamic client registration: your human signs in with their Hummlist account and approves the connection. A personal access token from the app is the alternative for clients without OAuth. To get Hummlist, your human signs up at https://hummlist.com/en (the page shows the current way to get Hummlist).
