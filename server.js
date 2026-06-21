const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static('public'));

let repairs = [
  { id: 1, customer: 'Jean', device: 'iPhone 14', issue: 'Écran cassé', status: 'En attente', price: 200 },
  { id: 2, customer: 'Marie', device: 'MacBook Pro', issue: 'Batterie faible', status: 'En réparation', price: 150 }
];

let nextId = 3;

app.get('/repairs', (req, res) => {
  res.json(repairs);
});

app.get('/repairs/:id', (req, res) => {
  const repair = repairs.find(r => r.id === parseInt(req.params.id));
  if (!repair) return res.status(404).json({ error: 'Réparation non trouvée' });
  res.json(repair);
});

app.post('/repairs', (req, res) => {
  const { customer, device, issue, price } = req.body;
  if (!customer || !device || !issue || !price) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  const newRepair = {
    id: nextId++,
    customer,
    device,
    issue,
    status: 'En attente',
    price
  };
  repairs.push(newRepair);
  res.status(201).json(newRepair);
});

app.put('/repairs/:id', (req, res) => {
  const repair = repairs.find(r => r.id === parseInt(req.params.id));
  if (!repair) return res.status(404).json({ error: 'Réparation non trouvée' });
  if (req.body.customer) repair.customer = req.body.customer;
  if (req.body.device) repair.device = req.body.device;
  if (req.body.issue) repair.issue = req.body.issue;
  if (req.body.status) repair.status = req.body.status;
  if (req.body.price) repair.price = req.body.price;
  res.json(repair);
});

app.delete('/repairs/:id', (req, res) => {
  const index = repairs.findIndex(r => r.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Réparation non trouvée' });
  const deleted = repairs.splice(index, 1);
  res.json({ message: 'Supprimé', repair: deleted[0] });
});

app.get('/stats/summary', (req, res) => {
  const total = repairs.length;
  const pending = repairs.filter(r => r.status === 'En attente').length;
  const completed = repairs.filter(r => r.status === 'Réparation terminée').length;
  const revenue = repairs.reduce((sum, r) => sum + r.price, 0);
  res.json({ total, pending, completed, revenue });
});

app.listen(PORT, () => {
  console.log('Trusted Repaire API running on http://localhost:' + PORT);
});
