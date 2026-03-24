import React from 'react';
import { statePaths, stateCentroids } from './usStatePaths';

const USMap = ({ stateValues = {}, width = 600, height = 400 }) => {
  const maxVal = Math.max(...Object.values(stateValues), 1);

  const getColor = (state) => {
    const val = stateValues[state];
    if (!val) return '#1e1e2e';
    const intensity = Math.min(val / maxVal, 1);
    // Purple gradient: darker to brighter
    const r = Math.round(50 + intensity * 90);
    const g = Math.round(50 + intensity * 80);
    const b = Math.round(80 + intensity * 176);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getOpacity = (state) => {
    return stateValues[state] ? 1 : 0.3;
  };

  return (
    <svg viewBox="60 50 900 550" width={width} height={height} className="w-full h-full">
      {Object.entries(statePaths).map(([state, path]) => (
        <g key={state}>
          <path
            d={path}
            fill={getColor(state)}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.75"
            opacity={getOpacity(state)}
            className="transition-all duration-300 hover:opacity-100 hover:stroke-white hover:stroke-[1.5]"
          >
            <title>{state}: {stateValues[state] ? `$${stateValues[state].toLocaleString()}` : 'No holdings'}</title>
          </path>
          {stateValues[state] && stateCentroids[state] && (
            <text
              x={stateCentroids[state][0]}
              y={stateCentroids[state][1]}
              fill="white"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
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
