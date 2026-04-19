import axios from 'axios';

// VITE_API_BASE_URL is set in Render Static Site env vars
// For local dev, create ReactFrontend/fund_tracker/.env with:
//   VITE_API_BASE_URL=http://localhost:5000

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
});

export default api;
