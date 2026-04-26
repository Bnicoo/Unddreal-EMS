let appState = {
    currentDoctorId: null,
    currentDoctorName: null,
    currentRank: 'Médecin',
    currentView: 'view-login',
    activePatientId: null,
    patients: [], // Array of patient objects
    allowedDoctors: [], // Array of allowed IDs {id, rank}
    recrutements: [], // Array of recruitment evaluations
    ppa: [] // Array of PPA evaluations
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    
    // Check if already logged in
    if (appState.currentDoctorId || appState.currentDoctorName) {
        document.getElementById('doctor-name-display').innerHTML = `<strong>[${appState.currentRank}]</strong> ${appState.currentDoctorName}`;
        switchView('view-dashboard');
        renderPatients();
        applyPermissions();
    } else {
        switchView('view-login');
    }
});

// Load/Save from LocalStorage
function loadData() {
    const saved = localStorage.getItem('medrp_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState.currentDoctorId = parsed.currentDoctorId || parsed.currentDoctor || null;
            appState.currentDoctorName = parsed.currentDoctorName || parsed.currentDoctor || null;
            appState.currentRank = parsed.currentRank || 'Médecin';
            appState.patients = parsed.patients || [];
            
            const loadedDoctors = parsed.allowedDoctors || [];
            appState.allowedDoctors = loadedDoctors.map(doc => {
                if (typeof doc === 'string') return { id: doc, name: `Dr. ${doc}`, rank: 'Médecin', password: 'password' };
                if (!doc.name) doc.name = `Dr. ${doc.id}`;
                if (!doc.password) doc.password = 'password'; // Default password
                return doc;
            });
            appState.recrutements = parsed.recrutements || [];
            appState.ppa = parsed.ppa || [];
        } catch (e) {
            console.error("Failed to parse saved data.");
        }
    }
    
    // Force Mancini13 as Directeur Général
    const manciniIndex = appState.allowedDoctors.findIndex(d => d.id.toLowerCase() === 'mancini13');
    if (manciniIndex !== -1) {
        appState.allowedDoctors[manciniIndex].rank = 'Directeur Général';
        if (appState.allowedDoctors[manciniIndex].name === `Dr. Mancini13` || !appState.allowedDoctors[manciniIndex].name) {
            appState.allowedDoctors[manciniIndex].name = 'Dr. Mancini';
        }
    } else {
        appState.allowedDoctors.push({ id: 'Mancini13', name: 'Dr. Mancini', rank: 'Directeur Général', password: 'admin123' });
    }

    if (appState.currentDoctorId && appState.currentDoctorId.toLowerCase() === 'mancini13') {
        appState.currentRank = 'Directeur Général';
        const updatedMancini = appState.allowedDoctors.find(d => d.id.toLowerCase() === 'mancini13');
        if(updatedMancini) appState.currentDoctorName = updatedMancini.name;
    }
}

function saveData() {
    localStorage.setItem('medrp_data', JSON.stringify({
        currentDoctorId: appState.currentDoctorId,
        currentDoctorName: appState.currentDoctorName,
        currentRank: appState.currentRank,
        patients: appState.patients,
        allowedDoctors: appState.allowedDoctors,
        recrutements: appState.recrutements,
        ppa: appState.ppa
    }));
}

// Utils
function isManager() {
    const managers = ['Directeur Général', 'Directeur Adjoint', 'Chef de service'];
    return managers.includes(appState.currentRank) || appState.currentDoctorId === 'admin';
}

function isReadOnly() {
    return appState.currentRank === 'Administrateur (Lecture Seule)';
}

function canAccessSettings() {
    const settingsRanks = ['Directeur Général', 'Directeur Adjoint'];
    return settingsRanks.includes(appState.currentRank) || appState.currentDoctorId === 'admin';
}

