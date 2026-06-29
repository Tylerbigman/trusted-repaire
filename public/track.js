const API = 'https://trusted-repaire.onrender.com';

document.getElementById('codeInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') trackRepair();
});

async function trackRepair() {
  const code = document.getElementById('codeInput').value.toUpperCase();
  const errorDiv = document.getElementById('errorMsg');
  const infoDiv = document.getElementById('repairInfo');
  
  if (!code) {
    errorDiv.textContent = 'Rentre ton code!';
    errorDiv.classList.add('show');
    return;
  }

  try {
    const res = await fetch(API + '/track/' + code);
    const data = await res.json();

    if (res.ok) {
      errorDiv.classList.remove('show');
      
      document.getElementById('device').textContent = data.device;
      document.getElementById('issue').textContent = data.issue;
      document.getElementById('price').textContent = data.price + '€';
      document.getElementById('updatedAt').textContent = new Date(data.createdAt).toLocaleDateString('fr-FR');
      
      updateStatus(data.status);
      
      infoDiv.classList.add('show');
    } else {
      errorDiv.textContent = 'Code non trouvé!';
      errorDiv.classList.add('show');
      infoDiv.classList.remove('show');
    }
  } catch (err) {
    errorDiv.textContent = 'Erreur de connexion';
    errorDiv.classList.add('show');
  }
}

function updateStatus(status) {
  const badge = document.getElementById('statusBadge');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  
  step1.classList.remove('active');
  step2.classList.remove('active');
  step3.classList.remove('active');
  
  if (status === 'En attente') {
    badge.textContent = '⏳ En attente';
    badge.className = 'status pending';
    step1.classList.add('active');
  } else if (status === 'En réparation') {
    badge.textContent = '⚙️ En réparation';
    badge.className = 'status progress';
    step1.classList.add('active');
    step2.classList.add('active');
  } else if (status === 'Réparation terminée') {
    badge.textContent = '✅ Terminée';
    badge.className = 'status done';
    step1.classList.add('active');
    step2.classList.add('active');
    step3.classList.add('active');
  }
}
