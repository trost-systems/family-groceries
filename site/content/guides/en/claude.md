---
title: "Connect Hummlist to Claude"
description: "Connect Claude to your Hummlist in under five minutes. Then Claude adds items, ticks them off and tells you what's still missing."
slug: claude
locale: en
translation_key: claude
updated: 2026-11-01
---

# Connect Hummlist to Claude

Claude can read your Hummlist, add items, tick them off and move them to another category or store. Just tell Claude what you need:

> **You:** Put milk, two cucumbers and toilet paper on the Hummlist.
> **Claude:** I've added milk, 2 cucumbers and toilet paper to your Hummlist.

The items show up right away on every device in your household, sorted into their categories. Setting it up takes less than five minutes. You don't copy any key: Claude signs in with your Hummlist account.

## What you need

- a Claude account at [claude.ai](https://claude.ai). Depending on your Claude plan, the number of custom connectors may be limited. In a Claude organization (Team or Enterprise), an admin may have to add the connector.
- the Hummlist app, signed in and part of a household
- a browser, ideally on a computer. Afterwards the connector is also available in the Claude apps on your phone and desktop.

## Step 1: Add the connector

Menu names in Claude may differ slightly between Claude versions.

1. Open [claude.ai](https://claude.ai) and sign in.
2. Open **Settings**, then **Connectors**.
3. Click **Add custom connector**.
4. Enter `Hummlist` as the name and this URL:

   ```text
   https://mcp.hummlist.com
   ```

   Leave the advanced settings (OAuth Client ID and Secret) empty.
5. Click **Add**.

## Step 2: Connect and allow

1. In the list of connectors, click **Connect** next to **Hummlist**. A new window opens Hummlist.
2. Sign in if Hummlist asks, the same way you do in the app.
3. Hummlist asks "Allow access?" and shows what Claude may do: read, add, tick off and move items on your shopping list. Check that it shows your household, then click **Allow**.
4. Claude then needs a few seconds to finish connecting. Meanwhile the window shows "Done, you can return to Claude." or stays blank for up to ten seconds. Wait until it closes or Claude shows the connector as connected.

## Step 3: Try it

1. Start a new chat in Claude.
2. In the tools and connectors menu below the message field, check that **Hummlist** is turned on.
3. Write, for example, "What's on the Hummlist?".
4. The first time, Claude asks whether it may use Hummlist. Allow it once or always.

| You write | What happens |
| --- | --- |
| Put milk, 2 cucumbers and Pampers diapers size 3 on the Hummlist. | Three items, each in its category. The diapers keep "Pampers" as the brand. |
| What's on the Hummlist? | Claude lists the open items in your list's order and tells you how many there are. |
| What do I need at dm? | Everything for dm and everything without a store, in dm's order. |
| Tick off milk and cucumbers. | Both leave the list and show up in the app under "Recently used". |
| Move the oat milk to Getränke. | Hummlist remembers this for your household. Next time oat milk goes straight there. |

Anything already on the list isn't added twice. Claude tells you it's already there. Hummlist was made for German shopping lists: its categories have German names such as Kühlregal or Obst & Gemüse, and it sorts German item names best. It knows common English words too, and Claude can write items in German for you if you ask.

> **What Claude sees**
>
> - Claude sees only your shopping list: items, categories and stores. Claude never gets your password.
> - What you write to Claude and what Hummlist answers is processed by Anthropic under its own privacy policy.
> - Read more in the [privacy policy](/en/privacy) under "Siri, Alexa and AI assistants".

## If it doesn't work

| What happens | Why | What helps |
| --- | --- | --- |
| After **Allow** the window stays blank for a few seconds. | Claude is finishing the connection on its side. | Wait up to ten seconds. If Claude still doesn't show the connector as connected, click **Connect** again. |
| "This request is invalid or has expired. Start the connection again in your app." | Claude's request is a few minutes old or was used already. | Click **Connect** in Claude again. |
| Claude says it can't access Hummlist. | Hummlist is turned off in this chat. | Turn on **Hummlist** in the tools and connectors menu. |
| Claude can't find an item. | The name matches several items or none. | Write the name the way the app shows it. Claude gets the matching names to choose from. |
| An item is in the wrong category. | Hummlist matched the word to another category. | Tell Claude, for example, "Move feta to Kühlregal". Hummlist remembers this for your household. |

## Disconnect Claude

Either way ends the connection right away:

- **In Hummlist:** Tap **More**, then **Access**. Under **Connected apps**, tap the disconnect icon next to **Claude** and confirm with **Disconnect**.
- **In Claude:** Open **Settings** → **Connectors**, choose **Hummlist** and disconnect or remove it.

## For power users: Claude Code and Codex

**Claude Code** connects with one command. Then run `/mcp` in Claude Code and choose **Authenticate**. The same "Allow access?" page opens.

```bash
claude mcp add --transport http hummlist https://mcp.hummlist.com
```

**Codex** (the CLI, the IDE extension and the ChatGPT desktop app share `~/.codex/config.toml`) works the same way, but isn't an officially supported path:

```toml
[mcp_servers.hummlist]
url = "https://mcp.hummlist.com"
```

```bash
codex mcp login hummlist
```

For scripts and programs that can't sign in, create an access token in the app under **More** → **Access** → **Create token**. It's shown only once. Send it as `Authorization: Bearer fgp_…`.

Questions or problems? Write to me in the app under **More** → **Send feedback**.
