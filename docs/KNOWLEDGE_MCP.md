# KnowledgeVault MCP – ChatGPT + Familienkonten

## Zweck
Getrennte ChatGPT-Konten können über **denselben** read-only MCP-Endpunkt mit den eigenen Knowledge-Inhalten verbunden werden. Andere Familienbibliotheken sind nur nach einer eigenen expliziten Freigabe durch die jeweilige Person sichtbar. Weder Gesundheitsdaten noch private Dokumente oder KAMA-NET sind Bestandteil des MCP.

## MCP-Verbindung

- MCP-URL: `https://nixakeaiibzhesdwtelw.supabase.co/functions/v1/knowledge-mcp`
- Auth-Server: `https://nixakeaiibzhesdwtelw.supabase.co/functions/v1/knowledge-oauth`
- Typ: Streamable HTTP (MCP JSON-RPC), OAuth 2 authorization_code + PKCE S256, Dynamic Client Registration, personal GoTrue login.
- Loginformular: `https://namorbru-rgb.github.io/knowledge-vault/#/oauth-authorize`, erscheint automatisch bei einer OAuth-Anfrage.
- Bearer JWT aus dem Familienkonto wird gegen GoTrue, aktiven Auth-Session-Eintrag und eine zur Knowledge-OAuth-Sitzung gehörende Access-Token-SHA256-Bindung überprüft.
- Kein statischer Service-Key / kein gemeinsames Familienpasswort im MCP-Client. Der verwendete `SUPABASE_SERVICE_ROLE_KEY` bleibt serverseitig nur im OAuth-Broker (Clientregistrierung und Refresh-Token-Hashspeicher).
- Sämtliche MCP-Werkzeuge sind **read-only**.

## Werkzeuge

- `search_knowledge({query,types,limit,offset})`: alle sichtbaren Videos, Transkriptsegmente, Links/Webseiten, Foto-OCR und Notizen durchsuchen.
- `list_knowledge({types,limit,offset})`: sichtbare Einträge in Seiten zu max. 50 durchgehen; `has_more` beachten.
- `get_knowledge_item({type,id,segment_offset,text_offset})`: Detail und volle gespeicherte Texte abrufen, lange Textfelder in 25.000-Zeichen-Seiten, Videotranskripte in 100-Segment-Seiten.

Ausgabe verweist auf Kennungen/Original-URLs. Transkriptsegmente werden nur geliefert, wenn sie in `kv_video_segments` tatsächlich vorhanden sind. Das MCP kann leere Transkriptbestände nicht rekonstruieren und führt keine eigene Audio-/Bildanalyse durch.

## Freigaben

Die Familienseite zeigt „Knowledge für KI und Familie“. Jeder Besitzer kann die **eigene gesamte Knowledge-Bibliothek** für ein anderes bereits verknüpftes Familienkonto mit einem Klick freigeben oder die Freigabe zurückziehen. Technisch: `kv_mcp_shares` mit owner-only insert/delete und RLS. Die definer-RPCs `kv_mcp_search` und `kv_mcp_get` erlauben lediglich Lesen eigener oder explizit geteilter Knowledge-Datensätze. Die bisherigen Eigentums-/Schreibschutzrichtlinien und Health-RLS werden nicht gelockert. Schon übermittelte Inhalte an einen KI-Dienst können dort nicht durch nachträglichen Widerruf zurückgeholt werden.

## Rollout

1. SQL-Migrationen aus `supabase/migrations/20261017*.sql` anwenden.
2. Supabase Edge Functions `knowledge-mcp` und `knowledge-oauth` deployen (JWT-Gateway-Check ist deaktiviert, da Funktion eigene Auth-Checks und HTTP-401-Protected-Resource-Challenge durchführt).
3. Frontend aus diesem Branch nach `main` mergen und GitHub Pages Workflow abwarten.
4. Beide Personen fügen dieselbe MCP-URL ihrem jeweiligen ChatGPT als benutzerdefinierte Verbindung hinzu und melden sich **separat** an.
5. Besitzer der grösseren Knowledge-Bibliothek bestätigt auf der Familienseite die gewünschte andere Person durch „Knowledge freigeben“.
6. Tests: ohne Bearer 401; mit Browser-JWT (nicht über Knowledge OAuth) 401; mit gültigem Knowledge OAuth token tools/list und suche/get; widerrufene Session 401; ohne Freigabe keine fremden Inhalte; mit Freigabe ja; nach Widerruf wieder nein; `tools/call` mit unbekannter/write-Aktion wird abgelehnt.

## Grenzen / nicht als bestanden markieren, bevor geprüft
- Externer ChatGPT-OAuth-Rundlauf und Datenlesen **müssen nach der Frontend-Veröffentlichung mit realem, persönlich bestätigtem Login getestet werden**.
- Die Project-weite Supabase-Auth-Redirect-Allowlist wurde nicht verändert; der Broker nutzt eigene HTTPS-Weiterleitungen, damit bestehende KAMA-Applikationen nicht beeinträchtigt werden.
- Video-Transkripte benötigen eine separate Verarbeitung, sofern noch keine Segmente vorhanden sind.
- Ein Bibliotheks-Grant gilt für bisherige und künftige Knowledge-Einträge des Eigentümers, nicht für Gesundheits- oder Familien-Dokumentressourcen.

