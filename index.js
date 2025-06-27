const express = require('express');
const http = require('http');
const fs = require('fs');
const manifestRoutes = require('./routes/manifest');
const streamRoutes = require('./routes/stream');
const configRoutes = require('./routes/config');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Routes
app.use('/', configRoutes);
app.use('/', manifestRoutes);
app.use('/', streamRoutes);

// Start the HTTPS server
// const sslOptions = {
//   key: fs.readFileSync('/etc/ssl/private/server.key'),
//   cert: fs.readFileSync('/etc/ssl/certs/server.pem')
// };

http.createServer(app).listen(PORT, () => {
  logger.info(`✅ HTTP server running on port ${PORT}`);
});
