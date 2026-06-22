const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Connecte MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connecté!'))
  .catch(err => console.error('Erreur MongoDB:', err));

// Schéma User
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Schéma Repair
const repairSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  customer: String,
  device: String,
  issue: String,
  status: { type: String, default: 'En attente' },
  price: Number,
  createdAt: { type: Date, default: Date.now }
});

const Repair = mongoose.model('Repair', repairSchema);

// Middleware pour vérifier le token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// REGISTER
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et password requis' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et password requis' });
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Email ou password incorrect' });
    
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ error: 'Email ou password incorrect' });
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
app.post('/repairs', verifyToken, async (req, res) => {
  try {
    const { customer, device, issue, price } = req.body;
    if (!customer || !device || !issue || !price) {
      return res.status(400).json({ error: 'Champs requis' });
    }
    const repair = new Repair({ userId: req.userId, customer, device, issue, price });
    await repair.save();
    res.status(201).json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier (protégé)
app.put('/repairs/:id', verifyToken, async (req, res) => {
  try {
    const repair = await Repair.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
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
    res.json({ message: 'Supprimée', repair });
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
});
