const API = 'https://trusted-repaire.onrender.com';
let isLoginMode = true;
let refreshToken = null;

window.onload = () => {
  const token = localStorage.getItem('token');
  if (token) {
    refreshToken = localStorage.getItem('refreshToken');
    showDashboard();
    loadRepairs();
  } else {
    showLogin();
  }
};

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById('loginTitle').textContent = isLoginMode ? 'Se connecter' : 'Créer un compte';
  document.getElementById('errorMsg').textContent = '';
}

function showLogin() {
  document.querySelector('.login-page').classList.add('active');
  document.querySelector('.dashboard').classList.remove('active');
}

function showDashboard() {
  document.querySelector('.login-page').classList.remove('active');
  document.querySelector('.dashboard').classList.add('active');
}

async function handleAuth() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('errorMsg');

  if (!email || !password) {
    errorDiv.textContent = 'Remplis tous les champs!';
    return;
  }

  if (!isLoginMode && password.length < 8) {
    errorDiv.textContent = 'Mot de passe: min 8 caractères';
    return;
  }

  const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

  try {
    const res = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      refreshToken = data.refreshToken;
      showDashboard();
      loadRepairs();
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPassword').value = '';
      errorDiv.textContent = '';
    } else {
      errorDiv.textContent = data.error || 'Erreur de connexion';
    }
  } catch (err) {
    errorDiv.textContent = 'Erreur de connexion';
  }
}

async function getValidToken() {
  let token = localStorage.getItem('token');
  
  try {
    const res = await fetch(API + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      token = data.token;
    }
  } catch (err) {
    logout();
  }
  
  return token;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  refreshToken = null;
  showLogin();
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
}

async function loadRepairs() {
  const token = await getValidToken();
  try {
    const res = await fetch(API + '/repairs', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const repairs = await res.json();
    displayRepairs(repairs);
    loadStats();
  } catch (err) {
    console.error('Erreur:', err);
  }
}

function displayRepairs(repairs) {
  const table = document.getElementById('repairs-table');
  table.innerHTML = repairs.map(r => `
    <tr>
      <td>${r.customer}</td>
      <td>${r.device}</td>
      <td>${r.issue}</td>
      <td>
        <select onchange="updateStatus('${r._id}', this.value)">
          <option value="En attente" ${r.status === 'En attente' ? 'selected' : ''}>En attente</option>
          <option value="En réparation" ${r.status === 'En réparation' ? 'selected' : ''}>En réparation</option>
          <option value="Réparation terminée" ${r.status === 'Réparation terminée' ? 'selected' : ''}>Terminée</option>
        </select>
      </td>
      <td>${r.price}€</td>
      <td><button onclick="deleteRepair('${r._id}')">Supprimer</button></td>
    </tr>
  `).join('');
}

async function loadStats() {
  const token = await getValidToken();
  try {
    const res = await fetch(API + '/stats/summary', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const stats = await res.json();
    document.getElementById('total').textContent = stats.total;
    document.getElementById('pending').textContent = stats.pending;
    document.getElementById('completed').textContent = stats.completed;
    document.getElementById('revenue').textContent = stats.revenue + '€';
  } catch (err) {}
}

async function addRepair() {
  const token = await getValidToken();
  const customer = document.getElementById('customer').value;
  const device = document.getElementById('device').value;
  const issue = document.getElementById('issue').value;
  const price = document.getElementById('price').value;

  if (!customer || !device || !issue || !price) {
    alert('Rempllis tous les champs!');
    return;
  }

  try {
    await fetch(API + '/repairs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ customer, device, issue, price: parseFloat(price) })
    });
    document.getElementById('customer').value = '';
    document.getElementById('device').value = '';
    document.getElementById('issue').value = '';
    document.getElementById('price').value = '';
    loadRepairs();
  } catch (err) {}
}

async function updateStatus(id, status) {
  const token = await getValidToken();
  try {
    await fetch(API + '/repairs/' + id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status })
    });
    loadRepairs();
  } catch (err) {}
}

async function deleteRepair(id) {
  if (confirm('Supprimer?')) {
    const token = await getValidToken();
    try {
      await fetch(API + '/repairs/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      loadRepairs();
    } catch (err) {}
  }
}
