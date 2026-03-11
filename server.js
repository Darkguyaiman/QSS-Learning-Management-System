require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, initializeDatabase } = require('./config/database');

const app = express();

// Config from .env (secure defaults)
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Profile picture upload configuration
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'uploads', 'profiles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const profileUpload = multer({ storage: profileStorage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.userId || !roles.includes(req.session.userRole)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
};

// Make database available to routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const trainingRoutes = require('./routes/training');
const traineesRoutes = require('./routes/trainees');
const questionBankRoutes = require('./routes/questionBank');
const testRoutes = require('./routes/test');
const attendanceRoutes = require('./routes/attendance');
const resultsRoutes = require('./routes/results');
const profileRoutes = require('./routes/profile');
const settingsRoutes = require('./routes/settings');

app.use('/', authRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/training', requireAuth, trainingRoutes);
app.use('/trainees', requireAuth, requireRole(['admin', 'trainer']), traineesRoutes);
app.use('/questions', requireAuth, requireRole(['admin', 'trainer']), questionBankRoutes);
app.use('/tests', requireAuth, testRoutes);
app.use('/attendance', requireAuth, requireRole(['admin', 'trainer']), attendanceRoutes);
app.use('/results', requireAuth, resultsRoutes);
app.use('/profile', requireAuth, profileRoutes);
app.use('/settings', requireAuth, requireRole(['admin', 'trainer']), settingsRoutes);

// Favicon route
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'QSS.ico'));
});

// Home route
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LMS Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
