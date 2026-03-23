import React from 'react';

// Simplified US state paths (continental US)
const statePaths = {
  AL: "M628,396 L628,443 L620,454 L624,460 L618,460 L614,443 L608,396Z",
  AZ: "M190,370 L190,430 L240,430 L245,440 L255,430 L255,370 L220,360Z",
  AR: "M540,390 L540,430 L590,430 L590,390 L570,380Z",
  CA: "M100,230 L80,290 L90,350 L110,400 L130,410 L150,390 L150,330 L140,270 L120,230Z",
  CO: "M280,280 L280,330 L360,330 L360,280Z",
  CT: "M770,210 L770,230 L790,230 L790,210Z",
  DE: "M740,280 L740,300 L750,300 L750,280Z",
  FL: "M630,460 L660,470 L690,500 L700,530 L680,540 L660,520 L630,490 L610,470 L620,460Z",
  GA: "M640,400 L640,450 L680,450 L680,400 L660,390Z",
  ID: "M195,140 L185,210 L215,230 L225,200 L225,140Z",
  IL: "M560,250 L550,310 L560,340 L580,340 L590,310 L580,250Z",
  IN: "M590,260 L585,320 L605,330 L615,300 L610,260Z",
  IA: "M500,230 L490,270 L540,280 L550,240Z",
  KS: "M400,310 L400,350 L490,350 L490,310Z",
  KY: "M590,330 L590,360 L670,350 L680,330Z",
  LA: "M530,440 L530,480 L570,490 L580,470 L570,440Z",
  ME: "M790,100 L790,160 L810,140 L810,100Z",
  MD: "M710,280 L710,300 L740,300 L740,280Z",
  MA: "M770,190 L770,205 L800,205 L800,190Z",
  MI: "M580,170 L560,220 L590,240 L610,230 L620,190 L600,170Z",
  MN: "M470,130 L460,210 L520,210 L520,130Z",
  MS: "M580,400 L580,460 L605,460 L605,400Z",
  MO: "M500,300 L500,370 L550,380 L560,340 L540,300Z",
  MT: "M230,100 L230,160 L330,160 L330,100Z",
  NE: "M370,250 L370,290 L470,290 L470,250Z",
  NV: "M155,220 L145,320 L190,340 L200,260 L185,220Z",
  NH: "M780,130 L780,185 L790,185 L790,130Z",
  NJ: "M745,240 L740,275 L755,280 L755,240Z",
  NM: "M250,360 L250,430 L320,430 L320,360Z",
  NY: "M710,160 L700,220 L760,230 L770,190 L760,160Z",
  NC: "M650,350 L650,380 L740,370 L740,345Z",
  ND: "M380,110 L380,160 L460,160 L460,110Z",
  OH: "M620,250 L615,310 L650,320 L660,280 L650,250Z",
  OK: "M380,360 L380,400 L490,400 L500,370 L440,360Z",
  OR: "M110,120 L100,190 L170,200 L185,140 L160,120Z",
  PA: "M680,230 L680,270 L740,270 L740,230Z",
  RI: "M785,210 L785,220 L795,220 L795,210Z",
  SC: "M670,380 L660,410 L700,410 L700,380Z",
  SD: "M380,160 L380,220 L460,220 L460,160Z",
  TN: "M570,360 L570,385 L660,375 L660,350Z",
  TX: "M330,380 L310,470 L370,510 L440,490 L480,440 L490,400 L430,380Z",
  UT: "M220,230 L215,320 L275,330 L280,250 L250,230Z",
  VT: "M770,130 L770,180 L780,180 L780,130Z",
  VA: "M660,300 L650,340 L740,330 L740,300Z",
  WA: "M120,70 L110,130 L180,140 L190,100 L160,70Z",
  WV: "M660,290 L655,330 L680,340 L690,310 L680,290Z",
  WI: "M520,140 L510,220 L560,230 L570,170 L550,140Z",
  WY: "M260,170 L260,240 L345,240 L345,170Z",
  HI: "M260,490 L250,510 L270,520 L290,510 L290,490Z",
};

const USMap = ({ stateValues = {}, width = 600, height = 400 }) => {
  const maxVal = Math.max(...Object.values(stateValues), 1);
  
  const getColor = (state) => {
    const val = stateValues[state];
    if (!val) return '#1e1e2e';
    const intensity = Math.min(val / maxVal, 1);
    const r = Math.round(50 + intensity * 90);
    const g = Math.round(50 + intensity * 80);
    const b = Math.round(80 + intensity * 176);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getOpacity = (state) => {
    return stateValues[state] ? 1 : 0.3;
  };

  return (
    <svg viewBox="60 60 770 500" width={width} height={height} className="w-full h-full">
      {Object.entries(statePaths).map(([state, path]) => (
        <g key={state}>
          <path
            d={path}
            fill={getColor(state)}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            opacity={getOpacity(state)}
            className="transition-all duration-300 hover:opacity-100 hover:stroke-white hover:stroke-2"
          >
            <title>{state}: {stateValues[state] ? `$${stateValues[state].toLocaleString()}` : 'No holdings'}</title>
          </path>
          {stateValues[state] && (
            <text
              x={path.match(/M(\d+)/)?.[1]}
              y={path.match(/M\d+,(\d+)/)?.[1]}
              fill="white"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              dy="-5"
              style={{ pointerEvents: 'none' }}
            >
              {state}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export default USMap;
