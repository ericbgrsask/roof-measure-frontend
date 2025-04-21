import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Polygon } from '@react-google-maps/api';
import axios from 'axios';
import html2canvas from 'html2canvas';
import Login from './Login';
import Register from './Register';
import ProtectedRoute from './ProtectedRoute';

const GOOGLE_MAPS_LIBRARIES = ["geometry", "places"];

const containerStyle = {
  width: '800px',
  height: '600px',
};

const initialCenter = {
  lat: 52.1332,
  lng: -106.6700,
};

const MainApp = () => {
  const [polygons, setPolygons] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState(initialCenter);
  const [csrfToken, setCsrfToken] = useState(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await axios.get('https://roof-measure-backend.onrender.com/csrf-token', {
          withCredentials: true
        });
        setCsrfToken(response.data.csrfToken);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };

    fetchCsrfToken();

    if (isGoogleLoaded && autocompleteRef.current) {
      autocompleteRef.current.addEventListener('gmp-placeselect', (event) => {
        const place = event.place;
        if (place && place.geometry && place.geometry.location) {
          const location = place.geometry.location;
          setAddress(place.formattedAddress || '');
          setCenter({ lat: location.lat(), lng: location.lng() });
          if (mapRef.current) {
            mapRef.current.panTo({ lat: location.lat(), lng: location.lng() });
            mapRef.current.setZoom(22);
          }
        } else {
          alert('Please select a valid address from the suggestions.');
        }
      });
    }
  }, [isGoogleLoaded]);

  const onMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setCurrentPoints([...currentPoints, { lat, lng }]);
  };

  const finishPolygon = () => {
    if (currentPoints.length >= 3) {
      setPolygons([...polygons, currentPoints]);
      setCurrentPoints([]);
    }
  };

  const calculateArea = (points) => {
    if (points.length < 3) return 0;
    const path = points.map(point => ({ lat: point.lat, lng: point.lng }));
    const areaMeters = window.google.maps.geometry.spherical.computeArea(path);
    return (areaMeters * 10.764).toFixed(0);
  };

  const saveProject = async () => {
    if (!address) {
      alert('Please enter a project address.');
      return;
    }
    try {
      const response = await axios.post(
        'https://roof-measure-backend.onrender.com/projects',
        {
          address: address,
          polygons,
        },
        {
          withCredentials: true,
          headers: {
            'CSRF-Token': csrfToken
          }
        }
      );
      alert(`Project saved with ID: ${response.data.id}`);
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  const generatePDF = async () => {
    if (!address) {
      alert('Please enter a project address.');
      return;
    }
    try {
      const canvas = await html2canvas(mapContainerRef.current);
      const screenshot = canvas.toDataURL('image/png');
      const pdfData = {
        address: address,
        screenshot,
        polygons,
        areas: polygons.map((poly, index) => ({
          section: `Section ${index + 1}`,
          area: calculateArea(poly),
        })),
        totalArea: polygons.reduce((sum, poly) => sum + parseInt(calculateArea(poly), 10), 0),
      };
      const response = await axios.post('https://roof-measure-backend.onrender.com/generate-pdf', pdfData, {
        withCredentials: true,
        responseType: 'blob',
        headers: {
          'CSRF-Token': csrfToken
        }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'roof-measure-report.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await axios.get('https://roof-measure-backend.onrender.com/csrf-token', {
        withCredentials: true
      });
      const freshCsrfToken = response.data.csrfToken;
      await axios.post('https://roof-measure-backend.onrender.com/logout', {}, {
        withCredentials: true,
        headers: {
          'CSRF-Token': freshCsrfToken
        }
      });
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      navigate('/login');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
        <h1>Saskatoon Roof Measure</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div style={{ padding: '10px' }}>
        <label htmlFor="address-input">Project Address: </label>
        <gmp-place-autocomplete
          ref={autocompleteRef}
          style={{ width: '300px', marginLeft: '10px', border: '1px solid #ccc', padding: '5px' }}
          component-restrictions='{"country":"ca"}'
        >
          <input
            id="address-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter project address"
            style={{ width: '100%', border: 'none', outline: 'none' }}
          />
        </gmp-place-autocomplete>
      </div>
      <div ref={mapContainerRef}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onClick={onMapClick}
          mapTypeId="satellite"
          onLoad={(map) => (mapRef.current = map)}
        >
          {polygons.map((poly, index) => (
            <Polygon
              key={index}
              paths={poly}
              options={{
                fillColor: 'blue',
                fillOpacity: '0.35',
                strokeColor: 'blue',
                strokeOpacity: '0.8',
                strokeWeight: 2,
              }}
            />
          ))}
          {currentPoints.length > 0 && (
            <Polygon
              paths={currentPoints}
              options={{
                fillColor: 'blue',
                fillOpacity: '0.35',
                strokeColor: 'blue',
                strokeOpacity: '0.8',
                strokeWeight: 2,
              }}
            />
          )}
        </GoogleMap>
      </div>
      <button onClick={finishPolygon}>Finish Section</button>
      <button onClick={saveProject}>Save Project</button>
      <button onClick={generatePDF}>Generate PDF Report</button>
      <div>
        {polygons.map((poly, i) => (
          <p key={i}>Section {i + 1}: {calculateArea(poly)} SQFT</p>
        ))}
        <p>Total Flat Area: {polygons.reduce((sum, poly) => sum + parseInt(calculateArea(poly), 10), 0)} SQFT</p>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <LoadScript
      googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
      libraries={GOOGLE_MAPS_LIBRARIES}
      onLoad={() => setIsGoogleLoaded(true)}
    >
      <Router>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </LoadScript>
  );
};

export default App;
