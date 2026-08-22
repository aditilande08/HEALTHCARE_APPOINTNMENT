const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = (config.frontendUrl || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during deployment or fallback to origin
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

// routes will be added here as we build each milestone
app.use('/api/auth', require('./routes/auth'));
// app.use('/api/patients', require('./routes/patients'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/calendar', require('./routes/calendar'));

app.use(errorHandler);

if (require.main === module) {
  const prisma = require('./config/db');
  const { startJobs } = require('./jobs');

  prisma.$connect()
    .then(() => {
      console.log('Database connected');
      startJobs();
      app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to database:', err.message);
      process.exit(1);
    });
}

module.exports = app;
