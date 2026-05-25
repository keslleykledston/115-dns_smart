import http from 'http';

const port = process.env.GUI_PORT || 3000;

const options = {
  host: 'localhost',
  port: port,
  path: '/api/auth/me', // Simple check to see if server is listening and route matching
  timeout: 2000
};

const request = http.request(options, (res) => {
  // If it responds with 401 (Authentication required) or 200 (if logged in somehow), it means the server is online and running
  if (res.statusCode === 200 || res.statusCode === 401) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => {
  process.exit(1);
});

request.end();
