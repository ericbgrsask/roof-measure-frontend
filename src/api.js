import axios from 'axios';

const api = axios.create({
  baseURL: 'https://roof-measure-backend.onrender.com',
  withCredentials: true,
});

export default api;

