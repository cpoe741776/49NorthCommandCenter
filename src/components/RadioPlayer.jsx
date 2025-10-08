import React, { useState, useRef, useEffect } from 'react';
import { Radio, Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';

const RadioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef(null);

  const stations = [
    {
      name: 'Classic Hits 70s-80s',
      url: 'http://streaming.radionomy.com/ClassicHits109',
      genre: 'Classic Rock'
    },
    {
      name: 'Lite Favorites',
      url: 'http://listen.181fm.com/181-lite_128k.mp3',
      genre: 'Soft Rock & Ballads'
    },
    {
      name: '70s AM Gold',
      url: 'http://listen.181fm.com/181-70s_128k.mp3',
      genre: '70s Hits'
    },
    {
      name: '80s Hairband',
      url: 'http://listen.181fm.com/181-hairband_128k.mp3',
      genre: '80s Rock'
    },
    {
      name: 'Smooth Jazz',
      url: 'http://listen.181fm.com/181-smoothjazz_128k.mp3',
      genre: 'Smooth Jazz'
    }
  ];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current || !selectedStation) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const selectStation = (station) => {
    const wasPlaying = isPlaying;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setSelectedStation(station);
    
    if (wasPlaying) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Error playing audio:', err);
            setIsPlaying(false);
          });
        }
      }, 100);
    }
  };

  return (
    <div className="bg-blue-900 border-t border-blue-800">
      <audio ref={audioRef} src={selectedStation?.url} />
      
      {/* Header */}
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-blue-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-blue-200" />
          <span className="text-sm text-blue-100 font-medium">Radio</span>
        </div>
        {isExpanded ? <ChevronDown size={16} className="text-blue-200" /> : <ChevronUp size={16} className="text-blue-200" />}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {/* Station Selector */}
          <div className="space-y-1">
            <label className="text-xs text-blue-200">Select Station</label>
            <select
              value={selectedStation?.name || ''}
              onChange={(e) => {
                const station = stations.find(s => s.name === e.target.value);
                if (station) selectStation(station);
              }}
              className="w-full px-2 py-1 text-xs bg-blue-800 text-blue-100 border border-blue-700 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Choose a station...</option>
              {stations.map((station) => (
                <option key={station.name} value={station.name}>
                  {station.name} - {station.genre}
                </option>
              ))}
            </select>
          </div>

          {/* Controls */}
          {selectedStation && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="flex-1 px-3 py-2 bg-blue-700 hover:bg-blue-600 text-blue-100 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  {isPlaying ? 'Stop' : 'Play'}
                </button>
              </div>

              {/* Volume Control */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-blue-200">Volume</label>
                  <span className="text-xs text-blue-200">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1 bg-blue-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Now Playing */}
              {isPlaying && (
                <div className="bg-blue-800 rounded p-2">
                  <p className="text-xs text-blue-200 font-medium">Now Playing</p>
                  <p className="text-xs text-blue-100 mt-1">{selectedStation.name}</p>
                  <p className="text-xs text-blue-300">{selectedStation.genre}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RadioPlayer;