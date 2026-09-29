// Fixed site geometry of Piața Unirii and the old-town street network.
// World frame: +x = east, +z = south, +y = up, metres. Origin ~ centre of the square.

export const SQ = { W: -110, E: 110, N: -80, S: 80 };           // façade lines (220 x 160 m)
export const PLAZA = { x0: -96, x1: 98.5, z0: -68, z1: 68.5 };  // pedestrian plaza (inside the ring road)
export const ROAD_RING = {                                        // perimeter roadway bands
  N: { z0: -75, z1: -68 },
  S: { z0: 68.5, z1: 75.5 },
  E: { x0: 98.5, x1: 105.5 },
  W: { x0: -103, x1: -96 },
};
export const LEVEL = { road: 0, walk: 0.25, terrace: 0.5, church: 0.5 };

// St. Michael's Church: west façade at x = -45, long axis along x, axis at z = -26.
export const CHURCH = { x: -45, z: -26, length: 70.5, width: 24 };
// Tower on the north side at the west end (local x 4..14, local z -22.5..-12)
export const TOWER = { x0: -41.5, x1: -30.5, z0: -49.5, z1: -38 };

// Matthias Corvinus ensemble directly south of the church; horse faces west.
export const MONUMENT = { x: -13, z: 6.5, w: 13, d: 8 };

// Roman Napoca archaeological window (glass over excavated foundations)
export const ARCH = { x0: -49, x1: -38, z0: 18, z1: 23 };

// Contemporary fountain installation in the southern part of the square
export const FOUNTAIN = {
  tables: [
    { x0: 17, x1: 29, z0: 43, z1: 51 },
    { x0: 32, x1: 44, z0: 43, z1: 51 },
    { x0: 47, x1: 59, z0: 43, z1: 51 },
  ],
  jets: { x0: 63, x1: 79, z0: 38, z1: 56, nx: 5, nz: 5 },
  area: { x0: 13, x1: 83, z0: 35, z1: 60 },
};

// Church grounds
export const GROUNDS = {
  platform: { x0: -54, x1: 45, z0: -60, z1: -8 },
  grass: [
    { x0: -27, x1: -3, z0: -58, z1: -44 },
    { x0: 2, x1: 28, z0: -58, z1: -44 },
    { x0: 31, x1: 43, z0: -42, z1: -12 },
    { x0: -52, x1: -44, z0: -58, z1: -50 },
    { x0: 6, x1: 24, z0: -12.5, z1: -10 },
  ],
};

export const TERRACE_Z = 30; // long low seating step; plaza south of it sits 25 cm higher

