import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication with /projects request');
        const response = await axios.get('https://roof-measure-backend.onrender.com/projects', {
          withCredentials: true,
          timeout: 5000
        });
        console.log('Auth check response:', response.data);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error.message);
        setError(error.message);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.error('Authentication error:', error);
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
