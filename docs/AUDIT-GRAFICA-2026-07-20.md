# Audit grafico — 20 luglio 2026

## Verdetto

Il giudizio «bruttino e senz'anima» è fondato. Il problema non è il numero
di poligoni e non si risolve aggiungendo dettaglio: il gioco mette insieme
cinque linguaggi visivi che, presi separatamente, possono funzionare ma non
sembrano appartenere allo stesso mondo.

1. Interfaccia ricca di pergamena, rovere, ottone e ombre.
2. Mare tonale, scuro e molto vuoto.
3. Isole procedurali piatte e tondeggianti, con edifici minuscoli.
4. Navi e mostri pseudo-3D più dettagliati del paesaggio.
5. Ritratti pittorici realistici e personaggi giocabili low-poly molto
   geometrici.

La conseguenza è che la semplificazione sembra provvisoria, non intenzionale.
La buona grafica low-poly ha poche forme, ma ogni forma dichiara una scelta:
qui molte forme leggono ancora come primitive o placeholder.

## Metodo

Audit eseguito sul client reale a 1440×900, giorno e notte, usando
`scripts/audit-ui.js` e schermate dedicate a mondo, combattimento, zoom,
benvenuto, mappa, Manuale e sovrapposizione dell'HUD. È stata verificata anche
la nuova tavola animata dei 15 pirati e la nuova presenza delle tre fazioni in
mare e nel Manuale.

Questo audit giudica ciò che un giocatore vede alla normale scala di gioco,
non gli asset isolati o la quantità di sistemi già implementati.

## Punteggio attuale

| Area | Voto | Osservazione |
|---|---:|---|
| Coerenza stilistica | 2/5 | UI, mondo, navi e personaggi parlano lingue diverse |
| Silhouette e riconoscibilità | 2/5 | isole e personaggi cambiano nei dettagli, poco nella massa |
| Colore e atmosfera | 3/5 | palette valida, ma poco usata per gerarchia e appartenenza |
| Interfaccia | 3.5/5 | ha carattere, ma sovrasta il mondo ed è troppo cromata durante il gioco |
| Ambiente | 1.5/5 | molto vuoto; il mare è uno sfondo, non un luogo |
| Animazione | 2/5 | sistemi presenti, pose e tempi ancora poco espressivi |
| Identità delle fazioni | 2/5 | ora è leggibile nei simboli, non ancora nelle sagome e nei territori |
| “Anima” complessiva | 1.5/5 | mancano motivi ricorrenti, vita e piccoli racconti visivi |

## Cosa non funziona

### 1. La scena non ha quasi mai un protagonista

In mare aperto gran parte dello schermo è un campo blu uniforme. A zoom
normale una nave è minuscola e la sua targhetta pesa più della nave stessa.
Quando entra un'isola, la sua grande macchia verde prende il centro ma non
offre una gerarchia interna: tre case, pali-molo e un nome non bastano a
trasformarla in un luogo.

Effetto percepito: il giocatore guarda un radar decorato, non un'avventura.

### 2. L'acqua è rumore, non disegno

Le variazioni tonali morbide non costruiscono onde leggibili. Le crestine sono
troppo deboli alla scala normale e le grandi chiazze sembrano una texture
sfocata. Il mare non indica con decisione vento, profondità, pericolo o
vicinanza alla costa.

### 3. Le isole sono proceduralmente diverse ma artisticamente uguali

Il perimetro cambia, però la grammatica resta “chiazza verde + bordo sabbia +
oggetti piccoli al centro”. Mancano scogliere, piani di quota, masse di
vegetazione, coste riconoscibili e un landmark dominante. I moli a stecca
sembrano linee di debug più che costruzioni.

### 4. Le fazioni esistono nei dati più che nel mondo

I nuovi campi di fazione, colori, simboli e ruoli rendono chiaro chi è chi.
È un buon primo strato informativo, ma se si tolgono nome e simbolo una nave
della Compagnia e una della Marina non comunicano ancora due culture diverse.
Non basta tingere un'etichetta: servono vele, rapporto tra scafo e alberi,
prua, pennoni, carico e scia caratteristici.

### 5. I personaggi non appartengono allo stesso gioco

I ritratti sono evocativi ma realistici e ricchi di microdettaglio. Il nuovo
rig condiviso low-poly è una base tecnica utile — idle, corsa, salto e attacco
sono ora riproducibili — ma i corpi sono rettangolari, con proporzioni e pose
molto simili. A scala platform cambiano colore e accessorio più della sagoma.
L'attacco legge come un movimento del braccio, non come una posa firmata.

I ritratti possono restare nei dossier e nel Cantiere. Il personaggio giocabile
deve invece estremizzare testa, mani, cappello, arma, postura e baricentro.

### 6. L'interfaccia ha più “budget artistico” del mondo

Pergamene e cornici comunicano bene il tema piratesco. Durante la navigazione,
però, la barra superiore, le pillole dorate, i pannelli e i messaggi sono più
netti e contrastati di qualsiasi oggetto nel mare. Il campo di ricerca moderno
e arrotondato convive inoltre con titoli corsari e ottone cesellato.

Il Manuale accumula molto testo in una pergamena lunga. Le nuove tre carte di
fazione migliorano il ritmo, ma mostrano anche chiaramente lo stacco tra
ritratto pittorico e mondo piatto.

