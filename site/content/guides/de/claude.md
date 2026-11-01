---
title: "Hummlist mit Claude verbinden"
description: "Verbinde Claude in unter fünf Minuten mit deiner Hummlist. Dann setzt Claude Sachen auf die Liste, hakt sie ab und sagt dir, was noch fehlt."
slug: claude
locale: de
translation_key: claude
updated: 2026-11-01
---

# Hummlist mit Claude verbinden

Claude kann deine Hummlist lesen, Sachen draufsetzen, abhaken und in eine andere Kategorie oder einen anderen Laden verschieben. Du schreibst Claude einfach, was du brauchst:

> **Du:** Setz Milch, zwei Gurken und Klopapier auf die Hummlist.
> **Claude:** Ich habe Milch, 2 Gurken und Klopapier auf die Hummlist gesetzt.

Die Einträge stehen sofort auf allen Geräten in eurem Haushalt, sortiert in ihre Kategorien. Das Einrichten dauert keine fünf Minuten. Du musst keinen Schlüssel kopieren: Claude meldet sich mit deinem Hummlist-Konto an.

## Was du brauchst

- ein Claude-Konto auf [claude.ai](https://claude.ai). Je nach Claude-Tarif ist die Zahl eigener Connectors begrenzt. In einer Claude-Organisation (Team oder Enterprise) muss eventuell ein Admin den Connector hinzufügen.
- die Hummlist-App, in der du angemeldet bist und zu einem Haushalt gehörst
- einen Browser, am besten am Computer. Der Connector steht danach auch in der Claude-App auf dem Handy und am Desktop zur Verfügung.

## Schritt 1: Connector hinzufügen

Die Namen der Menüpunkte in Claude stehen hier auf Deutsch, in Klammern auf Englisch. Sie können je nach Claude-Version leicht anders heißen.

1. Öffne [claude.ai](https://claude.ai) und melde dich an.
2. Öffne die **Einstellungen** (Settings) und dort **Connectors**.
3. Klicke auf **Benutzerdefinierten Connector hinzufügen** (Add custom connector).
4. Gib als Name `Hummlist` ein und als URL:

   ```text
   https://mcp.hummlist.com
   ```

   Lass die erweiterten Einstellungen (OAuth Client ID und Secret) leer.
5. Klicke auf **Hinzufügen** (Add).

## Schritt 2: Verbinden und erlauben

1. Klicke in der Liste der Connectors bei **Hummlist** auf **Verbinden** (Connect). Ein neues Fenster öffnet Hummlist.
2. Melde dich an, wenn Hummlist danach fragt, und zwar genauso wie in der App.
3. Hummlist fragt „Zugriff erlauben?“ und zeigt, was Claude darf: Einträge deiner Einkaufsliste lesen, hinzufügen, abhaken und verschieben. Prüf, dass dein Haushalt dasteht, und klicke auf **Erlauben**.
4. Claude braucht danach noch ein paar Sekunden, bis die Verbindung steht. Das Fenster zeigt so lange „Fertig, du kannst zu Claude zurückkehren.“ oder bleibt bis zu zehn Sekunden leer. Warte, bis es sich schließt oder Claude den Connector als verbunden zeigt.

## Schritt 3: Ausprobieren

1. Starte in Claude einen neuen Chat.
2. Prüf im Menü für Tools und Connectors unter dem Eingabefeld, dass **Hummlist** eingeschaltet ist.
3. Schreib zum Beispiel „Was steht auf der Hummlist?“.
4. Beim ersten Mal fragt Claude, ob es Hummlist benutzen darf. Erlaube es einmal oder immer.

| Du schreibst | Was passiert |
| --- | --- |
| Setz Milch, 2 Gurken und Windeln Pampers Größe 3 auf die Hummlist. | Drei Einträge, jeder in seiner Kategorie. Bei den Windeln stehen Marke „Pampers“ und „Größe 3“ dabei. |
| Was steht auf der Hummlist? | Claude zählt die offenen Einträge in der Reihenfolge eurer Liste auf und sagt, wie viele es sind. |
| Was brauche ich bei dm? | Alles für dm und alles ohne Laden, in der Reihenfolge von dm. |
| Hak Milch und Gurken ab. | Beide verschwinden von der Liste und stehen in der App unter „Zuletzt verwendet“. |
| Verschieb die Hafermilch nach Getränke. | Hummlist merkt sich das für euren Haushalt. Beim nächsten Mal landet Hafermilch gleich dort. |

Was schon auf der Liste steht, kommt nicht doppelt dazu. Claude sagt dir dann, dass es schon draufsteht. Hummlist sortiert deutsche Namen am besten ein. Häufige englische Wörter kennt es auch.

> **Was Claude sieht**
>
> - Claude sieht nur eure Einkaufsliste: Einträge, Kategorien und Läden. Dein Passwort bekommt Claude nicht.
> - Was du Claude schreibst und was Hummlist antwortet, verarbeitet Anthropic nach seinen eigenen Datenschutzbestimmungen.
> - Alles Weitere steht in der [Datenschutzerklärung](/datenschutz) unter „Siri, Alexa und KI-Assistenten“.

## Wenn es nicht klappt

| Was passiert | Woran es liegt | Was hilft |
| --- | --- | --- |
| Nach **Erlauben** bleibt das Fenster ein paar Sekunden leer. | Claude schließt die Verbindung auf seiner Seite ab. | Warte bis zu zehn Sekunden. Zeigt Claude den Connector danach nicht als verbunden, klicke noch einmal auf **Verbinden**. |
| „Diese Anfrage ist ungültig oder abgelaufen. Starte die Verbindung in deiner App neu.“ | Die Anfrage von Claude ist ein paar Minuten alt oder wurde schon benutzt. | Klicke in Claude noch einmal auf **Verbinden**. |
| Claude sagt, es kann nicht auf Hummlist zugreifen. | Hummlist ist in diesem Chat ausgeschaltet. | Schalte **Hummlist** im Menü für Tools und Connectors ein. |
| Claude findet einen Eintrag nicht. | Der Name passt auf mehrere Einträge oder auf keinen. | Schreib den Namen so, wie er in der App steht. Claude bekommt die passenden Namen zur Auswahl. |
| Ein Eintrag steht in der falschen Kategorie. | Hummlist hat das Wort einer anderen Kategorie zugeordnet. | Schreib Claude zum Beispiel „Verschieb Feta nach Kühlregal“. Hummlist merkt sich das für euren Haushalt. |

## Claude wieder trennen

Du hast zwei Möglichkeiten. Jede beendet die Verbindung sofort:

- **In Hummlist:** Tippe auf **Mehr** und dann auf **Zugänge**. Tippe unter **Verbundene Apps** neben **Claude** auf das Symbol zum Trennen und bestätige mit **Trennen**.
- **In Claude:** Öffne **Einstellungen** (Settings) → **Connectors**, wähle **Hummlist** und trenne oder entferne den Connector.

## Für Fortgeschrittene: Claude Code und Codex

**Claude Code** verbindet sich mit einem Befehl. Danach in Claude Code `/mcp` aufrufen und **Authenticate** wählen. Es öffnet sich dieselbe Seite „Zugriff erlauben?“.

```bash
claude mcp add --transport http hummlist https://mcp.hummlist.com
```

**Codex** (CLI, IDE-Erweiterung und ChatGPT-Desktop-App teilen sich `~/.codex/config.toml`) funktioniert genauso, ist aber kein offiziell unterstützter Weg:

```toml
[mcp_servers.hummlist]
url = "https://mcp.hummlist.com"
```

```bash
codex mcp login hummlist
```

Für Skripte und Programme ohne Anmeldung erstellst du in der App unter **Mehr** → **Zugänge** → **Token erstellen** einen Zugriffstoken. Er wird nur einmal angezeigt. Schick ihn als `Authorization: Bearer fgp_…` mit.

Fragen oder Probleme? Schreib mir in der App über **Mehr** → **Feedback senden**.
