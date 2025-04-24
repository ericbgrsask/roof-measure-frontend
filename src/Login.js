import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api'; // Import the Axios instance

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Sending login request:', { username, password });
      const response = await api.post('/login', { username, password });
      console.log('Full login response:', response);
      localStorage.setItem('token', response.data.token); // Store the token in local storage
      console.log('Stored token in local storage:', response.data.token); // Add logging
      navigate('/');
    } catch (error) {
      console.error('Login error details:', error);
      alert('Login failed. Please check your credentials and try again.');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username: </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <p>
        Don't have an account? <a href="/register">Register here</a>
      </p>
    </div>
  );
};

export default Login;
