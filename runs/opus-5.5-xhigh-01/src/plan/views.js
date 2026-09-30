// Camera presets (positions / targets in world metres).
export const VIEWS = {
  // high oblique aerial from the south-south-east, looking north-west across the square
  default: { pos: [44, 135, 318], target: [-8, 14, -34] },
  recenter: { pos: [40, 105, 245], target: [-12, 14, -20] },
  // standing in the square south-east of the monument, looking at the statue and the church
  street: { pos: [1, 1.7, 39], target: [-18, 13, -12] },
  // aerial overview of the whole old town
  aerial: { pos: [260, 620, 520], target: [-10, 0, -20] },
};
