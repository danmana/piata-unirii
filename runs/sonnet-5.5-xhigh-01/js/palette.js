/* Piata Unirii — voxel material palette. Every voxel is a palette index; each entry belongs to a render pool. */
(function () {
  'use strict';
  const PU = window.PU;

  const POOL = { STONE: 0, PLASTER: 1, TERRA: 2, BRONZE: 3, VEG: 4, PAVE: 5, GLASS: 6, WATER: 7, MISC: 8 };
  const POOL_NAMES = ['stone', 'plaster', 'terracotta', 'bronze', 'vegetation', 'pavement', 'glass', 'water', 'misc'];
  const EM = { NONE: 0, WINDOW: 1, LAMP: 2, WARM: 3, CLOCK: 4, FLOOD: 5, ACCENT: 6 };
  PU.POOL = POOL;
  PU.POOL_NAMES = POOL_NAMES;
  PU.EM = EM;

  const list = [null];
  const M = {};
  const R = new Uint8Array(256), G = new Uint8Array(256), B = new Uint8Array(256);
  const PL = new Uint8Array(256), EMI = new Uint8Array(256), TINT = new Uint8Array(256);

  function def(name, hex, pool, em, tint) {
    const idx = list.length;
    if (idx > 255) throw new Error('palette overflow');
    const c = PU.hex(hex);
    list.push({ name, hex });
    M[name] = idx;
    R[idx] = c[0];
    G[idx] = c[1];
    B[idx] = c[2];
    PL[idx] = pool;
    EMI[idx] = em || 0;
    TINT[idx] = tint ? 1 : 0;
    return idx;
  }
  const P = POOL;

  /* ---- stone ---- */
  def('limestone', 0xd8c8a3, P.STONE);
  def('limestoneLt', 0xe6d9b8, P.STONE);
  def('limestoneDk', 0xbfae8a, P.STONE);
  def('limestoneWeather', 0xa89772, P.STONE);
  def('recess', 0x7a6d58, P.STONE);
  def('recessDk', 0x4e4536, P.STONE);
  def('stoneWeather', 0xa89e89, P.STONE);
  def('greyStone', 0xb1ada3, P.STONE);
  def('greyStoneLt', 0xcbc7bd, P.STONE);
  def('greyStoneDk', 0x8a877f, P.STONE);
  def('whiteStone', 0xeee8da, P.STONE);
  def('basement', 0xa39b8a, P.STONE);
  def('sandstone', 0xd1b98a, P.STONE);
  def('pedestal', 0xd6cdb6, P.STONE);
  def('pedestalDk', 0xaaa38f, P.STONE);
  def('romanStone', 0x9d9686, P.STONE);
  def('romanStoneDk', 0x766f61, P.STONE);
  def('rustic', 0xbdb39c, P.STONE);

  /* ---- plaster ---- */
  def('cream', 0xecdfc0, P.PLASTER);
  def('ivory', 0xf2ebd6, P.PLASTER);
  def('paleYellow', 0xe9d79c, P.PLASTER);
  def('ochre', 0xd3ab66, P.PLASTER);
  def('beige', 0xe2d3b1, P.PLASTER);
  def('dustyPink', 0xd8aa9c, P.PLASTER);
  def('palePink', 0xe4c3b6, P.PLASTER);
  def('paleGreen', 0xbccaa7, P.PLASTER);
  def('fadedGreen', 0xa1b594, P.PLASTER);
  def('softGrey', 0xcbc7bd, P.PLASTER);
  def('paleBlueGrey', 0xbcc4c5, P.PLASTER);
  def('salmon', 0xdc9f7c, P.PLASTER);
  def('sand', 0xdcc79b, P.PLASTER);
  def('darkCream', 0xd6c9a6, P.PLASTER);
  def('lightOchre', 0xe0bc7a, P.PLASTER);
  def('mint', 0xc6d6bc, P.PLASTER);
  def('lilacGrey', 0xc9c0c4, P.PLASTER);
  def('whitePlaster', 0xf4f0e6, P.PLASTER);
  def('houseWall', 0xe9e1d0, P.PLASTER, 0, true);

  /* ---- terracotta / roofs ---- */
  def('roofOrange', 0xb8683f, P.TERRA);
  def('roofTerra', 0xae603f, P.TERRA);
  def('roofRust', 0x8a4630, P.TERRA);
  def('roofRed', 0x9c4a35, P.TERRA);
  def('roofLight', 0xc47a4c, P.TERRA);
  def('roofBrown', 0x7d4a38, P.TERRA);
  def('churchRoofA', 0xae4a26, P.TERRA);
  def('churchRoofB', 0xbb5a2c, P.TERRA);
  def('churchRoofC', 0x9c3f20, P.TERRA);
  def('ridgeCap', 0x7c3418, P.TERRA);
  def('brick', 0x9b4a36, P.TERRA);
  def('brickDk', 0x7c3a2a, P.TERRA);
  def('houseRoof', 0xc0623a, P.TERRA, 0, true);

  /* ---- bronze / metal ---- */
  def('bronzeDark', 0x3b3125, P.BRONZE);
  def('bronzeMid', 0x55442f, P.BRONZE);
  def('bronzeGreen', 0x4e6a5b, P.BRONZE);
  def('bronzeHi', 0x7d6c49, P.BRONZE);
  def('bronzePatina', 0x6a8b78, P.BRONZE);
  def('gold', 0xcaa44c, P.BRONZE);
  def('iron', 0x27272b, P.BRONZE);
  def('ironLt', 0x44454a, P.BRONZE);
  def('spireSlate', 0x5a616c, P.BRONZE);
  def('spireLt', 0x7b8590, P.BRONZE);
  def('slateRoof', 0x4b5058, P.BRONZE);
  def('zincRoof', 0x6e747c, P.BRONZE);
  def('copperGreen', 0x6f9080, P.BRONZE);
  def('darkSlate', 0x3c4048, P.BRONZE);

  /* ---- vegetation ---- */
  def('leafA', 0x587545, P.VEG);
  def('leafB', 0x66854a, P.VEG);
  def('leafC', 0x486a3c, P.VEG);
  def('leafD', 0x76935a, P.VEG);
  def('leafE', 0x809c62, P.VEG);
  def('leafDark', 0x3f5a2e, P.VEG);
  def('lindenA', 0x62804a, P.VEG);
  def('lindenB', 0x728f52, P.VEG);
  def('planeA', 0x6d8850, P.VEG);
  def('planeB', 0x627d47, P.VEG);
  def('blossom', 0xd9b3b8, P.VEG);
  def('redLeaf', 0x7d5044, P.VEG);
  def('grass', 0x739450, P.VEG);
  def('grassDk', 0x60804c, P.VEG);
  def('grassLt', 0x86a25f, P.VEG);
  def('lawn', 0x7c9a58, P.VEG);
  def('trunk', 0x5b4a3a, P.MISC);
  def('trunkLt', 0x8b8072, P.MISC);
  def('trunkPlane', 0xa89f8c, P.MISC);
  def('flowerRed', 0xb0504d, P.VEG);
  def('flowerYel', 0xd6b64a, P.VEG);
  def('flowerWhite', 0xe6e2d6, P.VEG);
  def('hedge', 0x4f6b3a, P.VEG);
  def('forestA', 0x3f5a3a, P.VEG);
  def('forestB', 0x37523a, P.VEG);
  def('forestC', 0x486543, P.VEG);
  def('fieldA', 0x9fa56e, P.VEG);
  def('fieldB', 0x94a068, P.VEG);
  def('fieldC', 0xaaa878, P.VEG);
  def('farGrass', 0x74905f, P.VEG);

  /* ---- pavement ---- */
  def('plazaGrey', 0xc4bfb4, P.PAVE);
  def('plazaBeige', 0xd3c6aa, P.PAVE);
  def('plazaPale', 0xd9d3c4, P.PAVE);
  def('plazaBand', 0xaaa598, P.PAVE);
  def('sidewalk', 0xbdb8ac, P.PAVE);
  def('sidewalkLt', 0xcbc6ba, P.PAVE);
  def('road', 0x8d8983, P.PAVE);
  def('roadDk', 0x77746f, P.PAVE);
  def('roadLine', 0xe0dccf, P.PAVE);
  def('curb', 0xccc6b9, P.PAVE);
  def('path', 0xd0c29f, P.PAVE);
  def('gravel', 0xc9bb97, P.PAVE);
  def('step', 0xd0cab9, P.PAVE);
  def('stepEdge', 0xb8b2a3, P.PAVE);
  def('courtyard', 0xa8a297, P.PAVE);
  def('dirt', 0x8a7a62, P.PAVE);

  /* ---- glass ---- */
  def('glassDay', 0x3e5a70, P.GLASS);
  def('glassDay2', 0x47647a, P.GLASS);
  def('glassDay3', 0x33495c, P.GLASS);
  def('glassLit', 0xffd08a, P.GLASS, EM.WINDOW);
  def('glassLit2', 0xffc070, P.GLASS, EM.WINDOW);
  def('glassShop', 0x4c6b7a, P.GLASS);
  def('glassShopLit', 0xffdca0, P.GLASS, EM.WINDOW);
  def('glassChurch', 0x4a5f82, P.GLASS);
  def('glassChurchLit', 0xe9b96c, P.GLASS, EM.WINDOW);
  def('clockFace', 0xf0e8d2, P.GLASS, EM.CLOCK);
  def('glassRoman', 0x2a3a44, P.GLASS);
  def('glassRomanPane', 0x35505c, P.GLASS, 7);
  def('glassApt', 0x6b8794, P.GLASS);

  /* ---- water ---- */
  def('waterA', 0x6f909f, P.WATER);
  def('waterB', 0x5f8090, P.WATER);
  def('waterTable', 0x7ea3b2, P.WATER);
  def('waterRoman', 0x4a5e66, P.WATER);

  /* ---- misc: wood, fabric, paint, vehicles ---- */
  def('doorWood', 0x5a3d28, P.MISC);
  def('woodDk', 0x4a3626, P.MISC);
  def('woodMid', 0x7c5b3a, P.MISC);
  def('woodLt', 0xa98358, P.MISC);
  def('awnRed', 0xa4483a, P.MISC);
  def('awnGreen', 0x5b7d5f, P.MISC);
  def('awnBlue', 0x4a6382, P.MISC);
  def('awnCream', 0xe5dcc3, P.MISC);
  def('umbCream', 0xe9e0c8, P.MISC);
  def('umbRed', 0x9e4437, P.MISC);
  def('umbGreen', 0x5f7f62, P.MISC);
  def('umbBlue', 0x4d6480, P.MISC);
  def('umbOchre', 0xc99a4a, P.MISC);
  def('fabricWhite', 0xeae6dc, P.MISC);
  def('flagBlue', 0x2b4a8c, P.MISC);
  def('flagYellow', 0xe0b83a, P.MISC);
  def('flagRed', 0xb8322f, P.MISC);
  def('carBody', 0xdedcd6, P.MISC, 0, true);
  def('carWhite', 0xe2e2e0, P.MISC);
  def('carTaxi', 0xe4bf4a, P.MISC);
  def('carBlack', 0x2d2f33, P.MISC);
  def('tyre', 0x1e1e20, P.MISC);
  def('headlamp', 0xf3ecd0, P.MISC);
  def('tailLamp', 0x9a2d2a, P.MISC);
  def('busWhite', 0xe8e8e4, P.MISC);
  def('busStripe', 0x3a7f52, P.MISC);
  def('vanBody', 0xe6e6e2, P.MISC, 0, true);
  def('earth', 0x6b5a45, P.MISC);
  def('voidDark', 0x2b2723, P.STONE);
  def('lampGlow', 0xfff0c0, P.MISC, EM.LAMP);
  def('floodGlow', 0xfff0c8, P.MISC, EM.FLOOD);
  def('warmGlow', 0xf0a458, P.MISC, EM.WARM);
  def('signCream', 0xe8dfc4, P.MISC);
  def('signGreen', 0x3e6b4f, P.MISC);
  def('signBlue', 0x3a5f8c, P.MISC);
  def('signRed', 0x9c3b32, P.MISC);
  def('bikeFrame', 0x3f5a6b, P.MISC);
  def('bikeRed', 0x9e3a30, P.MISC);
  def('concrete', 0xc9c6bf, P.STONE, 0, false);
  def('aptWall', 0xd8d3c8, P.PLASTER, 0, true);
  def('aptBand', 0x6c7f88, P.GLASS);
  def('towerGlass', 0x7d99a8, P.GLASS);
  def('skin', 0xd7a98b, P.MISC);
  def('white', 0xf2f0ea, P.MISC);
  def('black', 0x1a1a1c, P.MISC);

  /* actor colour slots: red channel encodes the slot; the actor vertex shader substitutes real colours per instance */
  for (let s = 1; s <= 15; s++) def('slot' + s, s << 16, P.MISC);

  PU.M = M;
  PU.PALLIST = list;
  PU.PAL = { r: R, g: G, b: B, pool: PL, em: EMI, tint: TINT };
})();
