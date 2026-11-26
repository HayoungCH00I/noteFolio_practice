export type Season = 'spring'|'summer'|'autumn'|'winter'

// The two canopy tones keep their volume legible in blossom, foliage and snow.
export const seasons={
  spring:{ground:'#faf8d9',water:'#83cbd0',leaves:['#e6acbf','#aec887','#f5cdd5'],grass:['#b4c67d','#d0dc9c'],flower:'#e9a2bb'},
  summer:{ground:'#daefbd',water:'#61bbcb',leaves:['#73a967','#4c9366','#92bd71'],grass:['#8fb46c','#afd08c'],flower:'#f3d372'},
  autumn:{ground:'#f5d09a',water:'#92bab9',leaves:['#d3884c','#b56141','#ebac60'],grass:['#ba955d','#d7b67b'],flower:'#cd805b'},
  winter:{ground:'#e5eff2',water:'#a0d3df',leaves:['#95aa9e','#789889','#edf5f5'],grass:['#bdcfc9','#e2eeeb'],flower:'#e3e9df'},
} as const
