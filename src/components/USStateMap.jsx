import React, { useEffect, useState } from 'react';

const USStateMap = ({ registeredStates, stateSystemsMap, onStateHover, hoveredState, allSystems }) => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/images/us-states.svg')
      .then(res => res.text())
      .then(svgText => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const statesGroup = svgDoc.querySelector('#states');
        
        if (statesGroup) {
          const pathElements = Array.from(statesGroup.querySelectorAll('path[id]'));
          const pathData = pathElements.map(p => ({
            id: p.id,
            d: p.getAttribute('d'),
            name: p.getAttribute('data-name') || p.id
          }));
          setPaths(pathData);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading map:', err);
        setLoading(false);
      });
  }, []);

  const getStateColor = (stateId) => {
    const isRegistered = registeredStates.includes(stateId);
    const isHovered = hoveredState === stateId;
    return isRegistered ? (isHovered ? '#3b82f6' : '#60a5fa') : '#e5e7eb';
  };

  const handleStateClick = (stateId) => {
    const systemNames = stateSystemsMap[stateId];
    if (!systemNames || systemNames.length === 0) return;
    
    // Find the first system
    const firstSystemName = systemNames[0];
    const system = allSystems.find(s => s.systemName === firstSystemName);
    
    if (system) {
      // Open login URL if available, otherwise website URL
      const url = system.loginUrl || system.websiteUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading map...</div>;
  }

  if (!paths.length) {
    return <div className="flex items-center justify-center h-64 text-red-500">Failed to load map</div>;
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 960 600"
      className="w-full h-auto"
      role="img" 
      aria-label="US States map"
    >
      <style>{`
        .state { 
          stroke: #ffffff; 
          stroke-width: 1.5; 
          vector-effect: non-scaling-stroke;
          transition: fill 0.2s ease;
          cursor: pointer;
        }
      `}</style>
      <g id="states">
        {paths.map(path => (
          <path
            key={path.id}
            id={path.id}
            className="state"
            d={path.d}
            fill={getStateColor(path.id)}
            onMouseEnter={() => onStateHover && onStateHover(path.id)}
            onMouseLeave={() => onStateHover && onStateHover(null)}
            onClick={() => handleStateClick(path.id)}
            aria-label={path.name}
          />
        ))}
      </g>
    </svg>
  );
};

export default USStateMap;