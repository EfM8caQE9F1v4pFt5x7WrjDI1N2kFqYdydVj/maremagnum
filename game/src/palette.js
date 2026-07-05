// Ponte CANVAS della fonte di verità unica dei colori (game/tokens.json, issue #32).
// La UI pesca i token via :root (game/tokens.css, generato); il mondo dipinto li
// pesca QUI come interi 0x per PixiJS. Un cambio di palette si fa in UN posto solo.
//
// Tela smorzata (DREDGE/Sunless Sea): gli accenti accesi (oro/rotta/HP/fuoco)
// restano SOLO dove parlano al gameplay. 'gold' è condiviso con la UI (color.gold).

import tokens from '../tokens.json';

const int = (hex) => parseInt(hex.slice(1), 16); // '#rrggbb' → 0xrrggbb

// stringhe hex per nome semantico, per chi disegna su Canvas2D (mapgen, texture)
export const PAL = { ...tokens.color };

// interi 0x per PixiJS: la palette semantica del mondo (era COL in render.js)
export const COL = { gold: int(tokens.color.gold) };
for (const [nome, hex] of Object.entries(tokens.canvas)) COL[nome] = int(hex);
