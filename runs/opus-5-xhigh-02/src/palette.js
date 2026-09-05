// Material registry.
//
// A voxel stores a single byte: an index into this registry. Each entry binds a
// colour to one of the render *groups* below, and every group becomes exactly one
// three.js material (one instancing / draw pool). Colour variation lives in the
// registry rather than per-voxel so that greedy meshing can still merge large runs.

export const GROUPS = [
  'stone',       // limestone, ashlar, kerbs, pedestals
  'plaster',     // rendered facades
  'terracotta',  // clay roof tiles
  'bronze',      // statuary
  'vegetation',  // foliage, grass, planters
  'pavement',    // plaza and street surfaces
  'glass',       // dark glazing
  'glasslit',    // glazing that glows after sundown
  'water',       // fountains, water tables
  'metal',       // zinc roofs, railings, lamp posts
  'wood',        // doors, benches, cafe furniture
  'lamp',        // emissive lamp heads and under-glass lighting
];

export const EMPTY = 0;
export const HIDDEN = 1; // solid for occlusion, never rendered

const MAX = 255;

class Registry {
  constructor() {
    this.group = new Uint8Array(MAX + 1);
    this.r = new Uint8Array(MAX + 1);
    this.g = new Uint8Array(MAX + 1);
    this.b = new Uint8Array(MAX + 1);
    this.opaque = new Uint8Array(MAX + 1);
    this.n = 2; // 0 = empty, 1 = hidden filler
    this.opaque[HIDDEN] = 1;
    this.cache = new Map();
    this.overflow = 0;
  }

  groupIndex(name) {
    const i = GROUPS.indexOf(name);
    if (i < 0) throw new Error('unknown material group: ' + name);
    return i;
  }

