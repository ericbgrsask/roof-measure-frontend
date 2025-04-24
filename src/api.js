import axios from 'axios';

const api = axios.create({
  baseURL: 'https://roof-measure-backend.onrender.com',
  withCredentials: true,
});

// Add a request interceptor to include the token in the Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  console.log('Retrieved token from local storage:', token); // Add logging
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    console.log('Added Authorization header:', config.headers['Authorization']); // Add logging
  } else {
    console.log('No token found in local storage'); // Add logging
  }
  return config;
}, (error) => {
  console.log('Error in Axios interceptor:', error); // Add logging
  return Promise.reject(error);
});

export default api;
