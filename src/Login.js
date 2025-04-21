import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      console.log('Sending login request:', { username, password });
      const response = await axios.post('https://roof-measure-backend.onrender.com/login', {
        username,
        password,
      }, {
        withCredentials: true
      });
      console.log('Full login response:', response);
      navigate('/');
    } catch (err) {
      console.error('Login error details:', {
        message: err.message,
        response: err.response ? err.response.data : null,
        status: err.response ? err.response.status : null,
      });
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Login to Saskatoon Roof Measure</h1>
      <form onSubmit={handleLogin}>
        <div>
          <label>Username: </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div style={{ margin: '10px 0' }}>
          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Login</button>
      </form>
      <p>
        Don't have an account?{' '}
        <button onClick={() => navigate('/register')} style={{ color: 'blue', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          Register here
        </button>
      </p>
    </div>
  );
};

export default Login;