### 7. Ci sono effetti, ma manca la recitazione

Scie, fumo, bordate, meteo e ciclo giorno/notte sono una buona infrastruttura.
L'azione non ha ancora abbastanza anticipazione, contatto e recupero: il mondo
si muove, ma reagisce poco. Una bordata dovrebbe piegare la nave, strappare
l'acqua e lasciare una conseguenza leggibile; un attracco dovrebbe “chiudere”
la distanza con corde, gabbiani, facchini e luci, non soltanto aprire un
pannello.

## Cosa va conservato

- La palette rovere, cera, pergamena e ottone: è il nucleo più riconoscibile.
- La notte, la nebbia e le lanterne: sono il momento con più atmosfera.
- La cornice nautica, la mappa del tesoro e la minimappa.
- Il mondo deterministico: consente di costruire luoghi coerenti senza
  rinunciare alla generazione procedurale.
- Il roster pittorico: contiene già caratteri e storie da trasferire nelle
  silhouette giocabili.

## Direzione proposta: “diorama nautico dipinto”

Non puntare al realismo. Puntare a miniature intagliate e dipinte, viste su un
mare da carta nautica viva:

- geometrie semplici e sfaccettate, con facce grandi e leggibili;
- luce fissa calda dall'alto a sinistra, ombre compatte e coerenti;
- un bordo scuro o un bevel dipinto molto sottile, uguale per mondo e navi;
- palette limitata per materiale: tre valori per legno, tre per terra, tre per
  acqua, più un solo accento di fazione;
- dettagli concentrati sui contorni e sui landmark, non sparsi come rumore;
- animazioni con pose esagerate e pause leggibili, come un teatrino di legno.

La parola guida è **intenzionale**: anche un quadrilatero va bene se racconta
materiale, direzione della luce e appartenenza.

## Piano di intervento

### P0 — prima di produrre altri asset

Creare una style frame unica a 1440×900 del Porto Franco: protagonista,
isola, tre navi di fazione, acqua, HUD e una bordata. Da questa immagine vanno
estratte regole scritte per silhouette, luce, palette, scala e densità. Non
procedere alla conversione del resto del mondo finché questa fetta non
convince anche senza targhette.

### P1 — il mondo, massimo ritorno visivo

1. Rifare l'acqua con bande direzionali a 2–3 scale, creste disegnate e schiuma
   costiera netta; ridurre le chiazze sfocate.
2. Portare le isole a tre quote: battigia, terra, rilievo/scogliera.
3. Dare a ogni isola un landmark grande almeno quanto il gruppo di edifici
   attuale e cluster di props con vuoti intenzionali.
4. Ingrandire le navi del 20–30% alla scala normale e ridurre il peso delle
   targhette.
5. Costruire tre kit di sagoma: corsari bassi e rapidi, mercantili panciuti e
   carichi, Marina alta e verticale con vele ordinate.

### P2 — personaggi e movimento

1. Conservare lo scheletro e la bake pipeline, ma rifare le proporzioni per
   cinque famiglie di corpo realmente diverse.
2. Dare a ogni pirata un tratto che sopravvive in silhouette: cappello, capelli,
   arma, cappotto, gamba, gobba o postura.
3. Ridisegnare salto e attacco con anticipation/contact/recovery e smear
   controllati; una posa chiave deve essere riconoscibile da ferma.
4. Applicare la stessa luce/materiali del diorama ai ritratti semplificati del
   gameplay; mantenere i ritratti realistici solo nei momenti narrativi.

### P3 — interfaccia e vita

1. Alleggerire l'HUD permanente: meno cornici e oro, più strumenti nautici
   integrati nel mondo.
2. Trasformare il Manuale in doppie pagine brevi, con illustrazione e una
   decisione per pagina.
3. Aggiungere vita per cluster: gabbiani, vele al vento, casse, corde, fumo,
   facchini, boe e relitti. Pochi elementi con comportamento, non decorazione
   uniforme.
4. Dare a ogni luogo una microstoria visiva e un suono firma.

## Criteri di accettazione della nuova fetta

- A 1× e senza testo, un osservatore identifica in un secondo il giocatore,
  il Porto Franco e le tre fazioni.
- Il soggetto occupa una massa sufficiente a guidare l'occhio; non esistono
  schermate ordinarie composte quasi solo da mare vuoto.
- Mondo, navi e personaggi condividono direzione della luce, contrasto dei
  bordi e numero di valori per materiale.
- Il Porto Franco è riconoscibile dalla sola silhouette in una miniatura da
  320 px.
- Ogni pirata del roster è distinguibile in nero pieno almeno dagli altri
  della sua stessa riga.
- Una bordata produce una sequenza leggibile in tre fotogrammi chiave:
  preparazione, impatto, conseguenza.
- L'HUD non è l'elemento più contrastato finché non richiede una decisione.

## Decisione consigliata

Fermare l'espansione orizzontale degli asset dopo le funzionalità già previste
e dedicare il prossimo ciclo a una sola vertical slice. La pipeline attuale è
abbastanza solida; aggiungere altri contenuti nello stile presente renderebbe
solo più costoso correggere l'identità del gioco in seguito.