function applyPermissions() {
    const readOnly = isReadOnly();

    // Hide write actions for read-only users
    const hideIfReadonly = [
        'btn-new-patient',
        'btn-new-recrutement',
        'btn-new-ppa',
        'btn-add-intervention',
        'btn-add-visite'
    ];

    hideIfReadonly.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = readOnly ? 'none' : '';
        }
    });

    // Settings button: only Directeur Général & Directeur Adjoint
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.style.display = canAccessSettings() ? '' : 'none';
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function getInitials(firstName, lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// View Management
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
        setTimeout(() => el.classList.add('hidden'), 400); // Wait for transition
    });
    
    // Show target view
    setTimeout(() => {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(viewId);
        target.classList.remove('hidden');
        // Small delay to allow display block to apply before opacity transition
        setTimeout(() => target.classList.add('active'), 50);
    }, 400);

    // Toggle header
    const header = document.getElementById('main-header');
    if (viewId === 'view-login') {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }

    appState.currentView = viewId;
}

// Render Functions
function renderPatients(searchQuery = '') {
    const grid = document.getElementById('patients-grid');
    grid.innerHTML = '';

    const filtered = appState.patients.filter(p => {
        const fullStr = `${p.firstName} ${p.lastName} ${p.id}`.toLowerCase();
        return fullStr.includes(searchQuery.toLowerCase());
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1;" class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 16px; display: block; opacity: 0.5;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p>Aucun patient trouvé.</p>
            </div>
        `;
        return;
    }

    // Sort by last updated (assuming last intervention or creation)
    filtered.reverse().forEach(patient => {
        const card = document.createElement('div');
        card.className = 'patient-card glass-panel';
        card.onclick = () => openPatient(patient.id);
        
        card.innerHTML = `
            <div class="patient-card-header">
                <div class="avatar">${getInitials(patient.firstName, patient.lastName)}</div>
                <div>
                    <h3>${patient.firstName} ${patient.lastName}</h3>
                    <p class="subtitle">ID: ${patient.id}</p>
                </div>
            </div>
            <div class="badges">
                <span class="badge">${patient.age} ans</span>
                <span class="badge badge-outline">${patient.gender}</span>
                ${patient.bloodType !== 'Inconnu' ? `<span class="badge badge-outline">${patient.bloodType}</span>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

function openPatient(id) {
    const patient = appState.patients.find(p => p.id === id);
    if (!patient) return;

    appState.activePatientId = id;
    
    // Fill patient profile
    document.getElementById('patient-detail-avatar').textContent = getInitials(patient.firstName, patient.lastName);
    document.getElementById('patient-detail-name').textContent = `${patient.firstName} ${patient.lastName}`;
    document.getElementById('patient-detail-age').textContent = `${patient.age} ans`;
    document.getElementById('patient-detail-gender').textContent = patient.gender;
    document.getElementById('patient-detail-id').textContent = patient.id;
    document.getElementById('patient-detail-blood').textContent = patient.bloodType;
    document.getElementById('patient-detail-allergies').textContent = patient.allergies || 'Aucune connue';
    document.getElementById('patient-detail-history').textContent = patient.history || 'Aucun';

    const adminActions = document.getElementById('patient-admin-actions');
    if (adminActions) {
        if (isManager()) {
            adminActions.style.display = 'flex';
        } else {
            adminActions.style.display = 'none';
        }
    }

    renderInterventions(patient);
    switchView('view-patient');
}

function renderInterventions(patient) {
    const timeline = document.getElementById('interventions-timeline');
    timeline.innerHTML = '';

    if (!patient.interventions || patient.interventions.length === 0) {
        timeline.innerHTML = `
            <div class="empty-state">
                <p>Aucune intervention enregistrée pour ce patient.</p>
            </div>
        `;
        return;
    }

    // Sort by date desc
    const sorted = [...patient.interventions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(int => {
        const dateObj = new Date(int.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `intervention-card glass-panel status-${int.severity}`;
        
        div.innerHTML = `
            <div class="intervention-meta">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px; vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr} à ${timeStr}</span>
                <span class="intervention-doctor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${int.doctor}
                </span>
            </div>
            <h4>${int.title}</h4>
            <div class="intervention-desc">
                ${int.description.replace(/\n/g, '<br>')}
            </div>
            ${int.prescriptions ? `
                <div class="intervention-prescriptions">
                    <strong>Prescriptions :</strong> ${int.prescriptions}
                </div>
            ` : ''}
            ${isManager() ? `
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8em;" onclick="editIntervention('${patient.id}', '${int.id}')">Modifier</button>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);" onclick="deleteIntervention('${patient.id}', '${int.id}')">Supprimer</button>
            </div>
            ` : ''}
        `;
        timeline.appendChild(div);
    });
}

// Event Listeners
function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('doctor-name').value.trim();
        const password = document.getElementById('doctor-password').value.trim();
        if (name && password) {
            const doctorObj = appState.allowedDoctors.find(d => d.id.toLowerCase() === name.toLowerCase());
            const isAllowed = (name.toLowerCase() === 'admin' && password === 'admin') || (doctorObj && doctorObj.password === password);
            
            if (isAllowed) {
                appState.currentDoctorId = name;
                appState.currentDoctorName = doctorObj ? doctorObj.name : 'Administrateur';
                appState.currentRank = doctorObj ? doctorObj.rank : 'Admin';
                document.getElementById('doctor-name-display').innerHTML = `<strong>[${appState.currentRank}]</strong> ${appState.currentDoctorName}`;
                saveData();
                switchView('view-dashboard');
                renderPatients();
                applyPermissions();
                showToast(`Bienvenue, ${appState.currentDoctorName}`);
            } else {
                showToast(`Accès refusé. Identifiant ou mot de passe incorrect.`);
            }
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        appState.currentDoctor = null;
        saveData();
        switchView('view-login');
        document.getElementById('doctor-name').value = '';
        document.getElementById('doctor-password').value = '';
    });

    // Search
    document.getElementById('search-patient').addEventListener('input', (e) => {
        renderPatients(e.target.value);
    });

    // Navigation Links
    document.getElementById('nav-patients').addEventListener('click', () => {
        document.getElementById('nav-patients').classList.add('active');
        document.getElementById('nav-recrutement').classList.remove('active');
        document.getElementById('nav-ppa').classList.remove('active');
        document.getElementById('nav-reglement').classList.remove('active');
        switchView('view-dashboard');
        renderPatients(document.getElementById('search-patient').value);
    });

    document.getElementById('nav-recrutement').addEventListener('click', () => {
        document.getElementById('nav-recrutement').classList.add('active');
        document.getElementById('nav-patients').classList.remove('active');
        document.getElementById('nav-ppa').classList.remove('active');
        document.getElementById('nav-reglement').classList.remove('active');
        switchView('view-recrutement');
        renderRecrutements();
    });

    document.getElementById('nav-ppa').addEventListener('click', () => {
        document.getElementById('nav-ppa').classList.add('active');
        document.getElementById('nav-patients').classList.remove('active');
        document.getElementById('nav-recrutement').classList.remove('active');
        document.getElementById('nav-reglement').classList.remove('active');
        switchView('view-ppa');
        renderPpa();
    });

    document.getElementById('nav-reglement').addEventListener('click', () => {
        document.getElementById('nav-reglement').classList.add('active');
        document.getElementById('nav-patients').classList.remove('active');
        document.getElementById('nav-recrutement').classList.remove('active');
        document.getElementById('nav-ppa').classList.remove('active');
        switchView('view-reglement');
    });

    // Back button
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        switchView('view-dashboard');
        renderPatients(document.getElementById('search-patient').value);
    });

    // Admin Patient Actions
    document.getElementById('btn-edit-patient').addEventListener('click', () => {
        const patient = appState.patients.find(p => p.id === appState.activePatientId);
        if (!patient) return;
        
        appState.editingPatientId = patient.id;
        const form = document.getElementById('form-add-patient');
        form.elements['firstName'].value = patient.firstName;
        form.elements['lastName'].value = patient.lastName;
        form.elements['age'].value = patient.age;
        form.elements['gender'].value = patient.gender;
        form.elements['bloodType'].value = patient.bloodType;
        form.elements['allergies'].value = patient.allergies;
        form.elements['history'].value = patient.history;
        
        document.getElementById('modal-add-patient').querySelector('h3').textContent = 'Modifier Dossier Patient';
        document.getElementById('modal-add-patient').classList.add('active');
    });

    document.getElementById('btn-delete-patient').addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce dossier patient ?')) {
            appState.patients = appState.patients.filter(p => p.id !== appState.activePatientId);
            saveData();
            switchView('view-dashboard');
            renderPatients(document.getElementById('search-patient').value);
            showToast('Dossier patient supprimé');
        }
    });

    // Modals
    const modals = document.querySelectorAll('.modal-overlay');
    const closeBtns = document.querySelectorAll('.modal-close');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modals.forEach(m => m.classList.remove('active'));
        });
    });

    // Add Patient
    document.getElementById('btn-new-patient').addEventListener('click', () => {
        appState.editingPatientId = null;
        document.getElementById('form-add-patient').reset();
        document.getElementById('modal-add-patient').querySelector('h3').textContent = 'Nouveau Dossier Patient';
        document.getElementById('modal-add-patient').classList.add('active');
    });

    document.getElementById('form-add-patient').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        if (appState.editingPatientId) {
            const patient = appState.patients.find(p => p.id === appState.editingPatientId);
            if (patient) {
                patient.firstName = formData.get('firstName');
                patient.lastName = formData.get('lastName');
                patient.age = formData.get('age');
                patient.gender = formData.get('gender');
                patient.bloodType = formData.get('bloodType');
                patient.allergies = formData.get('allergies');
                patient.history = formData.get('history');
            }
            appState.editingPatientId = null;
            showToast("Dossier patient mis à jour");
            openPatient(patient.id);
        } else {
            const newPatient = {
                id: generateId().toUpperCase(),
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                age: formData.get('age'),
                gender: formData.get('gender'),
                bloodType: formData.get('bloodType'),
                allergies: formData.get('allergies'),
                history: formData.get('history'),
                interventions: []
            };

            appState.patients.push(newPatient);
            showToast("Dossier patient créé avec succès");
        }
        
        saveData();
        document.getElementById('modal-add-patient').classList.remove('active');
        renderPatients(document.getElementById('search-patient').value);
    });

    // Add Intervention
    document.getElementById('btn-add-intervention').addEventListener('click', () => {
        document.getElementById('form-add-intervention').reset();
        document.getElementById('intervention-total-price').textContent = '0 $';
        document.getElementById('input-total-price').value = '0';
        
        // Default date to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.querySelector('input[name="date"]').value = now.toISOString().slice(0,16);
        
        // Auto-fill doctor
        document.getElementById('intervention-doctor').value = appState.currentDoctorName;

        document.getElementById('modal-add-intervention').classList.add('active');
    });

    // Intervention checkboxes update total price
    const soinsCheckboxes = document.querySelectorAll('input[name="soins"]');
    soinsCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            let total = 0;
            soinsCheckboxes.forEach(c => {
                if(c.checked) total += parseInt(c.dataset.price, 10);
            });
            document.getElementById('intervention-total-price').textContent = total.toLocaleString('en-US') + ' $';
            document.getElementById('input-total-price').value = total;
        });
    });

    document.getElementById('form-add-intervention').addEventListener('submit', (e) => {
        e.preventDefault();
        const patient = appState.patients.find(p => p.id === appState.activePatientId);
        if (!patient) return;

        const formData = new FormData(e.target);
        
        const soins = formData.getAll('soins');
        const notes = formData.get('notes');
        const total = formData.get('totalPrice');
        
        let desc = `Soins facturés : ${soins.length > 0 ? soins.join(', ') : 'Aucun'}`;
        if(parseInt(total, 10) > 0) desc += `\nTotal facturé : ${total.toLocaleString('en-US')} $`;
        if(notes) desc += `\n\nNotes : ${notes}`;
        
        const newIntervention = {
            id: generateId(),
            title: formData.get('title'),
            date: formData.get('date'),
            doctor: formData.get('doctor'),
            severity: formData.get('severity'),
            description: desc,
            prescriptions: formData.get('prescriptions')
        };

        patient.interventions.push(newIntervention);
        saveData();
        
        document.getElementById('modal-add-intervention').classList.remove('active');
        renderInterventions(patient);
        showToast("Intervention enregistrée");
    });

    // Moderation Settings
    document.getElementById('settings-btn').addEventListener('click', () => {
        renderAllowedDoctors();
        document.getElementById('modal-settings').classList.add('active');
    });

    document.getElementById('form-add-doctor').addEventListener('submit', (e) => {
        e.preventDefault();
        const idInput = document.getElementById('new-doctor-id');
        const nameInput = document.getElementById('new-doctor-name');
        const rankInput = document.getElementById('new-doctor-rank');
        const passwordInput = document.getElementById('new-doctor-password');
        const id = idInput.value.trim();
        const rpName = nameInput.value.trim();
        const rank = rankInput.value;
        const password = passwordInput.value.trim() || 'password';
        if (id && rpName && !appState.allowedDoctors.some(d => d.id.toLowerCase() === id.toLowerCase())) {
            appState.allowedDoctors.push({ id, name: rpName, rank, password });
            saveData();
            renderAllowedDoctors();
            idInput.value = '';
            nameInput.value = '';
            passwordInput.value = '';
            showToast("Médecin ajouté");
        } else if (id) {
            showToast("Cet identifiant est déjà enregistré");
        }
    });

    // Visite Médicale
    document.getElementById('btn-add-visite').addEventListener('click', () => {
        document.getElementById('form-add-visite').reset();
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('visite-date').value = now.toISOString().slice(0,16);
        document.getElementById('visite-doctor').value = appState.currentDoctorName;

        document.getElementById('modal-add-visite').classList.add('active');
    });

    document.getElementById('form-add-visite').addEventListener('submit', (e) => {
        e.preventDefault();
        const patient = appState.patients.find(p => p.id === appState.activePatientId);
        if (!patient) return;

        const formData = new FormData(e.target);
        
        const q1 = formData.get('q1_conscience');
        const q2 = formData.get('q2_respiration');
        const q3 = formData.get('q3_rythme');
        const q4 = formData.get('q4_douleur');
        const q5 = formData.get('q5_bilan');
        const obs = formData.get('observations');

        const description = `
**Bilan QCM :**
- État de conscience : ${q1}
- Respiration : ${q2}
- Rythme Cardiaque : ${q3}
- Douleur : ${q4}
- Bilan : ${q5}

${obs ? `**Observations :**\n${obs}` : ''}
        `.trim();

        const newIntervention = {
            id: generateId(),
            title: "Visite Médicale (QCM)",
            date: formData.get('date'),
            doctor: formData.get('doctor'),
            severity: q5.includes('Urgence') ? 'elevee' : (q5.includes('Légère') ? 'moyenne' : 'faible'),
            description: description,
            prescriptions: ""
        };

        patient.interventions.push(newIntervention);
        saveData();
        
        document.getElementById('modal-add-visite').classList.remove('active');
        renderInterventions(patient);
        showToast("Visite médicale enregistrée");
    });
    // Recrutement
    document.getElementById('btn-new-recrutement').addEventListener('click', () => {
        document.getElementById('form-recrutement').reset();
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('recrutement-date').value = now.toISOString().slice(0,16);
        document.getElementById('recrutement-evaluator').value = appState.currentDoctorName;

        document.getElementById('modal-add-recrutement').classList.add('active');
    });

    document.getElementById('form-recrutement').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const name = formData.get('candidate_name');
        const q1 = formData.get('r_q1');
        const q2 = formData.get('r_q2');
        const q3 = formData.get('r_q3');
        const q4 = formData.get('r_q4');
        const decision = formData.get('r_decision');
        const notes = formData.get('notes');

        const newRecrutement = {
            id: generateId(),
            name: name,
            evaluator: formData.get('evaluator'),
            date: formData.get('date'),
            q1: q1,
            q2: q2,
            q3: q3,
            q4: q4,
            decision: decision,
            notes: notes
        };

        appState.recrutements.push(newRecrutement);
        saveData();
        
        document.getElementById('modal-add-recrutement').classList.remove('active');
        renderRecrutements();
        showToast("Évaluation de recrutement enregistrée");
    });

    // PPA
    document.getElementById('btn-new-ppa').addEventListener('click', () => {
        document.getElementById('form-ppa').reset();
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('ppa-date').value = now.toISOString().slice(0,16);
        document.getElementById('ppa-evaluator').value = appState.currentDoctorName;

        document.getElementById('modal-add-ppa').classList.add('active');
    });

    document.getElementById('form-ppa').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const name = formData.get('candidate_name');
        const q1 = formData.get('p_q1');
        const q2 = formData.get('p_q2');
        const q3 = formData.get('p_q3');
        const q4 = formData.get('p_q4');
        const notes = formData.get('notes');

        let score = 0;
        if (q1 === 'Oui') score += 10;
        if (q2 === 'Récemment') score += 10;
        else if (q2 === 'Anciennement') score += 2;
        if (q3 === "Je deviens agressif") score += 10;
        else if (q3 === "J'hausse le ton") score += 5;
        if (q4 === "Je sors mon arme") score += 10;
        else if (q4 === "Je l'insulte en retour") score += 5;

        const decision = score >= 10 ? 'Inapte' : 'Apte';

        const newPpa = {
            id: generateId(),
            name: name,
            evaluator: formData.get('evaluator'),
            date: formData.get('date'),
            q1, q2, q3, q4, notes,
            score, decision
        };

        appState.ppa.push(newPpa);
        saveData();
        
        document.getElementById('modal-add-ppa').classList.remove('active');
        renderPpa();
        showToast("Test PPA automatisé terminé");
    });
}

function renderPpa() {
    const grid = document.getElementById('ppa-grid');
    grid.innerHTML = '';

    if (appState.ppa.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1;" class="empty-state">
                <p>Aucun test PPA enregistré.</p>
            </div>
        `;
        return;
    }

    const sorted = [...appState.ppa].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(p => {
        const dateObj = new Date(p.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        
        const isApte = p.decision === 'Apte';
        const statusColor = isApte ? 'var(--status-faible)' : 'var(--status-elevee)';

        const card = document.createElement('div');
        card.className = 'patient-card glass-panel';
        card.style.borderTop = `4px solid ${statusColor}`;
        card.innerHTML = `
            <div class="patient-card-header" style="margin-bottom: 8px;">
                <div>
                    <h3>${p.name}</h3>
                    <p class="subtitle" style="font-size: 0.85em;">Évalué le ${dateStr} par ${p.evaluator}</p>
                </div>
            </div>
            <div class="badges" style="margin-bottom: 12px;">
                <span class="badge" style="background-color: ${statusColor}; color: white;">${p.decision}</span>
            </div>
            <div style="font-size: 0.85em; opacity: 0.8; margin-top: 10px; background: rgba(0,0,0,0.02); padding: 8px; border-radius: 8px;">
                <strong>Troubles neuro:</strong> ${p.q1}<br>
                <strong>Psy/Colère:</strong> ${p.q2}<br>
                <strong>Altercation:</strong> ${p.q3}<br>
                <strong>Insulte:</strong> ${p.q4}
            </div>
            ${p.notes ? `<p style="font-size: 0.85em; margin-top: 8px; font-style: italic;">"${p.notes}"</p>` : ''}
            
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8em;" onclick="printPpaCert('${p.id}')">Certificat PDF</button>
                ${isManager() ? `<button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);" onclick="deletePpa('${p.id}')">Supprimer</button>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderRecrutements() {
    const grid = document.getElementById('recrutement-grid');
    grid.innerHTML = '';

    if (appState.recrutements.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1;" class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 16px; display: block; opacity: 0.5;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p>Aucun test de recrutement enregistré.</p>
            </div>
        `;
        return;
    }

    const sorted = [...appState.recrutements].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(rec => {
        const dateObj = new Date(rec.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        
        let statusColor = 'var(--text-muted)';
        let statusBadge = 'badge-outline';
        if (rec.decision === 'Accepté') { statusColor = 'var(--status-faible)'; statusBadge = ''; }
        if (rec.decision === 'Refusé') { statusColor = 'var(--status-elevee)'; statusBadge = ''; }
        if (rec.decision === 'En attente') { statusColor = 'var(--status-moyenne)'; statusBadge = ''; }

        const card = document.createElement('div');
        card.className = 'patient-card glass-panel';
        card.style.borderTop = `4px solid ${statusColor}`;
        card.innerHTML = `
            <div class="patient-card-header" style="margin-bottom: 8px;">
                <div>
                    <h3>${rec.name}</h3>
                    <p class="subtitle" style="font-size: 0.85em;">Évalué le ${dateStr} par ${rec.evaluator}</p>
                </div>
            </div>
            <div class="badges" style="margin-bottom: 12px;">
                <span class="badge ${statusBadge}" style="background-color: ${statusBadge === '' ? statusColor : 'transparent'}; color: ${statusBadge === '' ? 'white' : statusColor}; border-color: ${statusColor}">${rec.decision}</span>
            </div>
            <div style="font-size: 0.85em; opacity: 0.8; margin-top: 10px; background: rgba(0,0,0,0.02); padding: 8px; border-radius: 8px;">
                <strong>RCP:</strong> ${rec.q1}<br>
                <strong>Hémorragie:</strong> ${rec.q2}<br>
                <strong>Infarctus:</strong> ${rec.q3}<br>
                <strong>Chute:</strong> ${rec.q4}
            </div>
            ${rec.notes ? `<p style="font-size: 0.85em; margin-top: 8px; font-style: italic;">"${rec.notes}"</p>` : ''}
            ${isManager() ? `
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);" onclick="deleteRecrutement('${rec.id}')">Supprimer</button>
            </div>
            ` : ''}
        `;
        grid.appendChild(card);
    });
}

function renderAllowedDoctors() {
    const list = document.getElementById('allowed-doctors-list');
    list.innerHTML = '';
    if (appState.allowedDoctors.length === 0) {
        list.innerHTML = '<div class="empty-state"><p style="font-size: 0.9em; opacity: 0.7;">Aucun médecin exclusif, accès libre pour le moment.</p></div>';
        return;
    }
    appState.allowedDoctors.forEach(doc => {
        const pwdId = `pwd-${doc.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const eyeId = `eye-${doc.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '12px 16px';
        div.style.background = 'rgba(255, 255, 255, 0.03)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        div.style.marginBottom = '8px';
        div.style.borderRadius = '8px';
        div.style.gap = '12px';
        div.style.flexWrap = 'wrap';
        div.innerHTML = `
            <div style="flex: 1; min-width: 180px;">
                <span style="font-weight: 600; display: block; margin-bottom: 2px;"><strong>[${doc.rank}]</strong> ${doc.name} <span style="opacity:0.5; font-size:0.85em; font-weight:normal;">(@${doc.id})</span></span>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span id="${pwdId}" style="font-family: monospace; font-size: 0.85em; letter-spacing: 2px; opacity: 0.7;">••••••••</span>
                    <button type="button" id="${eyeId}" onclick="togglePasswordVisibility('${pwdId}', '${eyeId}', '${(doc.password || 'password').replace(/'/g, "&apos;")}')" style="background:none; border:none; cursor:pointer; color: var(--text-muted); padding:2px;" title="Afficher/masquer le mot de passe">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <button class="btn-secondary" onclick="changePassword('${doc.id}')" style="padding: 4px 10px; font-size: 0.8em;" title="Modifier le mot de passe">Changer MDP</button>
                <button class="btn-icon" onclick="removeDoctor('${doc.id}')" style="color: var(--danger);" title="Retirer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;
        list.appendChild(div);
    });
}

// Toggle password visibility in the doctor list
window.togglePasswordVisibility = function(targetId, btnId, plainText) {
    const el = document.getElementById(targetId);
    if (!el) return;
    // List mode: plainText is provided
    if (plainText !== undefined) {
        const isHidden = el.textContent.includes('•');
        el.textContent = isHidden ? plainText : '••••••••';
        return;
    }
    // Input mode (new-doctor-password field)
    const input = document.getElementById(targetId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

// Toggle visibility of a password input field
window.toggleInputPassword = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

// Open the change-password modal for a given doctor
window.changePassword = function(docId) {
    const doc = appState.allowedDoctors.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('change-pwd-doctor-id').value = docId;
    document.getElementById('change-pwd-subtitle').textContent = `Changer le mot de passe de ${doc.name} (@${doc.id})`;
    document.getElementById('change-pwd-new').value = '';
    document.getElementById('change-pwd-confirm').value = '';
    document.getElementById('change-pwd-error').style.display = 'none';
    // Reset input types
    document.getElementById('change-pwd-new').type = 'password';
    document.getElementById('change-pwd-confirm').type = 'password';

    document.getElementById('modal-change-password').classList.add('active');
};

// Wire the confirm button for the change-password modal
(function setupChangePwdModal() {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-confirm-change-pwd').addEventListener('click', () => {
            const docId = document.getElementById('change-pwd-doctor-id').value;
            const newPwd = document.getElementById('change-pwd-new').value.trim();
            const confirmPwd = document.getElementById('change-pwd-confirm').value.trim();
            const errorEl = document.getElementById('change-pwd-error');

            if (!newPwd) {
                errorEl.textContent = 'Le mot de passe ne peut pas être vide.';
                errorEl.style.display = 'block';
                return;
            }
            if (newPwd !== confirmPwd) {
                errorEl.textContent = 'Les mots de passe ne correspondent pas.';
                errorEl.style.display = 'block';
                return;
            }

            const doc = appState.allowedDoctors.find(d => d.id === docId);
            if (doc) {
                doc.password = newPwd;
                saveData();
                renderAllowedDoctors();
                showToast(`Mot de passe mis à jour pour ${doc.name}`);
            }

            document.getElementById('modal-change-password').classList.remove('active');
        });
    });
})();

window.removeDoctor = function(id) {
    if (id.toLowerCase() === 'mancini13') {
        showToast("Impossible de retirer le Directeur Général Mancini13");
        return;
    }
    appState.allowedDoctors = appState.allowedDoctors.filter(d => d.id !== id);
    saveData();
    renderAllowedDoctors();
    showToast("Médecin retiré de la liste");
};

window.deleteIntervention = function(patientId, intId) {
    if(confirm("Supprimer cette intervention ?")) {
        const p = appState.patients.find(x => x.id === patientId);
        if(p) {
            p.interventions = p.interventions.filter(i => i.id !== intId);
            saveData();
            renderInterventions(p);
            showToast("Intervention supprimée");
        }
    }
};

window.editIntervention = function(patientId, intId) {
    const p = appState.patients.find(x => x.id === patientId);
    if(p) {
        const int = p.interventions.find(i => i.id === intId);
        if(int) {
            const newDesc = prompt("Modifier la description :", int.description);
            if(newDesc !== null && newDesc.trim() !== "") {
                int.description = newDesc.trim();
                saveData();
                renderInterventions(p);
                showToast("Intervention modifiée");
            }
        }
    }
};

window.deleteRecrutement = function(id) {
    if(confirm("Supprimer cette évaluation de recrutement ?")) {
        appState.recrutements = appState.recrutements.filter(r => r.id !== id);
        saveData();
        renderRecrutements();
        showToast("Évaluation supprimée");
    }
};

window.deletePpa = function(id) {
    if(confirm("Supprimer cette évaluation PPA ?")) {
        appState.ppa = appState.ppa.filter(p => p.id !== id);
        saveData();
        renderPpa();
        showToast("Évaluation supprimée");
    }
};

window.printPpaCert = function(id) {
    const p = appState.ppa.find(x => x.id === id);
    if(!p) return;

    const dateObj = new Date(p.date);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const isApte = p.decision === 'Apte';

    const container = document.getElementById('print-container');
    container.innerHTML = `
        <div class="cert-logo">MedRP - Pôle de Médecine Légale et d'Évaluation</div>
        <div class="cert-title">CERTIFICAT D'APTITUDE<br>AU PORT D'ARME (PPA)</div>
        
        <div class="cert-body">
            <p>Je soussigné(e), <strong>${p.evaluator}</strong>, certifie avoir examiné ce jour, le <strong>${dateStr}</strong>, le/la candidat(e) :</p>
            <p style="font-size: 22px; text-align: center; font-weight: bold; margin: 30px 0;">${p.name}</p>
            <p>Cet examen comprenait une évaluation médicale générale, psychologique, ainsi que des mises en situation de stress et de jugement conformément à la législation en vigueur pour la délivrance d'un Permis de Port d'Arme (PPA).</p>
            
            <p>À l'issue de cet examen, et d'après les déclarations du candidat et mes observations cliniques, je déclare le candidat :</p>
            
            <div class="cert-status ${isApte ? 'cert-apte' : 'cert-inapte'}">
                ${isApte ? 'APTE AU PORT D\'ARME' : 'INAPTE AU PORT D\'ARME'}
            </div>
            
            ${!isApte ? `<p>Motif(s) médical(s) de l'inaptitude lié(s) aux résultats du test (Score : ${p.score}/10). Le candidat présente des facteurs de risques incompatibles avec la détention d'une arme à feu.</p>` : ''}
        </div>
        
        <div class="cert-footer">
            <p>Fait pour valoir ce que de droit.</p>
            <p style="margin-top: 30px; font-weight: bold;">Signature du Médecin :<br><br>_____________________<br><br>${p.evaluator}</p>
        </div>
    `;

    setTimeout(() => {
        window.print();
    }, 300);
};
