# Audit UX/UI — Maremagnum (issue #8, Fase 1)

**Metodo.** Percorso completo del nuovo arrivato pilotato sull'app vera
(`scripts/audit-ui.js`, esteso per questa issue): benvenuto → primo minuto →
prima rotta → attracco (Porto e isola-sito) → Cantiere/varo → assedi →
combattimento → morte → Manuale → notte fonda. 24 stati fotografati, giorno e
notte, con lettura critica per passo (gerarchia visiva, affollamento,
onboarding, coerenza dei linguaggi, leggibilità di combattimento), euristiche
di Nielsen sulle schermate chiave e verifica una per una delle 5 ipotesi di
confusione della issue. Gli stati irraggiungibili in locale (ancoraggio senza
Conti, ingorgo dell'HUD) sono messi in scena via DOM come nel test a11y.
Personas e paletti estetici come in [AUDIT-VISIVO.md](AUDIT-VISIVO.md):
l'estetica Monkey Island non si tocca, si chiarisce.

Archivio visivo (prima/dopo dei primi 5 interventi):
https://claude.ai/code/artifact/4196491a-383c-4d1b-b183-3bf0e526a73c

## Le 5 ipotesi della issue, verificate

| Ipotesi | Verdetto | Prova |
|---|---|---|
| Troppi overlay sovrapponibili | **CONFERMATA** | Manuale aperto sopra Impostazioni: due pannelli impilati, ESC li chiude uno alla volta (a16). La Bacheca degli Assedi apre un modale sopra il Cantiere (a8). |
| La barra della rotta non si capisce che è IL browser | **PARZIALE** | Il placeholder aiuta ("wikipedia.org — o una ricerca") ma né il benvenuto né il primo minuto insegnano il gesto fondativo: "scrivi un sito e salpa". Il primo toast parla solo di attracco. |
| Missione/assedio/killfeed si pestano i piedi in alto | **CONFERMATA** | Con assedio attivo + toast + missione + diario: 4 canali testuali simultanei, due dei quali impilati al centro con lo stesso linguaggio a pillola; i colpi subiti stanno nello stesso canale del gossip sociale (a14). |
| Il Cantiere è un muro di bottoni | **PARZIALE** | Ben sezionato (nave → varo → armamenti) ma monotono: 5 righe identiche "90 🪙", nessun "cosa conta ora", gli armamenti vivono sotto due scroll che il novizio non raggiunge; i bottoni disabilitati (slot 400 🪙) sono quasi indistinguibili dagli attivi (a7, a7b). |
| Il Manuale arriva troppo tardi | **PARZIALE, ma c'è di peggio** | Il contenuto è buono e il 📜 è in vista; però il Manuale **si apre già scrollato in fondo** (il fuoco salta al primo campo focalizzabile: il modulo del riscatto) — l'utente non vede mai l'inizio (a13). |

## La nota del capitano: la notte dopo il rialzo

Verificata di persona (n1–n3): isole, navi, scie e HUD leggibili; l'atmosfera
regge. **L'impostazione «Notte chiara» non è necessaria oggi** — da
riconsiderare solo se tornano lamentele (eventualmente accanto a Mare calmo).

## I rilievi

Gravità: ●●● alta · ●●○ media · ●○○ bassa. N# = euristica di Nielsen violata
(1 visibilità dello stato, 2 mondo reale, 4 coerenza, 6 riconoscere>ricordare,
8 minimalismo).

| # | Stato | Rilievo | Euristica | Gravità |
|---|---|---|---|---|
| F1 | b1 | Dietro il benvenuto il mare è NERO e morto: minimappa vuota, HUD scheletrico, acqua ferma — prima impressione "rotto" in un gioco che vende atmosfera | 1, 8 | ●●● |
| F2 | b1, b2 | Troncature sciatte: nome proposto tagliato a metà parola ("Vento Nero la Furi", "Squalo Bianco la F"), placeholder "codice a 6 cif" che non entra nel campo | 4 | ●●○ |
| F3 | b1, a0 | Il gesto fondativo (barra della rotta = browser) non viene mai insegnato: né dal benvenuto né dal primo minuto | 6 | ●●● |
| F4 | a0 | Al secondo 0 due obiettivi in competizione: missione "Affonda 2 mercantili" (che cos'è un mercantile?) + toast "Attracca al Porto Franco" | 6, 8 | ●●○ |
| F5 | a6 | In rotta il dockHint parla del Porto vicino, non della meta scelta; nessuna distanza rimanente | 1 | ●○○ |
| F6 | a6 | Meta fuori schermo: solo linea tratteggiata e X in minimappa, nessun indicatore al bordo dello schermo | 1 | ●●○ |
| F7 | a5 | Mappa del tesoro: "Tu sei qui" si accalca sulla bussola | 8 | ●○○ |
| F8 | a14 | Ingorgo in alto: assedio e toast impilati al centro con la stessa pillola; danno subito e gossip sociale nello stesso diario, stessa gerarchia | 1, 4, 8 | ●●● |
| F9 | a14 | Gli HP stanno in basso a sinistra, lontani dall'azione; a 38% la barra è ancora verde (soglia 0.35) | 1 | ●●○ |
| F10 | a17, a15 | Etichette delle navi bianche su vele bianche: quasi illeggibili (peggio a zoom 2); nessuna distinzione visiva ostile/NPC; nomi che si sovrappongono tra navi vicine | 1 | ●●● |
| F11 | a7, a7b | Cantiere: 5 righe identiche "90 🪙" senza gerarchia né "consigliato ora"; armamenti sotto due scroll; bottoni disabilitati quasi uguali agli attivi | 6, 8 | ●●○ |
| F12 | a8 | Bacheca degli Assedi = modale sopra il modale del Cantiere | 4 | ●●○ |
| F13 | a16 | Due overlay aperti insieme (Manuale sopra Impostazioni): si sovrappongono, ESC li spela uno alla volta | 4 | ●●● |
| F14 | a13 | Il Manuale si apre GIÀ SCROLLATO in fondo: il fuoco (2.4.3) va al primo focalizzabile, il campo del riscatto | 1 | ●●● |
| F15 | a12 | La morte è muta: non dice chi ti ha affondato, quanto hai perso, quanto ha salvato la Stiva, né dà un consiglio | 1 | ●●○ |
| F16 | n1–n3 | Notte post-rialzo: OK (vedi sopra) — nessun intervento | — | — |
| F17 | n1 | Le etichette del mondo ("Porto Franco") finiscono DIETRO il pannello HUD e si perdono | 1 | ●○○ |
| F18 | b1, a16 | La legenda dei comandi resta accesa anche sotto benvenuto e modali: rumore | 8 | ●○○ |

## Priorità (impatto × costo) e primi 5 interventi

| Rango | Intervento | Rilievi | Impatto | Costo |
|---|---|---|---|---|
| 1 | **La disciplina dei pannelli**: un solo overlay alla volta (aprirne uno chiude l'altro), la Bacheca sostituisce il contenuto del Cantiere (o lo chiude), il Manuale si apre dall'INIZIO (fuoco al pannello, non al primo campo) | F13, F12, F14 | alto | basso |
| 2 | **L'ingorgo in alto**: un solo slot centrale con precedenza (assedio > toast), il diario a destra solo per il sociale, i colpi subiti/inflitti vicino alla nave o alla barra HP | F8, F9 | alto | medio |
| 3 | **Nomi leggibili sul mare**: fondino scuro + orlo alle etichette, tinta ostile per i Fantasmi, anti-collisione verticale, mai sotto l'HUD | F10, F17 | alto | medio-basso |
| 4 | **Il benvenuto vivo**: il mare respira dietro la pergamena (acqua avviata prima del join), niente troncature (nome proposto ≤18 compiuto, placeholder corti), una riga che insegna il gesto: "scrivi un sito nella barra e salpa" | F1, F2, F3 | alto | medio |
| 5 | **Il primo minuto guidato**: un obiettivo alla volta (prima "attracca al Porto", la missione arriva DOPO il primo attracco), bussola/freccia di bordo verso la meta con distanza | F4, F5, F6 | medio-alto | medio |

Poi, in coda: la morte che racconta (F15, basso costo), il Cantiere con
gerarchia (F11, costo medio-alto), le pulizie minori (F7, F18).

## Issue figlie proposte (da aprire dopo conferma)

1. `La disciplina dei pannelli: uno alla volta, e il Manuale dall'inizio` — F13+F12+F14 (rango 1; quick win, prima di Fase 2)
2. `L'ingorgo in alto: un solo annuncio al centro, il diario per il sociale, i colpi vicino alla nave` — F8+F9 (rango 2)
3. `Nomi leggibili sul mare: fondino, fazioni, anti-collisione` — F10+F17 (rango 3)
4. `Il benvenuto vivo: mare in movimento, niente troncature, il gesto fondativo insegnato` — F1+F2+F3 (rango 4)
5. `Il primo minuto guidato: un obiettivo alla volta e la bussola della rotta` — F4+F5+F6 (rango 5)
6. `La morte racconta: chi, quanto perso, quanto salvato dalla Stiva` — F15 (coda, piccola)
7. `Il Cantiere con gerarchia: cosa conta ora` — F11 (coda, più grossa)

Ogni figlia ripassa da verifica visiva + `npm run test:a11y` (paletto della
issue: la conformità WCAG 2.2 AA non regredisce).

## Cosa già funziona (da non toccare)

La mappa del tesoro (pergamena e linguaggio); la notte post-rialzo; il
linguaggio di bottega coerente (Cantiere, Bacheca, Oracolo, Gazzetta…); la
schermata dell'assedio coi ruoli spiegati; il flusso d'ancoraggio (QR +
chiave) chiaro; il sito nella dockbar col contatore della Ciurma di Guardia.