// Street network. kind: car | ped | boulevard. w = total width incl. sidewalks.
export const STREETS = [
  { id: 'eroilor', name: 'Bulevardul Eroilor', kind: 'boulevard', w: 24, walk: 4, pts: [[104, 68], [170, 70], [260, 75], [360, 82], [470, 90]] },
  { id: 'maniu', name: 'Strada Iuliu Maniu', kind: 'car', w: 12, walk: 3, pts: [[104, 11], [236, 11], [330, 13], [470, 17]] },
  { id: 'dec21', name: 'Bulevardul 21 Decembrie 1989', kind: 'car', w: 12, walk: 2.8, pts: [[104, -74], [200, -75], [320, -80], [470, -88]] },
  { id: 'ferdinand', name: 'Strada Regele Ferdinand', kind: 'car', w: 14, walk: 3, pts: [[105, -74], [106, -150], [115, -250], [127, -360], [138, -470]] },
  { id: 'memo', name: 'Strada Memorandumului', kind: 'car', w: 14, walk: 3.2, pts: [[-100, -73], [-200, -72], [-320, -69], [-470, -64]] },
  { id: 'corvin', name: 'Strada Matei Corvin', kind: 'ped', w: 8, walk: 8, pts: [[-92, -78], [-95, -130], [-104, -190], [-116, -250]] },
  { id: 'napoca', name: 'Strada Napoca', kind: 'car', w: 12, walk: 3, pts: [[-100, 58], [-200, 61], [-300, 72], [-470, 95]] },
  { id: 'univ', name: 'Strada Universității', kind: 'ped', w: 12, walk: 12, pts: [[-104, 72], [-104, 150], [-100, 260], [-96, 400]] },
  // secondary old-town streets (slightly irregular)
  { id: 'n1', kind: 'car', w: 11, walk: 2.5, pts: [[-340, -192], [-200, -187], [-104, -190], [0, -184], [110, -182], [236, -188], [340, -196]] },
  { id: 's1', kind: 'car', w: 11, walk: 2.5, pts: [[-340, 198], [-102, 193], [0, 197], [120, 201], [246, 206], [340, 213]] },
  { id: 'e1', kind: 'car', w: 10, walk: 2.5, pts: [[236, -300], [236, -75], [236, 11], [240, 72], [246, 206], [252, 330]] },
  { id: 'w1', kind: 'car', w: 10, walk: 2.5, pts: [[-236, -300], [-232, -70], [-230, 62], [-236, 196], [-242, 330]] },
  { id: 'm1', kind: 'ped', w: 8, walk: 8, pts: [[-230, 128], [-104, 126]] },
  { id: 'm2', kind: 'car', w: 9, walk: 2, pts: [[110, 136], [243, 138]] },
  { id: 'm4', kind: 'car', w: 9, walk: 2, pts: [[-232, -128], [-95, -128]] },
  { id: 'm5', kind: 'car', w: 9, walk: 2, pts: [[107, -128], [236, -128]] },
  { id: 'm6', kind: 'ped', w: 7, walk: 7, pts: [[0, 84], [2, 140], [0, 197]] },
  { id: 'm7', kind: 'car', w: 9, walk: 2, pts: [[-6, -86], [-4, -140], [0, -184]] },
  { id: 'o1', kind: 'car', w: 14, walk: 3, pts: [[-420, -300], [-236, -300], [0, -304], [236, -300], [420, -296]] },
  { id: 'o2', kind: 'car', w: 14, walk: 3, pts: [[-420, 330], [-242, 330], [0, 326], [252, 330], [420, 336]] },
  { id: 'o3', kind: 'car', w: 14, walk: 3, pts: [[400, -420], [390, -196], [380, 14], [390, 213], [400, 420]] },
  { id: 'o4', kind: 'car', w: 14, walk: 3, pts: [[-400, -420], [-392, -192], [-386, -66], [-390, 198], [-400, 420]] },
  { id: 'o5', kind: 'car', w: 9, walk: 2, pts: [[-340, -192], [-330, 64], [-340, 198]] },
  { id: 'o6', kind: 'car', w: 9, walk: 2, pts: [[340, -196], [320, -80], [330, 13], [340, 213]] },
  { id: 'o7', kind: 'car', w: 9, walk: 2, pts: [[-104, -190], [-110, -300]] },
  { id: 'o8', kind: 'car', w: 9, walk: 2, pts: [[110, -182], [118, -300]] },
  { id: 'o9', kind: 'car', w: 9, walk: 2, pts: [[-102, 193], [-100, 330]] },
  { id: 'o10', kind: 'car', w: 9, walk: 2, pts: [[120, 201], [124, 330]] },
  { id: 'o11', kind: 'car', w: 11, walk: 2.5, pts: [[-500, -412], [-240, -405], [0, -410], [230, -404], [500, -414]] },
  { id: 'o12', kind: 'car', w: 9, walk: 2, pts: [[-170, -300], [-176, -412], [-180, -505]] },
  { id: 'o13', kind: 'car', w: 9, walk: 2, pts: [[300, -300], [296, -405], [300, -505]] },
  { id: 'o14', kind: 'car', w: 11, walk: 2.5, pts: [[-500, 432], [-250, 428], [0, 436], [260, 430], [500, 438]] },
  { id: 'o15', kind: 'car', w: 9, walk: 2, pts: [[-470, -420], [-462, 0], [-470, 420]] },
  { id: 'o16', kind: 'car', w: 9, walk: 2, pts: [[468, -420], [460, 0], [470, 420]] },
  { id: 'o17', kind: 'car', w: 9, walk: 2, pts: [[0, -304], [6, -410], [2, -505]] },
];

export const STREET_BY_ID = Object.fromEntries(STREETS.map((s) => [s.id, s]));

// City extents
export const CITY = { r: 512 };          // detailed old-town fabric (square half-extent)
export const RIVER = { z: -560, w: 36 }; // Someș, north of the old town
