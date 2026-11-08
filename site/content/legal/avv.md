---
title: Auftragsverarbeitungsvertrag für Vereine
description: "Entwurf: Auftragsverarbeitungsvertrag nach Art. 28 DSGVO für Vereine, die einen Hummlist-Haushalt nutzen."
locale: de
path: /avv
translation_key: dpa
updated: 2026-11-08
draft: true
---

# Auftragsverarbeitungsvertrag nach Art. 28 DSGVO

ENTWURF / DRAFT, nicht veröffentlicht, nicht verlinkt. Dieser Text wartet auf die Prüfung durch Legal (offene Fragen in `docs/legal/169b-privacy-draft.md`).

Stand: 8. November 2026

## 1. Vertragsparteien

Verantwortlicher ist der Verein, der einen Hummlist-Haushalt für seine Mitglieder nutzt (im Folgenden „Verein“). Für ihn schließt eine vertretungsberechtigte Person diesen Vertrag ab.

Auftragsverarbeiter ist Peter Trost, Yalovastr. 5, 72108 Rottenburg am Neckar, Deutschland, E-Mail [support@hummlist.com](mailto:support@hummlist.com), der Anbieter von Hummlist (im Folgenden „Hummlist“).

## 2. Gegenstand

Der Verein nutzt in Hummlist einen Haushalt, um mit seinen Mitgliedern gemeinsame Einkaufslisten zu führen, zum Beispiel für ein Vereinsfest. Hummlist speichert und verarbeitet die Daten dieses Haushalts für den Verein. Dieser Vertrag regelt nur den Datenschutz.

Nicht Gegenstand dieses Vertrags sind die Daten, die Hummlist als eigener Verantwortlicher verarbeitet, wie in der [Datenschutzerklärung](/datenschutz) beschrieben: das Konto jeder Person (E-Mail-Adresse, Passwort, Anmeldung über Google oder Apple, Anzeigename im Profil), ihre anderen Haushalte, Nutzungsdaten und Fehlerberichte, Support-Anfragen, Rückmeldungen, Käufe und die Verbindungen, die eine Person selbst einrichtet (Siri, Alexa, KI-Assistenten). Jedes Mitglied hat ein eigenes Konto und einen eigenen Nutzungsvertrag mit Hummlist.

## 3. Dauer

Der Vertrag gilt, solange der Verein den Haushalt nutzt. Er endet, wenn der Haushalt gelöscht wird oder der Verein den Vertrag in Textform kündigt. Für die Zeit danach gilt Abschnitt 13.

## 4. Art und Zweck der Verarbeitung

Hummlist speichert die Daten des Haushalts, zeigt sie seinen Mitgliedern in der App an, gleicht sie zwischen den Geräten ab, ordnet Einträge Kategorien und Läden zu und sichert sie. Zweck ist allein, dass die Mitglieder des Vereins gemeinsame Listen führen können.

## 5. Art der Daten

- Name und Art des Haushalts, ob Beitritte bestätigt werden müssen
- Mitgliedschaften: wer Mitglied ist, mit dem Anzeigenamen, den die anderen Mitglieder sehen, die Rolle (Hauptadmin, Admin, Mitglied) und wann die Person beigetreten ist
- Listen: Name, Reihenfolge, wer sie angelegt hat und wann
- Einträge: Artikelname, Menge, Marke, Eigenschaften, Kategorie, Laden, wer sie hinzugefügt und abgehakt hat, Zeitpunkte, sowie Namen von Personen, falls Mitglieder sie in einen Eintrag schreiben
- Verlauf der Änderungen an Einträgen
- „Ich bringe“-Zusagen: welches Mitglied welchen Eintrag mitbringt, mit einer freiwilligen Mengenangabe
- Einladungen: wer sie erstellt hat, Art, Ablauf, Zahl der Beitritte und der Aufrufe der Beitrittsseite; wer über welche Einladung wann beigetreten ist
- Beitrittsanfragen: wer beitreten möchte, über welche Einladung, wann, die Entscheidung, wann und von wem sie getroffen wurde
- Entfernungen: wer aus dem Haushalt entfernt wurde und wann, 30 Tage lang
- was Hummlist für den Haushalt lernt (Kategorien, Läden, Marken und ihre Reihenfolge)

Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) sind nicht vorgesehen. Hummlist hat keine Felder dafür. Der Verein weist seine Mitglieder darauf hin, solche Angaben nicht in Einträge zu schreiben.

## 6. Kategorien betroffener Personen

- Mitglieder des Vereins und andere Personen, die dem Haushalt beitreten, zum Beispiel Helfer
- Personen, die einem Haushalt beitreten möchten (Beitrittsanfragen)
- Personen, deren Namen Mitglieder in Einträge schreiben

## 7. Weisungen

Hummlist verarbeitet die Daten nur auf dokumentierte Weisung des Vereins, auch bei Übermittlungen in Drittländer, außer wenn das Recht der Union oder Deutschlands eine Verarbeitung verlangt; dann teilt Hummlist dem Verein das vorher mit, soweit das Recht es erlaubt (Art. 28 Abs. 3 lit. a DSGVO). Die Weisungen sind dieser Vertrag und die Einstellungen und Aktionen, die Hauptadmin und Admins des Vereins in der App vornehmen (zum Beispiel Mitglieder entfernen, Beitritte bestätigen, Listen löschen). Weitere Weisungen gibt der Verein in Textform an [support@hummlist.com](mailto:support@hummlist.com).

Hält Hummlist eine Weisung für rechtswidrig, teilt Hummlist das dem Verein unverzüglich mit (Art. 28 Abs. 3 UAbs. 2 DSGVO).

