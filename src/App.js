import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Polygon, OverlayView, Polyline } from '@react-google-maps/api';
import api from './api'; // Import the Axios instance
import html2canvas from 'html2canvas';
import * as tf from '@tensorflow/tfjs';
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

const getPixelPositionOffset = (width, height) => ({
  x: -(width / 2),
  y: -(height / 2),
});

const MainApp = ({ isGoogleLoaded }) => {
  const [polygons, setPolygons] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState(initialCenter);
  const [csrfToken, setCsrfToken] = useState(null);
  const [pitchInputs, setPitchInputs] = useState([]); // Store pitch for each polygon
  const [buildingFootprints, setBuildingFootprints] = useState([]); // Store building footprints
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await api.get('/csrf-token', {
          headers: {
            'User-Id': localStorage.getItem('userId') || 'anonymous'
          }
        });
        setCsrfToken(response.data.csrfToken);
        console.log('Fetched CSRF token:', response.data.csrfToken);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };

    if (isGoogleLoaded) {
      fetchCsrfToken();
      console.log('Google Maps API loaded:', window.google?.maps);
    }
  }, [isGoogleLoaded]);

  const handleAddressSearch = () => {
    console.log('handleAddressSearch called');
    console.log('Current address state:', address);

    if (!isGoogleLoaded) {
      console.log('Google Maps API not loaded yet');
      alert('Google Maps API is still loading. Please try again in a moment.');
      return;
    }

    if (!address) {
      console.log('Address is empty');
      alert('Please enter an address.');
      return;
    }

    if (!window.google || !window.google.maps) {
      console.log('Google Maps API not available');
      alert('Google Maps API not loaded. Please check your API key and try again.');
      return;
    }

    console.log('Proceeding with geocoding for address:', address);

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: address, region: 'ca' }, (results, status) => {
        console.log('Geocoding status:', status);
        console.log('Geocoding results:', results);

        if (status === window.google.maps.GeocoderStatus.OK && results[0]) {
          const location = results[0].geometry.location;
          console.log('Geocoding successful, location:', { lat: location.lat(), lng: location.lng() });
          setAddress(results[0].formatted_address || address);
          setCenter({ lat: location.lat(), lng: location.lng() });
          if (mapRef.current) {
            mapRef.current.panTo({ lat: location.lat(), lng: location.lng() });
            mapRef.current.setZoom(22);
            console.log('Map updated to new center:', { lat: location.lat(), lng: location.lng() });
          } else {
            console.log('Map reference not available');
          }
        } else {
          console.error('Geocoding failed:', status);
          alert('Unable to find the address. Please try a different address.');
        }
      });
    } catch (error) {
      console.error('Error during geocoding:', error);
      alert('An error occurred while fetching the address. Please try again.');
    }
  };

  const fetchBuildingFootprints = async () => {
    if (!address) {
      alert('Please enter an address first.');
      return;
    }

    if (!isGoogleLoaded || !window.google || !window.google.maps) {
      alert('Google Maps API not loaded. Please try again.');
      return;
    }

    if (!center.lat || !center.lng) {
      alert('Please search for an address first.');
      return;
    }

    if (!window.cv || !window.tf) {
      alert('Required libraries (OpenCV.js/TensorFlow.js) not loaded. Please try again later.');
      return;
    }

    try {
      // Capture the map screenshot
      const canvas = await html2canvas(mapContainerRef.current);
      const imageDataUrl = canvas.toDataURL('image/png');
      console.log('Captured map screenshot');

      // Load the image into OpenCV.js for preprocessing
      const img = new Image();
      img.src = imageDataUrl;
      await new Promise(resolve => {
        img.onload = resolve;
      });

      // eslint-disable-next-line no-undef
      const src = cv.imread(img);

      // Method 1: Color-based segmentation in HSV space
      // Convert to HSV for color-based segmentation
      // eslint-disable-next-line no-undef
      const hsv = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);

      // Define a broader color range for roofs (targeting gray roofs)
      // Gray colors typically have low saturation and medium value
      // eslint-disable-next-line no-undef
      const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 50, 0]); // Low saturation, medium value
      // eslint-disable-next-line no-undef
      const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 50, 150, 255]); // Adjusted for gray roofs
      // eslint-disable-next-line no-undef
      const colorMask = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.inRange(hsv, low, high, colorMask);

      // Log the number of non-zero pixels in the color mask
      // eslint-disable-next-line no-undef
      const nonZeroColor = cv.countNonZero(colorMask);
      console.log('Non-zero pixels in color mask:', nonZeroColor);

      // Method 2: Edge detection as a fallback
      // Convert to grayscale for edge detection
      // eslint-disable-next-line no-undef
      const gray = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);

      // Apply Gaussian blur to reduce noise
      // eslint-disable-next-line no-undef
      cv.GaussianBlur(gray, gray, { width: 5, height: 5 }, 0, 0, cv.BORDER_DEFAULT);

      // Apply Canny edge detection with adjusted thresholds
      // eslint-disable-next-line no-undef
      const edgeMask = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.Canny(gray, edgeMask, 20, 80, 3); // Lowered thresholds to capture more edges

      // Log the number of non-zero pixels in the edge mask
      // eslint-disable-next-line no-undef
      const nonZeroEdge = cv.countNonZero(edgeMask);
      console.log('Non-zero pixels in edge mask:', nonZeroEdge);

      // Dilate edges to connect broken lines
      // eslint-disable-next-line no-undef
      const kernelDilate = cv.Mat.ones(3, 3, cv.CV_8U);
      // eslint-disable-next-line no-undef
      cv.dilate(edgeMask, edgeMask, kernelDilate);

      // Log the number of non-zero pixels after dilation
      // eslint-disable-next-line no-undef
      const nonZeroEdgeDilated = cv.countNonZero(edgeMask);
      console.log('Non-zero pixels in edge mask after dilation:', nonZeroEdgeDilated);

      // Combine color and edge masks (logical OR)
      // eslint-disable-next-line no-undef
      const combinedMask = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.bitwise_or(colorMask, edgeMask, combinedMask);

      // Log the number of non-zero pixels in the combined mask
      // eslint-disable-next-line no-undef
      const nonZeroCombined = cv.countNonZero(combinedMask);
      console.log('Non-zero pixels in combined mask:', nonZeroCombined);

      // Morphological operations to clean up the mask (less aggressive)
      // eslint-disable-next-line no-undef
      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      // eslint-disable-next-line no-undef
      cv.morphologyEx(combinedMask, combinedMask, cv.MORPH_OPEN, kernel);

      // Find contours
      // eslint-disable-next-line no-undef
      const contours = new cv.MatVector();
      // eslint-disable-next-line no-undef
      const hierarchy = new cv.Mat();
      // eslint-disable-next-line no-undef
      cv.findContours(combinedMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Log contour information for debugging
      console.log('Number of contours found:', contours.size());
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        // eslint-disable-next-line no-undef
        const area = cv.contourArea(contour);
        console.log(`Contour ${i + 1} area:`, area);
      }

      // Use canvas dimensions for conversion
      const imgHeight = canvas.height;
      const imgWidth = canvas.width;

      // Process contours to find roof sections
      const roofSections = [];
      const mapBounds = mapRef.current.getBounds();
      const ne = mapBounds.getNorthEast();
      const sw = mapBounds.getSouthWest();
      const latRange = ne.lat() - sw.lat();
      const lngRange = ne.lng() - sw.lng();

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        // eslint-disable-next-line no-undef
        const area = cv.contourArea(contour);
        if (area < 100) continue; // Minimum area threshold

        // Simplify contour using Douglas-Peucker algorithm for straight lines
        // eslint-disable-next-line no-undef
        const approx = new cv.Mat();
        // eslint-disable-next-line no-undef
        cv.approxPolyDP(contour, approx, 0.01 * cv.arcLength(contour, true), true);

        const points = [];
        for (let j = 0; j < approx.data32S.length; j += 2) {
          const x = approx.data32S[j];
          const y = approx.data32S[j + 1];

          // Convert pixel coordinates to lat/lng
          const lat = sw.lat() + (latRange * (1 - y / imgHeight));
          const lng = sw.lng() + (lngRange * (x / imgWidth));
          points.push({ lat, lng });
        }

        roofSections.push(points);
        approx.delete();
      }

      // Estimate pitch using shadow analysis
      const pitches = roofSections.map(section => {
        // Convert section points back to pixel coordinates for shadow analysis
        const pixelPoints = section.map(point => {
          const x = ((point.lng - sw.lng()) / lngRange) * imgWidth;
          const y = (1 - (point.lat - sw.lat()) / latRange) * imgHeight;
          return { x, y };
        });

        // Find the bounding box of the section
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pixelPoints.forEach(point => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });

        // Look for shadows by analyzing intensity in the grayscale image
        // eslint-disable-next-line no-undef
        const grayShadow = new cv.Mat();
        // eslint-disable-next-line no-undef
        cv.cvtColor(src, grayShadow, cv.COLOR_RGB2GRAY);

        // Define a region outside the bounding box to look for shadows (e.g., below the roof)
        const shadowRegionHeight = 30;
        const shadowROI = grayShadow.roi({
          x: Math.max(0, minX),
          y: Math.max(0, maxY),
          width: Math.min(imgWidth - minX, maxX - minX),
          height: Math.min(shadowRegionHeight, imgHeight - maxY)
        });

        // Calculate average intensity in the shadow region
        // eslint-disable-next-line no-undef
        const mean = cv.mean(shadowROI);
        const avgIntensity = mean[0]; // Grayscale intensity (0-255)

        // Simple pitch estimation: darker shadows (lower intensity) may indicate steeper pitch
        let pitch;
        if (avgIntensity < 50) {
          pitch = '6/12'; // Steeper pitch
        } else if (avgIntensity < 100) {
          pitch = '4/12'; // Medium pitch
        } else {
          pitch = '2/12'; // Shallow pitch
        }

        // Clean up shadow ROI
        shadowROI.delete();
        grayShadow.delete();

        return pitch;
      });

      // Clean up OpenCV Mats
      src.delete();
      hsv.delete();
      low.delete();
      high.delete();
      colorMask.delete();
      edgeMask.delete();
      combinedMask.delete();
      kernel.delete();
      kernelDilate.delete();
      contours.delete();
      hierarchy.delete();

      if (roofSections.length > 0) {
        setPolygons(roofSections);
        setPitchInputs(pitches); // Set automatically detected pitches
      } else {
        alert('No roof sections detected. Please try a different address.');
      }
    } catch (error) {
      console.error('Error detecting roof contours:', error);
      alert('Failed to detect roof contours. Please try a different address.');
    }
  };

  const handleAddressKeyPress = (event) => {
    console.log('Key pressed:', event.key);
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddressSearch();
    }
  };

  const onMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setCurrentPoints([...currentPoints, { lat, lng }]);
  };

  const finishPolygon = () => {
    if (currentPoints.length >= 3) {
      const newPolygons = [...polygons, currentPoints];
      setPolygons(newPolygons);
      setPitchInputs([...pitchInputs, '3/12']); // Default pitch
      setCurrentPoints([]);
    }
  };

  const calculateArea = (points) => {
    if (points.length < 3) return 0;
    const path = points.map(point => ({ lat: point.lat, lng: point.lng }));
    const areaMeters = window.google.maps.geometry.spherical.computeArea(path);
    return (areaMeters * 10.764).toFixed(0);
  };

  const calculatePolygonCenter = (points) => {
    if (points.length === 0) return { lat: 0, lng: 0 };
    let latSum = 0, lngSum = 0;
    points.forEach(point => {
      latSum += point.lat;
      lngSum += point.lng;
    });
    return {
      lat: latSum / points.length,
      lng: lngSum / points.length
    };
  };

  const handlePitchChange = (index, value) => {
    const newPitchInputs = [...pitchInputs];
    newPitchInputs[index] = value;
    setPitchInputs(newPitchInputs);
  };

  const saveProject = async () => {
    if (!address) {
      alert('Please enter a project address.');
      return;
    }
    if (!csrfToken) {
      alert('CSRF token not available. Please try again.');
      return;
    }
    try {
      const response = await api.post('/projects', {
        address: address,
        polygons,
        pitches: pitchInputs
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });
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
    if (!csrfToken) {
      alert('CSRF token not available. Please try again.');
      return;
    }
    try {
      const canvas = await html2canvas(mapContainerRef.current);
      const screenshot = canvas.toDataURL('image/png');
      const pdfData = {
        address: address,
        screenshot,
        polygons,
        pitches: pitchInputs,
        areas: polygons.map((poly, index) => ({
          section: `Section ${index + 1}`,
          area: calculateArea(poly),
          pitch: pitchInputs[index]
        })),
        totalArea: polygons.reduce((sum, poly) => sum + parseInt(calculateArea(poly), 10), 0),
      };
      const response = await api.post('/generate-pdf', pdfData, {
        responseType: 'blob',
        headers: {
          'X-CSRF-Token': csrfToken
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
      const response = await api.get('/csrf-token', {
        headers: {
          'User-Id': localStorage.getItem('userId') || 'anonymous'
        }
      });
      const freshCsrfToken = response.data.csrfToken;
      console.log('Sending CSRF token for logout:', freshCsrfToken);
      await api.post('/logout', {}, {
        headers: {
          'X-CSRF-Token': freshCsrfToken
        }
      });
      localStorage.removeItem('token'); // Clear the token on logout
      localStorage.removeItem('userId');
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      localStorage.removeItem('token'); // Clear the token even if logout fails
      localStorage.removeItem('userId');
      navigate('/login');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
        <h1>Saskatoon Roof Measure</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div style={{ padding: '10px', display: 'flex', alignItems: 'center' }}>
        <label htmlFor="address-input" style={{ marginRight: '10px' }}>Project Address: </label>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            id="address-input"
            type="text"
            value={address}
            onChange={(e) => {
              console.log('Input changed, new value:', e.target.value);
              setAddress(e.target.value);
            }}
            onKeyPress={handleAddressKeyPress}
            placeholder="Enter project address"
            style={{ width: '300px', border: '1px solid #ccc', padding: '5px', outline: 'none' }}
          />
          <button
            onClick={() => {
              console.log('Search button clicked');
              handleAddressSearch();
            }}
            style={{ marginLeft: '10px', padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
          >
            Search
          </button>
          <button
            onClick={fetchBuildingFootprints}
            style={{ marginLeft: '10px', padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
          >
            Detect Roof
          </button>
        </div>
      </div>
      <div ref={mapContainerRef}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onClick={onMapClick}
          mapTypeId="satellite"
          onLoad={(map) => {
            mapRef.current = map;
            console.log('Google Map loaded');
          }}
        >
          {polygons.map((poly, index) => (
            <React.Fragment key={index}>
              <Polygon
                paths={poly}
                options={{
                  fillColor: 'gray',
                  fillOpacity: '0.5',
                  strokeColor: 'blue',
                  strokeOpacity: '0.8',
                  strokeWeight: 2,
                }}
              />
              <OverlayView
                position={calculatePolygonCenter(poly)}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={getPixelPositionOffset}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid #000',
                    padding: '12px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    lineHeight: '1.5',
                  }}
                >
                  <div>{calculateArea(poly)} SQFT</div>
                  <div>Pitch: {pitchInputs[index]}</div>
                </div>
              </OverlayView>
            </React.Fragment>
          ))}
          {currentPoints.length > 0 && (
            <Polygon
              paths={currentPoints}
              options={{
                fillColor: 'gray',
                fillOpacity: '0.5',
                strokeColor: 'blue',
                strokeOpacity: '0.8',
                strokeWeight: 2,
              }}
            />
          )}
        </GoogleMap>
      </div>
      <div style={{ padding: '10px', border: '1px solid #ccc', margin: '10px 0', background: '#f9f9f9' }}>
        <h3>Legend</h3>
        <p><strong>Area (SQFT)</strong>: Square footage of the roof section.</p>
        <p><strong>Pitch (e.g., 3/12)</strong>: Roof pitch, expressed as rise/run.</p>
      </div>
      <button onClick={finishPolygon}>Finish Section</button>
      <button onClick={saveProject}>Save Project</button>
      <button onClick={generatePDF}>Generate PDF Report</button>
      <div>
        {polygons.map((poly, i) => (
          <div key={i} style={{ margin: '10px 0' }}>
            <p>Section {i + 1}: {calculateArea(poly)} SQFT</p>
            <label>
              Pitch (e.g., 3/12):
              <input
                type="text"
                value={pitchInputs[i] || '3/12'}
                onChange={(e) => handlePitchChange(i, e.target.value)}
                style={{ marginLeft: '10px', width: '60px' }}
              />
            </label>
          </div>
        ))}
        <p>Total Flat Area: {polygons.reduce((sum, poly) => sum + parseInt(calculateArea(poly), 10), 0)} SQFT</p>
      </div>
    </div>
  );
};

const App = () => {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  return (
    <LoadScript
      googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
      libraries={GOOGLE_MAPS_LIBRARIES}
      onLoad={() => {
        console.log('Google Maps API loaded');
        setIsGoogleLoaded(true);
      }}
      onError={(error) => console.error('Google Maps API loading error:', error)}
    >
      <Router>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainApp isGoogleLoaded={isGoogleLoaded} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </LoadScript>
  );
};

export default App;
