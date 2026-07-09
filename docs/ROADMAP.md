# Roadmap del Maremagnum

Le fasi sono **milestone GitHub**; ogni issue è auto-contenuta (visione, stato
attuale con riferimenti al codice, decisioni da prendere, paletti). Le fasi si
sviluppano in ordine; dentro una fase l'ordine è quello elencato. Regola di
bottega per OGNI issue: **analisi → conferma della direzione → implementazione
→ test (protocollo + a11y) → verifica visiva → commit → push → deploy**.

## Il filo logico

1. Prima si ripara ciò che i giocatori vedono rotto oggi (bug isole, cannoni).
2. Poi si GUARDA (audit UX) prima di costruire nuova interfaccia: tutto ciò
   che segue aggiunge UI, e costruirla su fondamenta confuse è rework certo.
3. Poi l'economia nuova (blocco/arrembaggio v1) e le comodità (approdi),
   perché cambiano il gioco quotidiano senza dipendenze pesanti.
4. Poi la voce (Gazzetta) — infrastruttura di cui vivono campagne e gilde.
5. Poi la società (gilde) e la carne (pirati, picchiaduro, platform).
6. L'orizzonte (espansione, flotta, Editor) quando i dati lo chiedono.

## Le fasi

### Fase 0 — Riparare e lucidare (subito, piccole)
| Issue | Cosa | Perché ora |
|---|---|---|
| #12 | Semina persistente delle isole al risveglio | Bug percepito oggi; sblocca #1; dà senso all'Atlante |
| #17 | Redesign dei cannoni a vista | Lamentela viva; quick win visivo, zero dipendenze |

### Fase 1 — Guardare prima di costruire
| #8 | Audit serio UX/UI (percorsi completi, screenshot, euristiche) | Genera issue figlie prioritarie; condiziona OGNI UI successiva (Gazzetta, gilde, bivio del platform, benvenuto) |

Le correzioni prioritarie dell'audit si eseguono subito dopo, prima di Fase 2.

### Fase 2 — Economia e comodità
| #15 | Economia del blocco: 25% subito / tocco→100% / timeout→75%+immunità (senza picchiaduro) | Cambia il cuore del PvP; riconcilia la Stiva; nessuna dipendenza |
| #13 | Approdi preferiti + scelta del punto di partenza | Migliora il gioco quotidiano; tocca il benvenuto → dopo l'audit |

### Fase 3 — La voce del mare
| #4 | Gazzetta del Corsaro (v1 SOLO in gioco: storico, non-letti, per-utente) | Infrastruttura per #3 e #5 |
| #3 | Mastro di Rotte v1 (campagne/dungeon **PvE**; worker + cron + Workers AI solo per lore) | La parte PvP (tornei, taglie fra gilde) è v2, dopo la Fase 4 |
| #36 | ⚠️ BUG: le campagne del Mastro non compaiono in produzione CF (cron/DO a freddo + poca esposizione; non riproducibile in locale) | Blocca la fruizione di #3; fix proposto: auto-seed + refresh MareDO + HUD dedicato |
| #37 | Co-op: alleanze temporanee per affrontare un dungeon in due (party effimero nel MareDO, riusa il pattern lobby/ruoli dell'Assedio) | Estende #3; da costruire da zero; ripensa il premio winner-take-all |
| #38 | Mastro v2: l'AI GENERA i dungeon (PvE+PvP, giornalieri/settimanali/mensili) con vera varietà — bersagli reali, difese, narrazione; il motore blinda SOLO il premio in dobloni (no pay-to-win) | Evoluzione di #3 (chiusa); dipende da #36; modello verso Qwen3-30B, budget ~10k neuron/dì (slug+costo da confermare) |

### Fase 4 — La società dei corsari
| #5 | Gilde: fondazione, categoria, bandiera (decidere PRIMA: editor a componenti vs upload+moderazione), rito d'ingresso, log | Dopo la Gazzetta; abilita il Mastro di Rotte v2 (PvP) |

### Fase 5 — La carne dei pirati (l'epica più costosa) — ⏸ IN ATTESA dei file del game designer
| #16 | Pipeline personaggi (⏸ i personaggi useranno gli asset del designer; prototipi bake-3D/2D agli atti) | Fondazione unica per #7 e #10 |
| #7 | Roster sbloccabile + picchiaduro d'arrembaggio | Dopo #16 |
| #6 | Arrembaggio completo: il tocco di #15 apre il duello | Dopo #7 |
| #10 | Il tesoro nell'entroterra (platform da URL profondi + premio) | Riusa #16; il bivio d'attracco disegnato secondo l'audit #8 |

**Mentre si aspettano i file**: #23 ✓ → #24 ✓ → #11 ✓ → #25 ✓ → #27 ✓ (Cartellone OG). La coda d'attesa è ESAURITA: si riparte coi file del designer (F5), oppure #28 (economics, analisi), #14 (a dati) o #1 (anticipabile per business). Gli economics (#28) bloccano ogni pagamento vero (#25 v2, #1).

