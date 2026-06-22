const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

require('dotenv').config();

// Connecte à MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connecté!'))
  .catch(err => console.error('Erreur MongoDB:', err));

// Schéma de réparation
const repairSchema = new mongoose.Schema({
  customer: String,
  device: String,
  issue: String,
  status: { type: String, default: 'En attente' },
  price: Number,
  createdAt: { type: Date, default: Date.now }
});

const Repair = mongoose.model('Repair', repairSchema);

// GET toutes les réparations
app.get('/repairs', async (req, res) => {
  try {
    const repairs = await Repair.find();
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET une réparation
app.get('/repairs/:id', async (req, res) => {
  try {
    const repair = await Repair.findById(req.params.id);
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer
app.post('/repairs', async (req, res) => {
  try {
    const { customer, device, issue, price } = req.body;
    if (!customer || !device || !issue || !price) {
      return res.status(400).json({ error: 'Champs requis' });
    }
    const repair = new Repair({ customer, device, issue, price });
    await repair.save();
    res.status(201).json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier
app.put('/repairs/:id', async (req, res) => {
  try {
    const repair = await Repair.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer
app.delete('/repairs/:id', async (req, res) => {
  try {
    const repair = await Repair.findByIdAndDelete(req.params.id);
    if (!repair) return res.status(404).json({ error: 'Non trouvée' });
    res.json({ message: 'Supprimée', repair });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats
app.get('/stats/summary', async (req, res) => {
  try {
    const total = await Repair.countDocuments();
    const pending = await Repair.countDocuments({ status: 'En attente' });
    const completed = await Repair.countDocuments({ status: 'Réparation terminée' });
    const repairs = await Repair.find();
    const revenue = repairs.reduce((sum, r) => sum + r.price, 0);
    res.json({ total, pending, completed, revenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('Trusted Repaire API running on port ' + PORT);
});
