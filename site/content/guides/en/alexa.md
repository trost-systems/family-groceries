---
title: "Hummlist with Alexa: set up the skill"
description: "With the Hummlist skill for Amazon Alexa you add things to your Hummlist by voice: \"Alexa, ask Hummlist to add milk and eggs\". Here's how to set it up in a few minutes."
slug: alexa
locale: en
translation_key: alexa
updated: 2026-11-04
---

# Hummlist with Alexa: set up the skill

With the **Hummlist** skill for Amazon Alexa you add things to your Hummlist by voice, without opening the app. The skill is still in a beta test and not available to everyone yet: you need an invitation. After that it works like this:

> **You:** Alexa, ask Hummlist to add milk and eggs.
> **Alexa:** I put milk and eggs on Hummlist.

Alexa sends your sentence to Hummlist. Hummlist splits it into separate items, sorts each into its category, and the items show up on every device in your household right away. The skill understands English and German, depending on the language your Alexa device is set to. If your device is set to German, follow the German guide: [Hummlist per Alexa: Skill einrichten](/de/anleitungen/alexa)

## What you need

- an invitation link to the skill's beta test
- an Amazon account, the Alexa app on your phone and an Alexa device set to English (or German)
- the Hummlist app, signed in, in a household
- about five minutes

## Step 1: accept the beta invitation

Amazon doesn't send emails for the beta test. You get the invitation link from Peter. Send him the email address of your Amazon account.

1. Open the invitation link on your phone.
2. Sign in with the Amazon account you use for Alexa.
3. Accept the terms of the beta test.

Accept it soon: after 30 days without an answer Amazon takes you out of the test.

## Step 2: enable the skill and link your account

Alexa signs in with your Hummlist account, not with a token. There's nothing to copy.

1. The Alexa app opens the page of the skill **Hummlist**. During the test its icon carries the note "dev".
2. Tap **Enable to use**. The Hummlist sign-in opens right after.
3. Sign in when Hummlist asks, the same way as in the app.
4. Hummlist asks "Allow access?" and shows what "Amazon Alexa" may do: read, add, tick off and move items on your shopping list. Tap **Allow**.
5. The Alexa app shows that your account is linked.

## Step 3: try it

1. Say to your Alexa device: "Alexa, ask Hummlist to add milk and eggs".
2. Alexa answers "I put milk and eggs on Hummlist.", and the items are in the app.

## How Alexa reaches Hummlist {#reach-hummlist}

The Alexa app has shopping lists of its own. For your sentence to reach Hummlist and not those, it has to contain "ask Hummlist", "tell Hummlist" or "open Hummlist":

- "Alexa, ask Hummlist to add milk."
- "Alexa, tell Hummlist we need milk."
- "Alexa, ask Hummlist to put milk on the list."
- "Alexa, ask Hummlist what's on the list."
- "Alexa, open Hummlist." Then say what should go on the list.

Don't say "Alexa, add milk to Hummlist". Alexa handles that sentence without Hummlist: Alexa looks for a list called "Hummlist" in the Alexa app and either can't find it or puts the milk on the Alexa shopping list.

Alexa recognizes the name best when you say it clearly as two syllables: "Humm-list". If Alexa answers with the Alexa shopping list or doesn't know the name, say "Alexa, open Hummlist" first and then what should go on the list.

## How to talk to it

Say several things in one sentence with "and" between them. A pause alone doesn't separate them.

| You say | On the list |
| --- | --- |
| Alexa, ask Hummlist to add milk and eggs | milk · eggs |
| Alexa, ask Hummlist to add two liters of milk | 2 l milk |
| Alexa, tell Hummlist we need bread, butter and cheese | bread · butter · cheese |

Quantities like "two liters of milk" become one item with a quantity. Alexa tells you afterwards what went on the list. Things already on the list aren't added twice: Alexa says "Already on Hummlist: milk."

Ask "Alexa, ask Hummlist what's on the list" and Alexa reads at most 10 open items, in the order of your list, then for example "… and 4 more."

> **What happens to your voice**
>
> - Hummlist doesn't store voice recordings. Only the recognized text reaches us, for example "milk and eggs".
> - Amazon records your voice and turns it into text, under Amazon's Alexa terms and privacy notice. How long Amazon keeps recordings and how to delete them is set in the Alexa app.
> - More in the [privacy policy](/en/privacy).

## If it doesn't work

| What happens | Why | What helps |
| --- | --- | --- |
| Alexa doesn't know the skill, although you accepted the invitation. | Your Alexa device is set to a language the skill doesn't support. It supports German (Germany) and English (US, UK, Australia, Canada, India). | Set the device language to one of these: Alexa app → **More** → **Settings** → **Device Settings** → your device → gear icon at the top right → under **General**, tap **Language**. |
| Alexa can't find a list called Hummlist, or puts the item on the Alexa shopping list. | The sentence didn't contain "ask Hummlist", for example "Add milk to Hummlist". It went to the lists in the Alexa app. | Say "Alexa, ask Hummlist to add milk" or first "Alexa, open Hummlist" (see [How Alexa reaches Hummlist](#reach-hummlist)). |
| Alexa doesn't know the name, or hears another name. | Alexa didn't recognize "Hummlist". | Say the name clearly as two syllables, "Humm-list", or start with "Alexa, open Hummlist". |
| "Please link your Hummlist account in the Alexa app first." | The skill isn't, or is no longer, linked to your Hummlist account. | On the skill's page in the Alexa app tap **Link account** and continue as in step 2. |
| "You're not in a household yet …" | Your Hummlist account isn't in a household. | Create a household in the app or join one. |

## Turn Alexa off again

- **In the Alexa app:** find the skill **Hummlist** and tap **Disable skill** on its page.
- **In Hummlist:** tap **More**, then **Access**, and disconnect **Amazon Alexa** under connected apps. Alexa loses access to your list right away.

Questions or problems? Write to us in the app under **More** → **Send feedback**.
