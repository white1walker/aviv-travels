import { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from './supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE_URL = 'mapbox://styles/aviv-pilot/cmrc4ltmc001l01qucftjce18';

export default function App() {
  const mapRef = useRef();
  const [trips, setTrips] = useState([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [viewState, setViewState] = useState({ longitude: 60, latitude: 35, zoom: 2 });

  // AUTHENTICATION STATES
  const [session, setSession] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // MODAL & FORM STATES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [editingTripId, setEditingTripId] = useState(null); 

  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState('leisure'); 

  const [countryQuery, setCountryQuery] = useState('');
  const [countryResults, setCountryResults] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);

  const [formImages, setFormImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]); 
  const [formGalleryLink, setFormGalleryLink] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTrips = async () => {
    const { data, error } = await supabase.from('trips').select('*');
    if (error) console.error('Error fetching trips:', error);
    else if (data) setTrips(data);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setIsSubmitting(false);

    if (error) {
      alert(error.message);
    } else {
      setIsLoginModalOpen(false);
      setLoginEmail('');
      setLoginPassword('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openEditModal = (trip) => {
    setEditingTripId(trip.id);
    setFormTitle(trip.title);
    setFormDate(trip.travel_date);
    setFormType(trip.type);
    setSelectedCities(trip.cities || []);
    setFormGalleryLink(trip.gallery_link || '');
    setExistingImages(trip.image_urls || []);
    
    setSelectedCountry({
      properties: { short_code: trip.iso_code },
      bbox: trip.bbox 
    });
    setCountryQuery(trip.iso_code); 
    
    setIsModalOpen(true);
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm("Are you sure you want to permanently delete this log?")) return;
    
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) {
      alert("Error deleting: " + error.message);
    } else {
      setExpandedTripId(null);
      await fetchTrips();
    }
  };

  const validTrips = trips.filter(t => t.iso_code && typeof t.iso_code === 'string' && t.iso_code.length > 0);

  const colorMatch = ['match', ['get', 'iso_3166_1']];
  const opacityMatch = ['match', ['get', 'iso_3166_1']];
  const tracked = new Set();

  validTrips.forEach(trip => {
    if (!tracked.has(trip.iso_code)) {
      tracked.add(trip.iso_code);
      colorMatch.push(trip.iso_code, trip.color || '#6BCB77');
      opacityMatch.push(trip.iso_code, trip.iso_code === selectedCountryCode ? 0.6 : 0.2);
    }
  });

  if (colorMatch.length === 2) {
    colorMatch.push('DUMMY', 'transparent');
    opacityMatch.push('DUMMY', 0);
  }

  colorMatch.push('transparent'); 
  opacityMatch.push(0);           

  const handleCountrySearch = async (e) => {
    const q = e.target.value;
    setCountryQuery(q);
    setSelectedCountry(null);
    setSelectedCities([]); 
    setCityQuery('');

    if (q.length > 2) {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&types=country`);
      const data = await res.json();
      setCountryResults(data.features || []);
    } else {
      setCountryResults([]);
    }
  };

  const handleCitySearch = async (e) => {
    const q = e.target.value;
    setCityQuery(q);

    if (q.length > 2 && selectedCountry) {
      const countryCode = selectedCountry.properties.short_code;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&types=place,locality&country=${countryCode}`);
      const data = await res.json();
      setCityResults(data.features || []);
    } else {
      setCityResults([]);
    }
  };

  const handleSelectCity = (place) => {
    const newCity = { name: place.text, lng: place.center[0], lat: place.center[1] };
    setSelectedCities([...selectedCities, newCity]);
    setCityQuery('');
    setCityResults([]);
  };

  const removeCity = (indexToRemove) => {
    setSelectedCities(selectedCities.filter((_, index) => index !== indexToRemove));
  };

  const handleImageChange = (e) => {
    const incomingFiles = Array.from(e.target.files);
    const combinedFiles = [...formImages, ...incomingFiles];
    
    if (combinedFiles.length + existingImages.length > 5) {
      alert("You can only attach a maximum of 5 highlight photos per trip.");
    } else {
      setFormImages(combinedFiles);
    }
  };

  const removeImage = (indexToRemove) => {
    setFormImages(formImages.filter((_, index) => index !== indexToRemove));
  };

  const removeExistingImage = (indexToRemove) => {
    setExistingImages(existingImages.filter((_, index) => index !== indexToRemove));
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingTripId(null);
    setFormTitle('');
    setFormDate('');
    setCountryQuery('');
    setCityQuery('');
    setSelectedCountry(null);
    setSelectedCities([]);
    setFormImages([]); 
    setExistingImages([]);
    setFormGalleryLink('');
    setFormType('leisure'); 
  };

  const handleAddTripSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCountry) {
      alert("Please select a Country from the dropdown!");
      return;
    }

    setIsSubmitting(true); 

    let uploadedImageUrls = [];
    if (formImages.length > 0) {
      for (const file of formImages) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const fileName = `${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage.from('trip_images').upload(fileName, file);
        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue; 
        }
        const { data: publicUrlData } = supabase.storage.from('trip_images').getPublicUrl(fileName);
        uploadedImageUrls.push(publicUrlData.publicUrl);
      }
    }

    const finalImageUrls = [...existingImages, ...uploadedImageUrls];

    const iso_code = selectedCountry.properties?.short_code?.toUpperCase() || 'UNK';
    let finalBbox;

    if (selectedCountry.bbox) {
      finalBbox = [[selectedCountry.bbox[0], selectedCountry.bbox[1]], [selectedCountry.bbox[2], selectedCountry.bbox[3]]];
    } else if (selectedCountry.center) {
      const [lng, lat] = selectedCountry.center;
      const offset = 2; 
      finalBbox = [[lng - offset, lat - offset], [lng + offset, lat + offset]];
    } else {
      finalBbox = [[-180, -90], [180, 90]]; 
    }

    const autoColor = formType === 'work' ? '#4D96FF' : '#6BCB77';

    const newTripRow = {
      iso_code: iso_code,
      type: formType,
      title: formTitle,
      travel_date: formDate,
      cities: selectedCities, 
      color: autoColor, 
      bbox: finalBbox,
      description: selectedCities.length > 0 ? `Visited ${selectedCities.map(c => c.name).join(', ')}` : `Explored ${selectedCountry.text || selectedCountry.place_name}`,
      image_urls: finalImageUrls,
      gallery_link: formGalleryLink
    };

    let error;
    if (editingTripId) {
      const res = await supabase.from('trips').update(newTripRow).eq('id', editingTripId);
      error = res.error;
    } else {
      const res = await supabase.from('trips').insert([newTripRow]);
      error = res.error;
    }

    setIsSubmitting(false); 

    if (error) {
      alert('Error saving trip: ' + error.message);
    } else {
      await fetchTrips();
      resetForm();
    }
  };

  const handleMapClick = (event) => {
    const feature = event.features && event.features[0];
    if (feature && feature.properties.iso_3166_1) {
      const countryCode = feature.properties.iso_3166_1;
      const countryTrips = trips.filter(t => t.iso_code === countryCode);
      
      if (countryTrips.length > 0) {
        setSelectedCountryCode(countryCode);
        setExpandedTripId(countryTrips[0].id);
        if (mapRef.current) {
          mapRef.current.fitBounds(countryTrips[0].bbox, { padding: { top: 100, bottom: 100, left: 100, right: 450 }, duration: 1500, maxZoom: 9 });
        }
      }
    } else {
      setSelectedCountryCode(null);
      setExpandedTripId(null);
    }
  };

  const countryLayer = { id: 'country-fills', type: 'fill', 'source-layer': 'country_boundaries', paint: { 'fill-color': colorMatch, 'fill-opacity': opacityMatch } };

  // CHANGED: The cities now strictly inherit the individual trip's dynamic color
  const cityFeatures = validTrips.flatMap(trip => {
    if (!trip.cities || !Array.isArray(trip.cities)) return [];
    return trip.cities.map(city => {
      if (typeof city.lng !== 'number' || typeof city.lat !== 'number') return null;
      return { 
        type: 'Feature', 
        geometry: { type: 'Point', coordinates: [city.lng, city.lat] }, 
        properties: { name: city.name, color: trip.color } 
      };
    }).filter(Boolean);
  });
  
  const cityGeoJSON = { type: 'FeatureCollection', features: cityFeatures };
  const activeTrips = trips.filter(t => t.iso_code === selectedCountryCode);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      
      <div 
        onClick={() => {
          if (!session) setIsLoginModalOpen(true);
          else {
            if (window.confirm("Lock map and sign out?")) handleLogout();
          }
        }}
        style={{ position: 'absolute', bottom: 0, right: 0, width: '60px', height: '60px', zIndex: 9999, cursor: 'default' }}
        title={session ? "Secure: Logged In" : "Secure: Locked"}
      />

      {session && (
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 100, background: '#13111C', color: '#FFFFFF', border: '1px solid #23283B', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          ➕ Add New Log
        </button>
      )}

      <Map ref={mapRef} {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle={STYLE_URL} mapboxAccessToken={MAPBOX_TOKEN} interactiveLayerIds={['country-fills']} onClick={handleMapClick}>
        <Source id="countries" type="vector" url="mapbox://mapbox.country-boundaries-v1"><Layer {...countryLayer} /></Source>
        <Source id="cities" type="geojson" data={cityGeoJSON}>
          <Layer id="city-glow" type="circle" paint={{ 'circle-radius': 14, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25, 'circle-blur': 0.5 }} />
          <Layer id="city-core" type="circle" paint={{ 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#13111C' }} />
          <Layer id="city-labels" type="symbol" layout={{ 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 13, 'text-offset': [0, 1.2], 'text-anchor': 'top' }} paint={{ 'text-color': '#FFFFFF', 'text-halo-color': '#13111C', 'text-halo-width': 2 }} />
        </Source>
      </Map>

      {selectedCountryCode && activeTrips.length > 0 && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '100vh', backgroundColor: '#13111C', borderLeft: '1px solid #23283B', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', color: '#E0E0E0', padding: '40px 30px', boxSizing: 'border-box', fontFamily: 'sans-serif', zIndex: 10, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
             <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '28px', letterSpacing: '2px' }}>{selectedCountryCode}</h2>
             <button onClick={() => { setSelectedCountryCode(null); setExpandedTripId(null); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {activeTrips.map((trip) => {
                const isOpen = expandedTripId === trip.id;
                const citiesText = trip.cities && trip.cities.length > 0 ? trip.cities.map(c => c.name).join(', ') : null;

                return (
                   <div key={trip.id} style={{ backgroundColor: isOpen ? '#1A1D2A' : '#171923', border: `1px solid ${isOpen ? trip.color : '#23283B'}`, borderRadius: '8px', overflow: 'hidden' }}>
                      <div onClick={() => setExpandedTripId(isOpen ? null : trip.id)} style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <h3 style={{ margin: 0, fontSize: '16px', color: isOpen ? '#FFFFFF' : '#A0AEC0' }}>{trip.title}</h3>
                         <span style={{ fontSize: '12px', color: trip.color, fontWeight: 'bold', textTransform: 'uppercase' }}>{trip.type}</span>
                      </div>
                      
                      {isOpen && (
                         <div style={{ padding: '16px', backgroundColor: '#13111C' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#A0AEC0' }}>{citiesText ? `${citiesText} • ${trip.travel_date}` : trip.travel_date}</h4>
                            <p style={{ margin: '0 0 16px 0', fontSize: '15px', lineHeight: '1.6', color: '#E2E8F0' }}>{trip.description || ''}</p>
                            
                            {trip.image_urls && trip.image_urls.length > 0 && (
                              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
                                {trip.image_urls.map((url, i) => (
                                  <img key={i} src={url} alt={`Highlight ${i+1}`} style={{ flexShrink: 0, width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #23283B' }} />
                                ))}
                              </div>
                            )}

                            {trip.gallery_link && (
                              <a href={trip.gallery_link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: '#1A1D2A', border: '1px solid #6BCB77', color: '#6BCB77', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', transition: '0.2s' }}>
                                🖼️ View Full Google Photos Album
                              </a>
                            )}

                            {session && (
                              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid #23283B', paddingTop: '16px' }}>
                                <button onClick={(e) => { e.stopPropagation(); openEditModal(trip); }} style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'transparent', color: '#6BCB77', border: '1px solid #6BCB77', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✏️ Edit</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id); }} style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'transparent', color: '#F25F5C', border: '1px solid #F25F5C', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🗑️ Delete</button>
                              </div>
                            )}
                         </div>
                      )}
                   </div>
                );
             })}
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {isLoginModalOpen && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(5, 4, 8, 0.85)', zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <form onSubmit={handleLogin} style={{ backgroundColor: '#13111C', border: '1px solid #23283B', borderRadius: '12px', width: '350px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'sans-serif', color: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <h2 style={{ margin: '0', color: '#F5C2E7', textAlign: 'center' }}>Authorization Required</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Email</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '12px', borderRadius: '6px', background: '#6BCB77', color: '#13111C', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Login</button>
              <button type="button" onClick={() => setIsLoginModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '6px', background: 'transparent', color: '#888', border: '1px solid #23283B', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ADD/EDIT LOG MODAL */}
      {isModalOpen && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(5, 4, 8, 0.85)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <form onSubmit={handleAddTripSubmit} style={{ backgroundColor: '#13111C', border: '1px solid #23283B', borderRadius: '12px', width: '450px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'sans-serif', color: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0', color: '#F5C2E7' }}>{editingTripId ? 'Edit Adventure' : 'Log New Adventure'}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Trip Title</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>1. Select Country</label>
              <input type="text" value={countryQuery} onChange={handleCountrySearch} placeholder="Type a country..." required style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: selectedCountry ? '1px solid #6BCB77' : '1px solid #23283B', color: '#FFF' }} />
              {countryResults.length > 0 && (
                <div style={{ position: 'absolute', top: '70px', left: 0, width: '100%', background: '#1A1D2A', border: '1px solid #23283B', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', zIndex: 10 }}>
                  {countryResults.map(place => (
                    <div key={place.id} onClick={() => { setSelectedCountry(place); setCountryQuery(place.place_name); setCountryResults([]); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #23283B', fontSize: '14px' }}>{place.place_name}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', opacity: selectedCountry ? 1 : 0.4 }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>2. Add Cities</label>
              <input type="text" value={cityQuery} onChange={handleCitySearch} placeholder="Type to search cities..." disabled={!selectedCountry} style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
              
              {cityResults.length > 0 && (
                <div style={{ position: 'absolute', top: '70px', left: 0, width: '100%', background: '#1A1D2A', border: '1px solid #23283B', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', zIndex: 10 }}>
                  {cityResults.map(place => (
                    <div key={place.id} onClick={() => handleSelectCity(place)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #23283B', fontSize: '14px' }}>{place.text}</div>
                  ))}
                </div>
              )}

              {selectedCities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {selectedCities.map((city, index) => (
                    <div key={index} style={{ background: '#23283B', color: '#F5C2E7', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #F5C2E7' }}>
                      {city.name}
                      <span onClick={() => removeCity(index)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>✕</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Travel Date</label>
              <input type="text" value={formDate} onChange={e => setFormDate(e.target.value)} placeholder="e.g., May 2026" required style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
            </div>

            <div style={{ borderTop: '1px solid #23283B', paddingTop: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Highlight Photos (Max 5 total)</label>
                <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ fontSize: '12px', color: '#A0AEC0' }} />
                
                {existingImages.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {existingImages.map((url, index) => (
                      <div key={`exist-${index}`} style={{ fontSize: '12px', color: '#A0AEC0', display: 'flex', justifyContent: 'space-between', background: '#1A1D2A', padding: '6px 8px', borderRadius: '4px', border: '1px solid #4A5568' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>🖼️ Saved Photo {index + 1}</span>
                        <span onClick={() => removeExistingImage(index)} style={{ cursor: 'pointer', fontWeight: 'bold', color: '#F5C2E7' }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}

                {formImages.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {formImages.map((file, index) => (
                      <div key={`new-${index}`} style={{ fontSize: '12px', color: '#F5C2E7', display: 'flex', justifyContent: 'space-between', background: '#23283B', padding: '6px 8px', borderRadius: '4px', border: '1px solid #F5C2E7' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>🖼️ {file.name} (New)</span>
                        <span onClick={() => removeImage(index)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Google Photos Album Link</label>
                <input type="url" value={formGalleryLink} onChange={e => setFormGalleryLink(e.target.value)} placeholder="https://photos.app.goo.gl/..." style={{ padding: '10px', borderRadius: '6px', background: '#1A1D2A', border: '1px solid #23283B', color: '#FFF' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#A0AEC0' }}>Operational Type</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                <label><input type="radio" name="type" value="leisure" checked={formType === 'leisure'} onChange={() => setFormType('leisure')} /> Leisure</label>
                <label><input type="radio" name="type" value="work" checked={formType === 'work'} onChange={() => setFormType('work')} /> Work</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '12px', borderRadius: '6px', background: isSubmitting ? '#4A5568' : '#6BCB77', color: '#13111C', border: 'none', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? 'Saving...' : (editingTripId ? 'Save Changes' : 'Save Trip')}
              </button>
              <button type="button" onClick={resetForm} disabled={isSubmitting} style={{ flex: 1, padding: '12px', borderRadius: '6px', background: 'transparent', color: '#888', border: '1px solid #23283B', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}