  // Register (or reuse) a colour inside a group. Colours are quantised to 5 bits per
  // channel so that hand-written hex values that are visually identical collapse into
  // one id and the 8-bit voxel budget is not wasted.
  reg(group, hex) {
    let r, g, b;
    if (typeof hex === 'string') {
      const h = hex.replace('#', '');
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    } else {
      r = (hex >> 16) & 255; g = (hex >> 8) & 255; b = hex & 255;
    }
    r = Math.min(255, r & 0xf8 | 4); g = Math.min(255, g & 0xf8 | 4); b = Math.min(255, b & 0xf8 | 4);
    const key = group + ':' + r + ',' + g + ',' + b;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    if (this.n > MAX) {
      // Never fail generation: fall back to the closest already-registered colour.
      this.overflow++;
      let best = 2, bestD = Infinity;
      const gi = this.groupIndex(group);
      for (let i = 2; i <= MAX; i++) {
        if (this.group[i] !== gi) continue;
        const d = (this.r[i] - r) ** 2 + (this.g[i] - g) ** 2 + (this.b[i] - b) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      this.cache.set(key, best);
      return best;
    }
    const id = this.n++;
    this.group[id] = this.groupIndex(group);
    this.r[id] = r; this.g[id] = g; this.b[id] = b;
    this.opaque[id] = (group === 'glass' || group === 'glasslit' || group === 'water') ? 0 : 1;
    this.cache.set(key, id);
    return id;
  }
}

export const M = new Registry();
const reg = (grp) => (hex) => M.reg(grp, hex);

export const stone = reg('stone');
export const plaster = reg('plaster');
export const tile = reg('terracotta');
export const bronze = reg('bronze');
export const leaf = reg('vegetation');
export const paving = reg('pavement');
export const glass = reg('glass');
export const litglass = reg('glasslit');
export const water = reg('water');
export const metal = reg('metal');
export const wood = reg('wood');
export const lamp = reg('lamp');

// ---------------------------------------------------------------------------
// Named palette. Transylvanian old-town: warm limestone, cream and ochre plaster,
// burnt-orange clay roofs, weathered bronze, muted greens.
// ---------------------------------------------------------------------------
export const P = {
  // Church — pale weathered limestone with darker aged recesses
  churchStone:      stone('#d9d0ba'),
  churchStoneWarm:  stone('#e2d9c2'),
  churchStoneCool:  stone('#cbc2ad'),
  churchStoneDark:  stone('#a89f8c'),
  churchShadow:     stone('#8d8574'),
  churchTrim:       stone('#e8e0cb'),
  churchRoof:       tile('#b0472a'),
  churchRoofDark:   tile('#a5432a'),
  churchRoofLight:  tile('#ba5130'),
  churchRoofRidge:  tile('#8c3520'),

  // Generic stone
  ashlar:           stone('#cfc6b1'),
  ashlarDark:       stone('#b1a894'),
  greyStone:        stone('#b8b6ae'),
  greyStoneDark:    stone('#95948d'),
  whiteStone:       stone('#e9e4d6'),
  plinth:           stone('#a49b89'),

  // Plaster palette for the historic frontages
  cream:            plaster('#e9dfc7'),
  ivory:            plaster('#efe8d6'),
  paleYellow:       plaster('#e6d49b'),
  ochre:            plaster('#d9b476'),
  ochreDeep:        plaster('#c9a061'),
  beige:            plaster('#ddd0b4'),
  dustyPink:        plaster('#dcbcb2'),
  mutedPink:        plaster('#cfa9a1'),
  paleGreen:        plaster('#c3cbb4'),
  fadedGreen:       plaster('#a9b79c'),
  softGrey:         plaster('#c8c7bf'),
  paleBlueGrey:     plaster('#c2c8c9'),
  sand:             plaster('#e0cfa8'),
  terracottaWash:   plaster('#d9a98a'),
  lilacGrey:        plaster('#c9c1c7'),

  // Roofs
  roofOrange:       tile('#bf5a30'),
  roofTerracotta:   tile('#b45228'),
  roofRust:         tile('#9c4423'),
  roofRed:          tile('#a8442a'),
  roofBrown:        tile('#8f4526'),
  roofPale:         tile('#c96f40'),
  roofDarkMetal:    metal('#565a5e'),
  roofZinc:         metal('#6b7075'),
  roofSlate:        metal('#4d5257'),

  // Bronze
  bronzeDark:       bronze('#443a2c'),
  bronzeMid:        bronze('#5b4c39'),
  bronzeWarm:       bronze('#6c573e'),
  bronzePatina:     bronze('#4e5f4a'),
  bronzePatina2:    bronze('#5b6b52'),

  // Vegetation
  grass:            leaf('#7c9153'),
  grassDark:        leaf('#6b8047'),
  grassLight:       leaf('#8ba05f'),
  leafA:            leaf('#5f7d43'),
  leafB:            leaf('#6d8b4b'),
  leafC:            leaf('#547239'),
  leafD:            leaf('#7d9856'),
  leafE:            leaf('#4a6634'),
  hedge:            leaf('#546f3c'),
  bark:             wood('#5b4a3a'),
  barkLight:        wood('#6d5a46'),

  // Paving
  plazaA:           paving('#beb8a8'),
  plazaB:           paving('#c6c0b0'),
  plazaC:           paving('#b4aea0'),
  plazaBand:        paving('#9e998b'),
  plazaDark:        paving('#948f84'),
  roadStone:        paving('#8f8d87'),
  roadStone2:       paving('#87857f'),
  kerb:             paving('#aeaa9f'),
  sidewalk:         paving('#b2ada0'),
  gravel:           paving('#a89e8c'),
  courtyard:        paving('#a8a496'),
  courtyardDark:    paving('#9d9a8d'),
  soil:             paving('#7d6b52'),

  // Glazing
  windowGlass:      glass('#3a4450'),
  windowGlassDark:  glass('#2d353f'),
  shopGlass:        glass('#41505c'),
  archGlass:        glass('#33404b'),
  litWindow:        litglass('#f2d08a'),
  litWindowWarm:    litglass('#f0c072'),
  romanGlass:       glass('#4b5a63'),

  // Water
  waterDeep:        water('#63757c'),
  waterShallow:     water('#7d8f93'),
  waterJet:         water('#a8b6b7'),

  // Metal & wood
  iron:             metal('#3c3d3f'),
  ironDark:         metal('#2f3032'),
  gold:             metal('#a8873f'),
  copper:           metal('#6a7a63'),
  steel:            metal('#7a7d80'),
  doorWood:         wood('#5a4130'),
  doorWoodDark:     wood('#4a3527'),
  benchWood:        wood('#7a5b3d'),
  cafeWood:         wood('#8a6a45'),
  awningRed:        wood('#8f4a3f'),
  awningGreen:      wood('#4f6b4f'),
  awningCream:      wood('#c6b294'),

  // Emissive
  lampGlow:         lamp('#ffd9a0'),
  lampGlowCool:     lamp('#e8e2c8'),
  romanGlow:        lamp('#e0a860'),
};
