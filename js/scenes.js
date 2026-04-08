import { mulberry32 } from './rng.js';

// Each scene supplies a palette consumed by the sprite functions and a
// bgTint applied as an additive offset on top of the existing score-banded
// background. Pine has zero offsets so it renders identically to today.
export const SCENES = [
  {
    id: 'pine',
    name: 'Pine Forest',
    weight: 40,
    palette: {
      treeFoliageDark: '#1f5f2a',
      treeFoliageLight: '#2a7a36',
      treeTrunk: '#5a3a1a',
      treeStarTop: '#ffd400',
      logBody: '#7a4a1f',
      logEnd: '#a36a32',
      logOutline: '#3a2410',
      stumpBody: '#8b5a2b',
      stumpRing: '#3a2410',
      rockBody: '#7a7a7a',
      rockOutline: '#3f3f3f',
      mogulLight: '#f4faff',
      mogulShade: '#a8c0d4',
      mogulOutline: '#6f8aa0',
      easterEgg: 'lights', // pine lights at 500m
    },
    bgTint: [0, 0, 0],
  },
  {
    id: 'birch',
    name: 'Winter Birch',
    weight: 20,
    palette: {
      treeFoliageDark: '#d4dce4', // bare branches; "foliage" = sparse twigs
      treeFoliageLight: '#e8eef4',
      treeTrunk: '#f0f0ee', // birch white
      treeStarTop: '#ffffff',
      logBody: '#8a9aa8',
      logEnd: '#b8c6d6',
      logOutline: '#3a4a5a',
      stumpBody: '#a0aab4',
      stumpRing: '#5a6878',
      rockBody: '#9aa8b6',
      rockOutline: '#3a4a5a',
      mogulLight: '#ffffff',
      mogulShade: '#a8b8c8',
      mogulOutline: '#4a5a6a',
      easterEgg: 'icicles',
    },
    bgTint: [-12, -6, 8], // bluer
  },
  {
    id: 'dusk',
    name: 'Alpine Dusk',
    weight: 20,
    palette: {
      treeFoliageDark: '#1a2a3e',
      treeFoliageLight: '#243a52',
      treeTrunk: '#3a2818',
      treeStarTop: '#ffd9a0',
      logBody: '#3a2818',
      logEnd: '#5a3a24',
      logOutline: '#1a0e08',
      stumpBody: '#4a3020',
      stumpRing: '#1a0e08',
      rockBody: '#5a5a6a',
      rockOutline: '#1a1a2a',
      mogulLight: '#e8e0f0',
      mogulShade: '#9088a8',
      mogulOutline: '#3a3050',
      easterEgg: 'stars',
    },
    bgTint: [8, -8, 18], // purple-tinted
  },
  {
    id: 'volcanic',
    name: 'Volcanic Ash',
    weight: 20,
    palette: {
      treeFoliageDark: '#1a1a1a',
      treeFoliageLight: '#2a2a2a',
      treeTrunk: '#0a0a0a',
      treeStarTop: '#ff5a1a',
      logBody: '#1a1a1a',
      logEnd: '#3a2018',
      logOutline: '#000000',
      stumpBody: '#2a1a14',
      stumpRing: '#0a0a0a',
      rockBody: '#1a1a1a',
      rockOutline: '#000000',
      mogulLight: '#d8d4d0',
      mogulShade: '#6a6864',
      mogulOutline: '#2a2824',
      easterEgg: 'embers',
    },
    bgTint: [-10, -12, -18], // ashier, slightly desaturated grey
  },
];

// Derive scene from world seed deterministically. All MP clients with the
// same seed pick the same scene without any protocol change.
export function pickSceneForSeed(seed) {
  const rng = mulberry32(seed >>> 0);
  const totalWeight = SCENES.reduce((s, sc) => s + sc.weight, 0);
  let roll = rng() * totalWeight;
  for (const sc of SCENES) {
    roll -= sc.weight;
    if (roll <= 0) return sc;
  }
  return SCENES[0];
}

export function getSceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}
