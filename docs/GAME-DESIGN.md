# Maremagnum (già "Navigare il Web") — Game Design (v0.2)

*Sistema di armi, economia, fortezze-blocklist, missioni. Aggiornato 2026-07-04.*

## Fortezze Proibite = blocklist oisd

- Fonte: **oisd NSFW** (`https://nsfw.oisd.nl/abp`, ~370k domini, formato ABP `||dominio^`).
  Scaricata e cacheata dal server in `server/data/` al primo avvio, refresh se più
  vecchia di 7 giorni. Fallback: lista minima hardcoded se la rete manca.
- Match con sottodomini (`x.y.example.com` → blocca se `example.com` è in lista).
- **Il blocco è reale**: a una fortezza attiva NON si può attraccare. Il sito è
  irraggiungibile finché le difese sono in piedi.
- **Espugnazione**: distruggere TUTTE le difese contemporaneamente (hanno regen e
  ricostruzione, quindi serve coordinazione o una nave endgame). Chi abbatte
  l'ultima difesa "espugna" la fortezza: **il blocco si disattiva per lui, per
  sempre** (persistito nel profilo) + taglia di 1500 crediti. Per tutti gli altri
  la fortezza si ricostruisce dopo 8 minuti.

### Arsenale della fortezza (esagerato di proposito)

| Difesa | Quante | HP | Danno | Gittata | Note |
|---|---|---|---|---|---|
| Torre Colossale | 8 | 650 | 55 | 640 | mira predittiva, ricarica 1,5s, regen 4/s |
| Bombarda | 2 | 800 | 85 ad area (r 90) | 820 | proiettili lenti e visibili: si schivano |
| Specchio Ustorio | 1 | 1000 | 12 ogni 0,35s (raggio continuo) | 440 | il "laser" di Archimede sul mastio |

Un principiante con 2 colubrine fa 16 danni ogni 2s: contro 650 hp con regen è
matematicamente senza speranza — come richiesto.

## Armi della nave

**Slot (mount)**: sinistra e destra partono con **1 cannone**; espandibili fino a
**5 per lato**, **2 a prua**, **2 a poppa**. Ogni slot ospita un'arma con livelli
1→3; al livello 3 la si può **sostituire col tier successivo** (si paga il prezzo
pieno del nuovo tier).

| Tier | Arma | Danno | Gittata | Ricarica | Prezzo | Note |
|---|---|---|---|---|---|---|
| 1 | Colubrina | 8 (+3/lvl) | 270 (+25) | 2,0s (−0,15) | 120 | |
| 2 | Cannone da 24 | 16 (+5) | 330 (+30) | 2,3s (−0,15) | 360 | |
| 3 | Carronata | 34 (+9) | 230 (+20) | 2,6s (−0,2) | 1080 | corta ma cattiva |
| 4 | Mortaio | 28 (+8) ad area r 70 | 500 (+45) | 4,2s (−0,3) | 3240 | tiro a campana |
| 5 | Organo di Da Vinci | 9×3 raffica (+3) | 350 (+30) | 1,3s (−0,1) | 9700 | endgame |

Potenziamento livello: `prezzo_tier × 0,5 × livello_attuale`.
Slot aggiuntivi: fianchi 200/500/1200/2500; prua e poppa 400/1000.

**Comandi indipendenti**: `Q` fiancata sinistra, `E` fiancata destra,
`SPAZIO` prua+poppa, `F` attracca/salpa. Ricariche separate per gruppo (HUD: 4 barre).

## Economia dei crediti

| Fonte | Crediti |
|---|---|
| Affondare un giocatore | 60 + 25% del suo oro |
| Mercantile (PNG) | 40–100 |
| Corsaro Fantasma (PvE) | 180–280 |
| Prima scoperta di un'isola | 25 |
| Missione personale | 100–250 |
| Assedio vinto | 400 (100 di consolazione) |
| Espugnare una Fortezza | 1500 |

Scafo e vele restano potenziamenti della nave (4 livelli, 90×2^lvl).

## Missioni

**Personali** (una attiva, riassegnata al completamento): "Attracca a un'isola
.org/.edu/.gov", "Scopri N isole nuove", "Affonda N mercantili", "Affonda un
Corsaro Fantasma". Progresso via eventi dock/kill.

**Assedio (dungeon PvP)**: alla Bacheca del Porto Franco. Un'isola bersaglio;
**Corridori** devono attraccarci, **Bloccatori** impedirlo per 4 minuti.
Lobby (≥1 per ruolo) → conto alla rovescia 30s → battaglia. Un solo assedio
attivo per server.

**PvE**: 2 **Corsari Fantasma** pattugliano il mare: puntano il giocatore più
vicino, si mettono al traverso e sparano bordate; fuggono sotto il 30% di scafo.
