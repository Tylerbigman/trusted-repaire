const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3001;

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';

// Middleware sécurité
app.use(helmet());
app.use(cors({
  origin: ['https://trusted-repaire.onrender.com', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessaye plus tard',
  trustProxy: true,
  skip: (req, res) => req.method === 'OPTIONS'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives de connexion',
  trustProxy: true,
  skip: (req, res) => req.method === 'OPTIONS'
});

app.use(limiter);

// Connecte MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connecté!'))
  .catch(err => console.error('Erreur MongoDB:', err));

// Schéma User
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Schéma Repair
const repairSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  customer: { type: String, required: true },
  device: { type: String, required: true },
  issue: { type: String, required: true },
  status: { type: String, default: 'En attente' },
  price: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Repair = mongoose.model('Repair', repairSchema);

// Schéma Audit Log
const auditSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  action: String,
  resource: String,
  resourceId: String,
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', auditSchema);

// Fonction pour logger les actions
async function logAction(userId, action, resource, resourceId) {
  try {
    await AuditLog.create({ userId, action, resource, resourceId });
  } catch (err) {
    console.error('Erreur audit log:', err);
  }
}

// Middleware JWT
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// REGISTER
app.post('/auth/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Min 8 caractères')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    await logAction(user._id, 'REGISTER', 'User', user._id);
    res.status(201).json({ token, refreshToken, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// LOGIN
app.post('/auth/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    await logAction(user._id, 'LOGIN', 'User', user._id);
    res.json({ token, refreshToken, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// REFRESH TOKEN
app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token manquant' });
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const newToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Refresh token invalide' });
  }
});

// GET réparations (protégé)
app.get('/repairs', verifyToken, async (req, res) => {
  try {
    const repairs = await Repair.find({ userId: req.userId });
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer (protégé)
app.post('/repairs', verifyToken, [
  body('customer').notEmpty().trim(),
  body('device').notEmpty().trim(),
  body('issue').notEmpty().trim(),
  body('price').isFloat({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { customer, device, issue, price } = req.body;
    const repair = new Repair({ userId: req.userId, customer, device, issue, price });
    await repair.save();
    
    await logAction(req.userId, 'CREATE', 'Repair', repair._id);
    res.status(201).json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier (protégé)
app.put('/repairs/:id', verifyToken, [
  body('status').optional().isIn(['En attente', 'En réparation', 'Réparation terminée'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const repair = await Repair.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
    
    await logAction(req.userId, 'UPDATE', 'Repair', repair._id);
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer (protégé)
app.delete('/repairs/:id', verifyToken, async (req, res) => {
  try {
    const repair = await Repair.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
    
    await logAction(req.userId, 'DELETE', 'Repair', repair._id);
    res.json({ message: 'Supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats (protégé)
app.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    const total = await Repair.countDocuments({ userId: req.userId });
    const pending = await Repair.countDocuments({ userId: req.userId, status: 'En attente' });
    const completed = await Repair.countDocuments({ userId: req.userId, status: 'Réparation terminée' });
    const repairs = await Repair.find({ userId: req.userId });
    const revenue = repairs.reduce((sum, r) => sum + r.price, 0);
    res.json({ total, pending, completed, revenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
  console.log('Sécurité: CORS + Rate Limit + JWT Refresh + Validation + Audit Logs ✅');
});
