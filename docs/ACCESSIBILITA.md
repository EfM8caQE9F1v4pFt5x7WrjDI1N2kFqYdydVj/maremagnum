# Accessibilità — dichiarazione di conformità

Maremagnum punta alla piena conformità **WCAG 2.2 livello AA** (Recommendation
W3C, aggiornamento 12 dicembre 2024, errata editoriali ottobre 2025 — la
versione più recente: WCAG 3.0 è ancora una bozza), più tutti i criteri **AAA
ragionevolmente applicabili** a un gioco multigiocatore in tempo reale.

## Come si verifica

- `npm run test:a11y` — axe-core (tag `wcag2a/aa`, `wcag21a/aa`, `wcag22aa`)
  su **14 stati** dell'interfaccia (benvenuto/ancoraggio, plancia, classifica,
  mappa, impostazioni, manuale, assedi, oracolo, dockbar, sito, affondamento,
  cantiere), più verifiche comportamentali di tastiera: fuoco che entra nei
  dialoghi, giro del Tab senza trappole, ESC che chiude e restituisce il
  fuoco, rimappatura reale di un tasto. Esce 1 alla prima violazione.
- I contrasti che axe non può calcolare (testi sopra il canvas) sono garantiti
  da fondali opachi (`#hud`, `#hint`: `rgba(14,9,4,.75)`) e verificati al
  caso peggiore (schiuma chiara sotto il pannello) con il calcolo WCAG:
  tutte le coppie ≥ 4.5:1 (testo) e ≥ 3:1 (non-testo). I testi DENTRO il
  canvas (nomi di isole e navi) hanno un orlo scuro `stroke` 3px.

## L'architettura: la scena e lo stato

Il mondo disegnato (PixiJS, `canvas` marcato `aria-hidden`) è la **scena**:
inaccessibile per natura a uno screen reader, come da nota W3C sui giochi in
tempo reale. Lo **stato di gioco** — vita, oro, missione, eventi, approdi,
esiti — viaggia tutto nell'interfaccia DOM accessibile: barra vita
`progressbar`, diario di bordo `role="log"`, toast e suggerimenti
`role="status"`, pannelli-dialogo con gestione del fuoco. Il landmark `main`
contiene la descrizione testuale della scena.

## Scelte principali

| Tema | Scelta |
|---|---|
| Tasti singoli (2.1.4) | **Timoneria** nelle Impostazioni: ogni azione si rimappa; frecce sempre attive; ESC/INVIO/TAB riservati alla navigazione. La legenda e le etichette del Cantiere seguono la mappa. |
| Tastiera (2.1.1/2.1.2) | Tutto operabile da tastiera. TAB non è più sequestrato dalla classifica (ora su C). Nei dialoghi il Tab gira dentro il pannello, ESC chiude sempre, il fuoco torna al bottone d'origine. Nel Cantiere il fuoco sopravvive alla ricostruzione del pannello dopo un acquisto. |
| Fuoco su controlli | I campi catturano i tasti; sui bottoni solo SPAZIO/INVIO appartengono al bottone: il timone resta vivo. |
| Autenticazione (3.3.8) | TOTP con **incolla libero** e `autocomplete="one-time-code"` (autofill da gestori di password e SMS/app); nessun puzzle o trascrizione obbligata. Handle con `autocomplete="username"`. |
| Stato annunciato (4.1.3) | `role="status"` su toast, missione, esito riscatto, suggerimento d'approdo (aggiornato solo ai cambi, per non balbettare); `role="log"` sul diario di bordo. |
| Movimento (2.3.3) | **Mare calmo** nelle Impostazioni (niente scosse dello schermo né nuvole alla deriva), con default da `prefers-reduced-motion`. |
| Tempo (2.2.1/2.2.2) | Il ritmo di gioco è l'eccezione "tempo reale/essenziale" prevista dalle WCAG; nessun altro limite di tempo esiste. Il decadimento dei conti a 30 giorni è dichiarato nel testo (2.2.6 AAA). |
| Riflusso (1.4.10) | Media query a 720px: pannelli `min(…, 96vw)`, HUD e minimappa ridotti; i pannelli scorrono, mai perdita orizzontale. |
| Focus visibile (2.4.7/2.4.13) | Anello doppio: blu 3px su alone chiaro 3px — ≥3:1 su pergamena, legno e acqua. |

## WCAG 2.2 — A e AA (obiettivo: tutto conforme)

