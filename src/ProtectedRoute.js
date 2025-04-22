import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from './api'; // Import the Axios instance

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication with /projects request');
        const response = await api.get('/projects');
        console.log('Auth check response:', response.data);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log('Authentication error:', 'Request failed with status code 401');
    return <Navigate to="/login" />;
  }

  return children;
};

export default ProtectedRoute;
