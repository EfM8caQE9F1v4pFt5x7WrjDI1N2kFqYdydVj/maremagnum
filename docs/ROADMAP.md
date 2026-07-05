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

### Fase 4 — La società dei corsari
| #5 | Gilde: fondazione, categoria, bandiera (decidere PRIMA: editor a componenti vs upload+moderazione), rito d'ingresso, log | Dopo la Gazzetta; abilita il Mastro di Rotte v2 (PvP) |

### Fase 5 — La carne dei pirati (l'epica più costosa) — ⏸ IN ATTESA dei file del game designer
| #16 | Pipeline personaggi (⏸ i personaggi useranno gli asset del designer; prototipi bake-3D/2D agli atti) | Fondazione unica per #7 e #10 |
| #7 | Roster sbloccabile + picchiaduro d'arrembaggio | Dopo #16 |
| #6 | Arrembaggio completo: il tocco di #15 apre il duello | Dopo #7 |
| #10 | Il tesoro nell'entroterra (platform da URL profondi + premio) | Riusa #16; il bivio d'attracco disegnato secondo l'audit #8 |

**Mentre si aspettano i file** (ordine consigliato): #23 (morte racconta) → #24 (Cantiere con gerarchia) → #11 (flotta più ricca) → #25 (collezioni e livree).

### Fase 6 — L'orizzonte largo
| #14 | Espansione del mondo | **A dati, non a calendario**: quando l'Atlante sopra soglia supera ~60-80 isole |
| #11 | Flotta più ricca + armi ridistribuite per tipo (tappe 1-2) | Riscatto pieno obbligatorio per le armi tolte (precedente del varo) |
| #25 | Collezioni e Negozio delle Livree: **pay to show, mai pay to win** (modello CS) | Dopo #11 e #24; niente casse cieche (loot box = gambling in mezza UE); stessa infrastruttura di pagamento della #1 |
| #1 | Editor dell'Isola (riscatto a pagamento) | Richiede #12 (persistenza ✓); può essere ANTICIPATA per decisione di business |

## Epiche

- **#9 — Il mare è uno solo** → #12 (F0), #13 (F2), #14 (F6). Si chiude con le figlie.
- **#6 — L'arrembaggio** → #15 (F2, economia) + #6 (F5, duello).
- **#11 — La flotta cresce** → #17 (F0, cannoni) + #11 (F6, scafi e armi).
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
