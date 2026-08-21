require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const devicesRoutes = require('./modules/devices/devices.routes');
const measurementsRoutes = require('./modules/measurements/measurements.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const alertsRoutes = require('./modules/alerts/alerts.routes');
const historyRoutes = require('./modules/history/history.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
if (fs.existsSync(openapiPath)) {
  const openapiDocument = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
}

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/measurements', measurementsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/history', historyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
