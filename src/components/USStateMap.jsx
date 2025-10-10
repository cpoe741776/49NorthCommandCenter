import React, { useEffect, useRef, useState } from 'react';

const USStateMap = ({ registeredStates, stateSystemsMap, onStateHover, hoveredState }) => {
  const containerRef = useRef(null);
  const [svgLoaded, setSvgLoaded] = useState(false);

  // Load SVG file on mount
  useEffect(() => {
    fetch('/images/us-states.svg')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load map');
        return res.text();
      })
      .then(svgText => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svgText;
          setSvgLoaded(true);
        }
      })
      .catch(err => {
        console.error('Error loading US map:', err);
      });
  }, []);

  // Apply colors and interactions to states
  useEffect(() => {
    if (!svgLoaded || !containerRef.current) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    // Make SVG responsive
    svg.setAttribute('class', 'w-full h-auto');
    svg.style.display = 'block';

    // Find all state paths (they have 2-letter IDs like CA, TX, NY, etc.)
    const statePaths = svg.querySelectorAll('path[id]');
    
    statePaths.forEach(path => {
      const stateId = path.id;
      if (!stateId || stateId.length !== 2) return; // Skip non-state paths
      
      const isRegistered = registeredStates.includes(stateId);
      const isHovered = hoveredState === stateId;
      
      // Set fill color based on registration status
      if (isRegistered) {
        path.style.fill = isHovered ? '#3b82f6' : '#60a5fa'; // Blue variants
      } else {
        path.style.fill = '#e5e7eb'; // Gray
      }
      
      // Ensure stroke is visible
      path.style.stroke = '#ffffff';
      path.style.strokeWidth = '1.5';
      path.style.vectorEffect = 'non-scaling-stroke';
      
      // Add transition for smooth color changes
      path.style.transition = 'fill 0.2s ease';
      
      // Make cursor a pointer
      path.style.cursor = 'pointer';
      
      // Add hover handlers
      path.onmouseenter = () => {
        if (onStateHover) onStateHover(stateId);
      };
      
      path.onmouseleave = () => {
        if (onStateHover) onStateHover(null);
      };
    });
  }, [registeredStates, hoveredState, svgLoaded, onStateHover]);

  return (
    <div ref={containerRef} className="w-full">
      {!svgLoaded && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading map...
        </div>
      )}
    </div>
  );
};

export default USStateMap;