| Criterio | Stato | Come |
|---|---|---|
| 1.1.1 Contenuti non testuali | ✅ | aria-label su bottoni-emoji, canvas QR e minimappa `role="img"`; mappa del tesoro etichettata con la destinazione; scena descritta in `main` |
| 1.2.x Media temporizzati | N.A. | nessun audio/video informativo: musica d'atmosfera disattivabile |
| 1.3.1 Info e relazioni | ✅ | dialoghi `role="dialog"` etichettati, heading, label, `th scope`, progressbar |
| 1.3.2 Sequenza significativa | ✅ | ordine DOM = ordine logico |
| 1.3.3 Caratteristiche sensoriali | ✅ | istruzioni sempre con nome testuale, mai solo forma/posizione |
| 1.3.4 Orientamento | ✅ | nessun blocco d'orientamento |
| 1.3.5 Scopo degli input | ✅ | `autocomplete`: nickname, username, one-time-code, email |
| 1.4.1 Uso del colore | ✅ | vita = numeri + barra; eventi = testo; fortezze = nome + colore |
| 1.4.2 Controllo audio | ✅ | interruttori musica/effetti + volume, persistenti |
| 1.4.3 Contrasto minimo | ✅ | axe su 14 stati + calcolo dei casi sopra canvas (fondali .75) |
| 1.4.4 Ridimensionamento | ✅ | zoom 200% senza perdita (pannelli scorrevoli) |
| 1.4.5 Immagini di testo | ✅ | UI tutta in testo reale; il testo nella scena è parte essenziale del gioco |
| 1.4.10 Riflusso | ✅ | media query, larghezze fluide |
| 1.4.11 Contrasto non testuale | ✅ | bordi 12.8:1, barre 11:1, anello di fuoco 5.4:1 |
| 1.4.12 Spaziatura del testo | ✅ | nessuna altezza fissa che tronca; pannelli scorrevoli |
| 1.4.13 Contenuti al passaggio | ✅ | solo tooltip nativi del browser |
| 2.1.1 / 2.1.2 Tastiera, no trappole | ✅ | tutto da tastiera; giro del Tab nei dialoghi + ESC |
| 2.1.4 Scorciatoie a tasto singolo | ✅ | Timoneria: rimappatura completa |
| 2.2.1 / 2.2.2 Tempi e movimento | ✅ | eccezione tempo-reale/essenziale; Mare calmo per il resto |
| 2.3.1 Lampi | ✅ | nessun lampeggiamento oltre soglia |
| 2.4.1 Salto dei blocchi | ✅ | landmark `header`/`main`; heading nei pannelli |
| 2.4.2 Titolo della pagina | ✅ | «Maremagnum — il mare dell'internet» |
| 2.4.3 Ordine del fuoco | ✅ | gestione fuoco nei dialoghi, ripristino all'origine, fuoco stabile nel Cantiere |
| 2.4.4 Scopo dei link | ✅ | link autoesplicativi |
| 2.4.5 Più modalità | N.A. | applicazione a schermata unica |
| 2.4.6 Intestazioni ed etichette | ✅ | h2/h3 descrittivi, label sugli input |
| 2.4.7 Fuoco visibile | ✅ | anello doppio globale |
| 2.4.11 Fuoco non oscurato (min.) | ✅ | nessun elemento fisso copre il fuoco; scroll-in-vista nei pannelli |
| 2.5.1–2.5.4 Puntatore | ✅/N.A. | niente gesti multipunto, niente attivazioni da movimento |
| 2.5.7 Trascinamenti | N.A. | nessun trascinamento richiesto (zoom: rotella O tasto) |
| 2.5.8 Dimensione dei target | ✅ | bottoni ≥24px (regola axe `target-size` verde), checkbox 24px |
| 3.1.1 / 3.1.2 Lingua | ✅ | `lang="it"`, contenuti in italiano |
| 3.2.1–3.2.4 Prevedibilità | ✅ | nessun cambio di contesto a sorpresa; componenti coerenti |
| 3.2.6 Aiuto coerente | ✅ | Manuale 📜 sempre nella barra in alto |
| 3.3.1–3.3.3 Errori | ✅ | messaggi testuali chiari e annunciati (`role="status"`) con suggerimento |
| 3.3.4 Prevenzione errori | N.A. | nessuna transazione legale/finanziaria reale |
| 3.3.7 Inserimenti ridondanti | ✅ | dominio del riscatto precompilato dall'isola corrente |
| 3.3.8 Autenticazione accessibile | ✅ | incolla libero, `one-time-code`, nessun test cognitivo |
| 4.1.2 Nome, ruolo, valore | ✅ | ARIA completa su tutti i controlli custom |
| 4.1.3 Messaggi di stato | ✅ | status/log/alertdialog |

(4.1.1 Parsing è formalmente obsoleto nelle WCAG 2.2.)

## AAA: il fattibile, dichiarato

| Criterio | Stato |
|---|---|
| 1.4.7 Audio di sottofondo | ✅ l'audio si spegne |
| 2.1.3 Tastiera (senza eccezioni) | ✅ ogni funzione è operabile da tastiera |
| 2.2.6 Timeout | ✅ i 30 giorni dell'Ancoraggio sono dichiarati dove si crea il conto |
| 2.3.2 Tre lampi | ✅ nessun lampo |
| 2.3.3 Animazioni da interazione | ✅ Mare calmo + `prefers-reduced-motion` |
| 2.4.9 Scopo dei link (solo link) | ✅ |
| 2.4.10 Intestazioni di sezione | ✅ ogni sezione del Manuale e dei pannelli ha il suo heading |
| 2.4.13 Aspetto del fuoco | ✅ 3px, ≥3:1, ben oltre l'area minima |
| 2.5.6 Meccanismi di input concorrenti | ✅ mouse, tastiera e touch convivono |
| 3.2.5 Cambiamenti su richiesta | ✅ |
| 3.3.9 Autenticazione (avanzata) | ✅ come 3.3.8: nessun test cognitivo grazie a incolla/autofill |

**Non dichiarati** (e perché): 1.4.6/1.4.8 (contrasto 7:1 e presentazione
visiva: la tavolozza pergamena supera 7:1 sui testi principali ma non
ovunque), 2.2.3 (il PvP in tempo reale È il gioco), 2.4.12 (la barra azioni
sticky del Cantiere può lambire l'elemento a fuoco), 2.5.5 (44px non su
tutti i controlli secondari), 3.1.3–3.1.6 (il lessico corsaro è spiegato nel
Manuale, ma senza glossario puntuale).

## Limiti noti

- La **scena** sul canvas (posizioni, rotte, combattimento) non ha un
  equivalente non-visivo in tempo reale: è il limite riconosciuto dei giochi
  d'azione (nota W3C/WAI sui web games). Tutto lo stato persistente e gli
  esiti passano dall'interfaccia accessibile.
- Le barre di ricarica cambiano più volte al secondo: sono `aria-hidden`, lo
  stato di pronto-al-fuoco non è annunciato (sarebbe rumore continuo).
