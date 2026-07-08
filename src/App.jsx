import { useState, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE_URL = 'mapbox://styles/aviv-pilot/cmrc4ltmc001l01qucftjce18';

// 1. Added exact Bounding Boxes [ [SouthWest Lng, Lat], [NorthEast Lng, Lat] ]
const tripDetails = {
  'JPN': {
    type: 'leisure', 
    title: 'Japan Itinerary', 
    date: 'Jan - Mar 2026',
    description: 'Nine-week exploration. Highlights included Daikokuya Genghis Khan and scouting out the life-sized Gundam statues.',
    color: '#6BCB77',
    bbox: [[122.93, 24.04], [153.98, 45.55]]
  },
  'DEU': {
    type: 'work', 
    title: 'Bremen Drone Testing', 
    date: 'May 2026',
    description: 'Professional UAS operations, flight logging, and test pilot duties.',
    color: '#4D96FF',
    bbox: [[5.86, 47.27], [15.04, 55.05]]
  },
  'SGP': {
    type: 'leisure', 
    title: 'Singapore Hardware Run', 
    date: 'July 2026',
    description: 'Evaluating and pricing digital art hardware for Koruhiko’s studio setup.',
    color: '#6BCB77',
    bbox: [[103.60, 1.15], [104.03, 1.47]]
  }
};

const visitedCountries = Object.keys(tripDetails);

export default function App() {
  // 2. Creates a direct reference to the Mapbox engine
  const mapRef = useRef();

  const [viewState, setViewState] = useState({
    longitude: 60,
    latitude: 35,
    zoom: 2
  });

  const [selectedCountry, setSelectedCountry] = useState(null);

  const handleMapClick = (event) => {
    const feature = event.features[0];
    
    if (feature && tripDetails[feature.properties.iso_3166_1_alpha_3]) {
      const countryCode = feature.properties.iso_3166_1_alpha_3;
      setSelectedCountry(countryCode);

      // 3. The Cinematic Fly-To Logic
      if (mapRef.current) {
        mapRef.current.fitBounds(tripDetails[countryCode].bbox, {
          padding: { top: 100, bottom: 100, left: 100, right: 450 }, // 450px right padding clears the sidebar!
          duration: 1500, // 1.5 seconds of smooth flying
          maxZoom: 9 // Prevents small countries like Singapore from zooming in too aggressively
        });
      }
    } else {
      setSelectedCountry(null);
    }
  };

  const countryLayer = {
    id: 'country-fills',
    type: 'fill',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': [
        'match',
        ['get', 'iso_3166_1_alpha_3'],
        'JPN', tripDetails['JPN'].color,
        'DEU', tripDetails['DEU'].color,
        'SGP', tripDetails['SGP'].color,
        'transparent'
      ],
      'fill-opacity': [
        'case',
        ['==', ['get', 'iso_3166_1_alpha_3'], selectedCountry || 'NONE'], 0.6, 
        ['match', ['get', 'iso_3166_1_alpha_3'], visitedCountries, true, false], 0.2,
        0 
      ]
    }
  };

  const activeTrip = selectedCountry ? tripDetails[selectedCountry] : null;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      
      <Map
        ref={mapRef} // Attaches our reference to the map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={STYLE_URL}
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={['country-fills']} 
        onClick={handleMapClick}
      >
        <Source id="countries" type="vector" url="mapbox://mapbox.country-boundaries-v1">
          <Layer {...countryLayer} />
        </Source>
      </Map>

      {/* Sidebar Interface */}
      {activeTrip && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '350px',
          height: '100vh',
          backgroundColor: '#13111C',
          borderLeft: '1px solid #23283B',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          color: '#E0E0E0',
          padding: '40px 30px',
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <button 
            onClick={() => setSelectedCountry(null)}
            style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', marginBottom: '20px' }}
          >
            ✕
          </button>

          <h2 style={{ margin: '0 0 8px 0', color: '#F5C2E7', fontSize: '26px' }}>
            {activeTrip.title}
          </h2>
          
          <h4 style={{ 
            margin: '0 0 24px 0', 
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: activeTrip.color
          }}>
            {activeTrip.date}
          </h4>
          
          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#B0B0B0' }}>
            {activeTrip.description}
          </p>
        </div>
      )}
    </div>
  );
}