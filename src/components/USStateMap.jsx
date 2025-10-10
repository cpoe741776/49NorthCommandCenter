import React, { useEffect, useState, useCallback } from 'react';

const USStateMap = ({ registeredStates, stateSystemsMap, onStateHover, hoveredState }) => {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);

  // Load SVG file on mount
  useEffect(() => {
    fetch('/images/us-states.svg')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load map');
        return res.text();
      })
      .then(svgText => {
        // Extract just the paths from inside <g id="states">
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const statesGroup = svgDoc.querySelector('#states');
        
        if (statesGroup) {
          setSvgContent(statesGroup.innerHTML);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading US map:', err);
        setLoading(false);
      });
  }, []);

  // Handle state interactions
  const handlePathClick = useCallback((e) => {
    const path = e.target.closest('path[id]');
    if (!path) return;
    
    const stateId = path.id;
    if (stateId && stateId.length === 2) {
      // Could add click handler here if needed
    }
  }, []);

  const handlePathMouseEnter = useCallback((e) => {
    const path = e.target.closest('path[id]');
    if (!path) return;
    
    const stateId = path.id;
    if (stateId && stateId.length === 2 && onStateHover) {
      onStateHover(stateId);
    }
  }, [onStateHover]);

  const handlePathMouseLeave = useCallback(() => {
    if (onStateHover) {
      onStateHover(null);
    }
  }, [onStateHover]);

  // Update colors when registration or hover state changes
  useEffect(() => {
    if (!svgContent) return;

    // Use a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const container = document.getElementById('us-map-container');
      if (!container) return;

      const statePaths = container.querySelectorAll('path[id]');
      
      statePaths.forEach(path => {
        const stateId = path.id;
        if (!stateId || stateId.length !== 2) return;
        
        const isRegistered = registeredStates.includes(stateId);
        const isHovered = hoveredState === stateId;
        
        // Set colors
        if (isRegistered) {
          path.style.fill = isHovered ? '#3b82f6' : '#60a5fa';
        } else {
          path.style.fill = '#e5e7eb';
        }
        
        // Set styles
        path.style.stroke = '#ffffff';
        path.style.strokeWidth = '1.5';
        path.style.vectorEffect = 'non-scaling-stroke';
        path.style.transition = 'fill 0.2s ease';
        path.style.cursor = 'pointer';
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [registeredStates, hoveredState, svgContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading map...
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Failed to load map
      </div>
    );
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 960 600"
      className="w-full h-auto"
      role="img" 
      aria-label="US States map"
      onClick={handlePathClick}
      onMouseMove={handlePathMouseEnter}
      onMouseLeave={handlePathMouseLeave}
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
      <g 
        id="us-map-container"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </svg>
  );
};

export default USStateMap;