## 8. Vertraulichkeit

Hummlist wird von Peter Trost allein betrieben. Zugriff auf die Daten des Haushalts außerhalb der App haben nur er und die automatischen Abläufe, die er für Betrieb und Sicherung eingerichtet hat. Peter Trost ist zur Vertraulichkeit verpflichtet. Setzt Hummlist weitere Personen ein, verpflichtet Hummlist sie vorher zur Vertraulichkeit (Art. 28 Abs. 3 lit. b DSGVO).

## 9. Technische und organisatorische Maßnahmen

Hummlist trifft die Maßnahmen nach Art. 32 DSGVO. Zum Zeitpunkt dieses Vertrags sind das:

- Die Datenbank liegt bei Supabase im Rechenzentrum Frankfurt am Main.
- Jede Verbindung zu App, Web-App und Server ist per TLS verschlüsselt.
- Jede Tabelle mit Haushaltsdaten ist durch Zugriffsregeln der Datenbank (Row Level Security) geschützt. Nur Mitglieder eines Haushalts lesen seine Daten; Beitrittsanfragen sehen nur die anfragende Person sowie Hauptadmin und Admins. Automatische Tests prüfen diese Regeln für jede Tabelle.
- Passwörter speichert Hummlist nur als Hash. Zugriffstoken speichert Hummlist nur als Hash (SHA-256); den Token selbst sieht nur die Person, die ihn erstellt.
- Jede Nacht entsteht eine Sicherungskopie der Datenbank. Sie wird vor dem Speichern verschlüsselt (age), ist ohne den privaten Schlüssel nicht lesbar und wird nach 90 Tagen gelöscht.
- Protokolle des Datenbank-Anbieters werden nach höchstens 1 Tag gelöscht.
- Änderungen an Datenbank und Server gehen nur nach automatischen Prüfungen in Betrieb.

Hummlist darf die Maßnahmen weiterentwickeln, solange das Schutzniveau nicht sinkt.

## 10. Unterauftragsverarbeiter

Der Verein erlaubt Hummlist, diese Unterauftragsverarbeiter einzusetzen:

- Supabase Pte. Ltd., Singapur: Datenbank, Anmeldung, Server-Funktionen. Die Datenbank liegt in Frankfurt am Main; Server-Funktionen laufen am Standort, der dem Aufruf am nächsten liegt, auch außerhalb der EU. Grundlage für Übermittlungen: Standardvertragsklauseln im Auftragsverarbeitungsvertrag von Supabase.
- Vercel Inc., USA: Auslieferung der Web-App und der Beitrittsseite, Weiterleitung von mcp.hummlist.com. Grundlage: EU-US Data Privacy Framework und Standardvertragsklauseln.
- GitHub Inc., USA: Speicherort der verschlüsselten Sicherungskopien. Grundlage: EU-US Data Privacy Framework.

Hummlist bindet jeden Unterauftragsverarbeiter vertraglich an Pflichten, die diesem Vertrag entsprechen (Art. 28 Abs. 4 DSGVO). Will Hummlist einen Unterauftragsverarbeiter hinzufügen oder ersetzen, informiert Hummlist den Verein vorher in Textform. Der Verein kann innerhalb von 30 Tagen widersprechen. Widerspricht er, kann er den Vertrag kündigen.

## 11. Rechte der betroffenen Personen

Viele Rechte können Mitglieder in der App selbst ausüben: Einträge ändern und löschen, Zusagen zurücknehmen, den Haushalt verlassen, ihre Daten exportieren und ihr Konto löschen. Hauptadmin und Admins können Mitglieder entfernen und Beitrittsanfragen entscheiden. Darüber hinaus unterstützt Hummlist den Verein bei Anfragen nach Art. 15 bis 22 DSGVO. Erhält Hummlist eine Anfrage, die Daten des Haushalts betrifft, leitet Hummlist sie unverzüglich an den Verein weiter.

## 12. Weitere Unterstützung, Datenschutzverletzungen

Hummlist unterstützt den Verein bei seinen Pflichten nach Art. 32 bis 36 DSGVO mit den Informationen, die Hummlist vorliegen. Erfährt Hummlist von einer Verletzung des Schutzes der Daten des Haushalts, meldet Hummlist sie dem Verein unverzüglich, mit den Angaben nach Art. 33 Abs. 3 DSGVO, soweit bekannt.

## 13. Löschung und Rückgabe

Endet der Vertrag, löscht Hummlist die Daten des Haushalts. Verlässt das letzte Mitglied den Haushalt, löscht Hummlist die Daten sofort. Aus den Sicherungskopien verschwinden sie nach spätestens 90 Tagen. Vor der Löschung stellt Hummlist dem Verein die Daten des Haushalts auf Anfrage in Textform als JSON-Datei bereit. Eine Pflicht zur Speicherung nach dem Recht der Union oder Deutschlands bleibt unberührt.

## 14. Nachweise und Kontrollen

Hummlist stellt dem Verein auf Anfrage die Informationen bereit, die er braucht, um die Einhaltung dieses Vertrags nachzuweisen, und ermöglicht Überprüfungen durch den Verein oder einen von ihm beauftragten Prüfer, der zur Vertraulichkeit verpflichtet ist (Art. 28 Abs. 3 lit. h DSGVO). Eine Überprüfung vor Ort kündigt der Verein mindestens 14 Tage vorher an.

## 15. Haftung

Die Haftung richtet sich nach den gesetzlichen Vorschriften, insbesondere Art. 82 DSGVO.

## 16. Schlussbestimmungen

Änderungen dieses Vertrags bedürfen der Textform. Es gilt deutsches Recht.
