import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Polygon } from '@react-google-maps/api';
import axios from 'axios';
import html2canvas from 'html2canvas';
import Login from './Login';
import ProtectedRoute from './ProtectedRoute';

// Define libraries as a constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["geometry"];

const containerStyle = {
  width: '800px',
  height: '600px',
};

const center = {
  lat: 52.1332, // Saskatoon coordinates
  lng: -106.6700,
};

const MainApp = () => {
  const [polygons, setPolygons] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [address, setAddress] = useState(''); // State for project address
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const navigate = useNavigate();

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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'https://roof-measure-backend.onrender.com/projects',
        {
          address: address, // Use the dynamic address
          polygons,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
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
        address: address, // Use the dynamic address
        screenshot,
        polygons,
        areas: polygons.map((poly, index) => ({
          section: `Section ${index + 1}`,
          area: calculateArea(poly),
        })),
        totalArea: polygons.reduce((sum, poly) => sum + parseInt(calculateArea(poly), 10), 0),
      };
      const token = localStorage.getItem('token');
      const response = await axios.post('https://roof-measure-backend.onrender.com/generate-pdf', pdfData, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
        <h1>Saskatoon Roof Measure</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div style={{ padding: '10px' }}>
        <label htmlFor="address-input">Project Address: </label>
        <input
          id="address-input"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter project address"
          style={{ width: '300px', marginLeft: '10px' }}
        />
      </div>
      <div ref={mapContainerRef}>
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
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
                  fillOpacity: 0.35,
                  strokeColor: 'blue',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                }}
              />
            ))}
            {currentPoints.length > 0 && (
              <Polygon
                paths={currentPoints}
                options={{
                  fillColor: 'blue',
                  fillOpacity: 0.35,
                  strokeColor: 'blue',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>
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
    <Router>
      <Routes>
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
  );
};

export default App;