### Fase 6 — L'orizzonte largo
| #14 | Espansione del mondo | **A dati, non a calendario**: quando l'Atlante sopra soglia supera ~60-80 isole |
| #11 | ✓ CHIUSA — Flotta più ricca + matrice armi per tipo + Sciabecco (4° tipo) | Riscatto pieno onorato; grandfathering slot |
| #25 | ✓ CHIUSA (v1 a dobloni) — Negozio Livree + Registro + vessillo; skin personaggi con #16/#7, mercato v2 dopo #28 | pay to show, mai pay to win; niente casse |
| #28 | Il modello economico (faucet/sink, denaro vero, Stripe, VAT) | Blocca Stripe in #25 v2 e #1 |
| #1 | Editor dell'Isola (riscatto a pagamento) | Richiede #12 (persistenza ✓); può essere ANTICIPATA per decisione di business |
| #35 | Isole vive: il tipo di sito genera aspetto + vita (SimCity delle isole) | Evoluzione del filo #27→#35→#1; vita client-side procedurale; bloccata sugli asset #16; ispirazione dat.city |

## Il restyle (issue #32, IN CORSO — strati di base fatti e deployati 2026-07-06)

Palette battezzata **"Rovere & Cera"**. Metodo pentadimensionale, e SEMPRE giudicare l'insieme (non solo il dettaglio) prima di committare.

**FATTO** (6 approdi, live): **1. Design token unico** — `:root` generato + ponte CSS↔canvas (`game/tokens.json` fonte unica, `palette.js`, a parità di pixel) ✓; **4. Font Atkinson Hyperlegible Next** al posto di Georgia ovunque (CSS + canvas), Pirata One resta il display ✓; **cornice** — borchie d'ottone + vignetta su pannelli/classifica/mappa ✓; **bottoni** — placche d'ottone tattili + gerarchia primario oro / secondario legno / link ✓; **grana di carta** — rumore SVG sottile in multiply ✓.

**RESTA**: **2. Audit estetico** per-componente sul base ormai fermo (toast, pillole HUD, card, righe di lista, header pannello); disciplina dei **3 accenti** (mossa #4: il viola dei tier-up e il salvia dell'add-slot sono accenti "alieni" da valutare); **3. UX/UI** densità/gerarchia/ritmo; **5. README** completo it/en.

## Multilingua IT/EN (issue #33, AVVIATO 2026-07-06)

Macchina i18n fatta in casa (`game/src/i18n.js`: `t(chiave, params)`, dizionari it/en, `applyI18n` sui marcatori `data-i18n*`, selettore lingua in Impostazioni, default profilo→`?lang=`→`navigator.language`, `<html lang>` runtime). **FATTO**: la plancia (topbar) in it/en, a parità di stringa italiana. **RESTA**: estrarre gli altri componenti man mano che l'audit #32 li tocca (una volta sola). **Nodo chiave** ancora da confermare: i messaggi che il server manda a TUTTI (feed/Gazzetta) — direzione consigliata: EVENTI STRUTTURATI, ogni client compone la frase nella propria lingua (Gazzetta persistente inclusa).

## Le ispirazioni (registrate 2026-07-05, da approfondire — MAI sviluppare senza conferma)

- **Sid Meier's Pirates! (2004)** → battaglie navali (**#29**); attinge anche il PvE.
- **Policenauts** → modalità storia / PvE (**#30**), in mix and match con Pirates!.
- **Cutthroat Island** → platform d'entroterra: livello → tesoro = dobloni + URL profondo (annotata su #10).
- **Picchiaduro** (riferimento DA SCEGLIERE, ricerca **#31**) → arrembaggio: 25% o abbordaggio col roster (annotata su #6/#7; #31 blocca il design di #7).
- **dat.city** (*World Data Playground*, ispirazione estetica) → isole vive alla SimCity: il tipo di sito genera aspetto e vita dell'isola (**#35**). Da dat.city si prende la vita procedurale e gli archetipi, NON la meccanica (dat.city è "classifica→skyline", non "URL→mondo").

## Epiche

- **#9 — Il mare è uno solo** → #12 (F0), #13 (F2), #14 (F6). Si chiude con le figlie.
- **#6 — L'arrembaggio** → #15 (F2, economia) + #6 (F5, duello).
- **#11 — La flotta cresce** → #17 (F0, cannoni ✓) + #11 (F6, scafi e armi ✓). Chiusa.
- **La carne dei pirati** → #16 → #7 → #6 → #10 (tutta Fase 5).

## Dipendenze dure (da non violare)

```
#12 ──→ #1          #4 ──→ #3(v1) ──→ #3(v2)
#8  ──→ #13, #10(bivio), e ogni UI nuova       #4 ──→ #5 ──→ #3(v2)
#15 ──→ #6          #16 ──→ #7 ──→ #6          #16 ──→ #10
```

## Paletti trasversali (valgono per ogni issue)

- Solo piano gratuito Cloudflare; il mare dorme quando è vuoto.
- Prezzi esponenziali a ogni gradino; ricompense PvE magre e fisse.
- Protocollo e snapshot SOLO additivi (i client vecchi ignorano, mai rompono).
- Chi perde qualcosa che ha pagato viene riscattato al prezzo PIENO.
- Conformità WCAG 2.2 AA da non far regredire (npm run test:a11y nel ciclo).
- Test di protocollo per ogni meccanica server; verifica visiva per ogni pixel.
