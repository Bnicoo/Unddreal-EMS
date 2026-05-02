(function() {
    // Configuration Supabase
    const SUPABASE_URL = 'https://cfwztjsjiqrqxxqyskrz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd3p0anNqaXFycXh4cXlza3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzM4MzcsImV4cCI6MjA5MjgwOTgzN30.ajcKKcOjVpsNuAaC2Mook0xHj_LaDAbOj-9zlkuk4H4';
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let appState = {
        currentDoctorId: null,
        currentDoctorName: null,
        currentRank: 'Médecin',
        currentView: 'view-login',
        activePatientId: null,
        patients: [],
        allowedDoctors: [],
        recrutements: [],
        ppa: []
    };

    // Initialization
    document.addEventListener('DOMContentLoaded', async () => {
        setupEventListeners();
        await loadData();
        
        // Check session in localStorage (only for the login state)
        const session = localStorage.getItem('medrp_session');
        if (session) {
            const data = JSON.parse(session);
            appState.currentDoctorId = data.id;
            appState.currentDoctorName = data.name;
            appState.currentRank = data.rank;
            
            const nameDisplay = document.getElementById('doctor-name-display');
            if (nameDisplay) {
                nameDisplay.innerHTML = `<strong>[${appState.currentRank}]</strong> ${appState.currentDoctorName}`;
            }
            switchView('view-dashboard');
            renderPatients();
            applyPermissions();
        } else {
            switchView('view-login');
        }
    });

    // Load everything from Supabase
    async function loadData() {
        try {
            // Load Doctors
            const { data: doctors } = await _supabase.from('doctors').select('*');
            appState.allowedDoctors = doctors || [];

            // Load Patients
            const { data: patients } = await _supabase.from('patients').select('*');
            appState.patients = (patients || []).map(p => ({
                ...p,
                firstName: p.first_name,
                lastName: p.last_name,
                bloodType: p.blood_type
            }));

            // Load Recrutements
            const { data: recrutements } = await _supabase.from('recrutements').select('*');
            appState.recrutements = recrutements || [];

            // Load PPA
            const { data: ppa } = await _supabase.from('ppa').select('*');
            appState.ppa = ppa || [];

        } catch (e) {
            console.error("Erreur lors du chargement des données Supabase:", e);
        }
    }

    // Session save (only for login state)
    function saveSession() {
        localStorage.setItem('medrp_session', JSON.stringify({
            id: appState.currentDoctorId,
            name: appState.currentDoctorName,
            rank: appState.currentRank
        }));
    }

    function clearSession() {
        localStorage.removeItem('medrp_session');
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
        if (!container) return;
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
        // SECURITY: If trying to access any view other than login without being authenticated
        if (viewId !== 'view-login' && !appState.currentDoctorId) {
            console.warn("Accès refusé : Session non valide.");
            viewId = 'view-login';
        }

        // Hide all views
        document.querySelectorAll('.view').forEach(el => {
            el.classList.remove('active');
            el.classList.add('hidden');
        });

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
            // Small delay to allow display block to apply before opacity transition
            setTimeout(() => target.classList.add('active'), 50);
        }

        // Toggle header
        const header = document.getElementById('main-header');
        if (header) {
            if (viewId === 'view-login') {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
            }
        }

        appState.currentView = viewId;
    }

    // Render Functions
    function renderPatients(searchQuery = '') {
        const grid = document.getElementById('patients-grid');
        if (!grid) return;
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

    async function openPatient(id) {
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

        // Fetch interventions from Supabase
        const { data: interventions } = await _supabase.from('interventions').select('*').eq('patient_id', id);
        patient.interventions = interventions || [];

        renderInterventions(patient);
        switchView('view-patient');
    }

    function renderInterventions(patient) {
        const timeline = document.getElementById('interventions-timeline');
        if (!timeline) return;
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
            
            const actionButtons = isManager() ? `
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button class="btn-secondary btn-edit-int" data-patient-id="${patient.id}" data-int-id="${int.id}" style="padding: 4px 10px; font-size: 0.8em;">Modifier</button>
                <button class="btn-secondary btn-delete-int" data-patient-id="${patient.id}" data-int-id="${int.id}" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);">Supprimer</button>
            </div>
            ` : '';

            div.innerHTML = `
                <div class="intervention-meta">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px; vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr} à ${timeStr}</span>
                    <span class="intervention-doctor">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${int.doctor_name || int.doctor}
                    </span>
                </div>
                <h4>${int.title}</h4>
                <div class="intervention-desc">
                    ${(int.description || '').replace(/\n/g, '<br>')}
                </div>
                ${int.prescriptions ? `
                    <div class="intervention-prescriptions">
                        <strong>Prescriptions :</strong> ${int.prescriptions}
                    </div>
                ` : ''}
                ${actionButtons}
            `;
            timeline.appendChild(div);
        });

        // Attach event listeners to newly created buttons
        timeline.querySelectorAll('.btn-edit-int').forEach(btn => {
            btn.addEventListener('click', () => editIntervention(btn.dataset.patientId, btn.dataset.intId));
        });
        timeline.querySelectorAll('.btn-delete-int').forEach(btn => {
            btn.addEventListener('click', () => deleteIntervention(btn.dataset.patientId, btn.dataset.intId));
        });
    }

    // Event Listeners
    function setupEventListeners() {
        // Login
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('doctor-name').value.trim();
                const password = document.getElementById('doctor-password').value.trim();
                
                if (name && password) {
                    // Check Admin first
                    if (name.toLowerCase() === 'admin' && password === 'admin') {
                        appState.currentDoctorId = 'admin';
                        appState.currentDoctorName = 'Administrateur';
                        appState.currentRank = 'Directeur Général';
                    } else {
                        // Check Supabase
                        const { data: doctor, error } = await _supabase
                            .from('doctors')
                            .select('*')
                            .eq('id', name)
                            .single();

                        if (doctor && doctor.password === password) {
                            appState.currentDoctorId = doctor.id;
                            appState.currentDoctorName = doctor.name;
                            appState.currentRank = doctor.rank;
                        } else {
                            showToast(`Accès refusé. Identifiant ou mot de passe incorrect.`);
                            return;
                        }
                    }

                    document.getElementById('doctor-name-display').innerHTML = `<strong>[${appState.currentRank}]</strong> ${appState.currentDoctorName}`;
                    saveSession();
                    switchView('view-dashboard');
                    renderPatients();
                    applyPermissions();
                    showToast(`Bienvenue, ${appState.currentDoctorName}`);
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                appState.currentDoctorId = null;
                appState.currentDoctorName = null;
                clearSession();
                switchView('view-login');
                document.getElementById('doctor-name').value = '';
                document.getElementById('doctor-password').value = '';
            });
        }

        // Search
        const searchInput = document.getElementById('search-patient');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderPatients(e.target.value);
            });
        }

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

        document.getElementById('btn-delete-patient').addEventListener('click', async () => {
            if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce dossier patient ?')) {
                const { error } = await _supabase.from('patients').delete().eq('id', appState.activePatientId);
                if (error) {
                    showToast("Erreur lors de la suppression");
                    return;
                }
                appState.patients = appState.patients.filter(p => p.id !== appState.activePatientId);
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

        document.getElementById('form-add-patient').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const patientData = {
                first_name: formData.get('firstName'),
                last_name: formData.get('lastName'),
                age: parseInt(formData.get('age')),
                gender: formData.get('gender'),
                blood_type: formData.get('bloodType'),
                allergies: formData.get('allergies'),
                history: formData.get('history')
            };

            if (appState.editingPatientId) {
                const { error } = await _supabase.from('patients').update(patientData).eq('id', appState.editingPatientId);
                if (error) { console.error(error); showToast("Erreur de mise à jour"); return; }
                
                // Update local state (keep camelCase for UI if needed, or update everything)
                const pIndex = appState.patients.findIndex(p => p.id === appState.editingPatientId);
                if (pIndex !== -1) {
                    appState.patients[pIndex] = { 
                        ...appState.patients[pIndex], 
                        firstName: patientData.first_name,
                        lastName: patientData.last_name,
                        bloodType: patientData.blood_type,
                        ...patientData 
                    };
                }
                
                showToast("Dossier patient mis à jour");
                openPatient(appState.editingPatientId);
            } else {
                const newPatient = {
                    id: generateId().toUpperCase(),
                    ...patientData
                };

                const { error } = await _supabase.from('patients').insert([newPatient]);
                if (error) { console.error(error); showToast("Erreur de création"); return; }
                
                appState.patients.push({
                    ...newPatient,
                    firstName: newPatient.first_name,
                    lastName: newPatient.last_name,
                    bloodType: newPatient.blood_type
                });
                showToast("Dossier patient créé avec succès");
            }
            
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
            document.querySelector('input[name="date"]').value = now.toISOString().slice(0, 16);

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
                    if (c.checked) total += parseInt(c.dataset.price, 10);
                });
                document.getElementById('intervention-total-price').textContent = total.toLocaleString('en-US') + ' $';
                document.getElementById('input-total-price').value = total;
            });
        });

        document.getElementById('form-add-intervention').addEventListener('submit', async (e) => {
            e.preventDefault();
            const patient = appState.patients.find(p => p.id === appState.activePatientId);
            if (!patient) return;

            const formData = new FormData(e.target);
            const soins = formData.getAll('soins');
            const notes = formData.get('notes');
            const total = formData.get('totalPrice');
            
            let desc = `Soins facturés : ${soins.length > 0 ? soins.join(', ') : 'Aucun'}`;
            if(parseInt(total, 10) > 0) desc += `\nTotal facturé : ${total} $`;
            if(notes) desc += `\n\nNotes : ${notes}`;
            
            const newIntervention = {
                patient_id: patient.id,
                title: formData.get('title'),
                date: formData.get('date'),
                doctor_name: formData.get('doctor'),
                severity: formData.get('severity'),
                description: desc,
                prescriptions: formData.get('prescriptions'),
                total_price: parseInt(total)
            };

            const { error } = await _supabase.from('interventions').insert([newIntervention]);
            if (error) { showToast("Erreur d'enregistrement"); return; }
            
            document.getElementById('modal-add-intervention').classList.remove('active');
            openPatient(patient.id);
            showToast("Intervention enregistrée");
        });

        // Moderation Settings
        document.getElementById('settings-btn').addEventListener('click', () => {
            renderAllowedDoctors();
            if (document.getElementById('export-output')) {
                document.getElementById('export-output').style.display = 'none';
            }
            document.getElementById('modal-settings').classList.add('active');
        });

        document.getElementById('form-add-doctor').addEventListener('submit', async (e) => {
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
                const newDoc = { id, name: rpName, rank, password };
                const { error } = await _supabase.from('doctors').insert([newDoc]);
                if (error) { showToast("Erreur de création du médecin"); return; }
                
                appState.allowedDoctors.push(newDoc);
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
            document.getElementById('visite-date').value = now.toISOString().slice(0, 16);
            document.getElementById('visite-doctor').value = appState.currentDoctorName;

            document.getElementById('modal-add-visite').classList.add('active');
        });

        document.getElementById('form-add-visite').addEventListener('submit', async (e) => {
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
                patient_id: patient.id,
                title: "Visite Médicale (QCM)",
                date: formData.get('date'),
                doctor_name: formData.get('doctor'),
                severity: q5.includes('Urgence') ? 'elevee' : (q5.includes('Légère') ? 'moyenne' : 'faible'),
                description: description,
                prescriptions: ""
            };

            const { error } = await _supabase.from('interventions').insert([newIntervention]);
            if (error) { showToast("Erreur d'enregistrement"); return; }
            
            document.getElementById('modal-add-visite').classList.remove('active');
            openPatient(patient.id);
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

        document.getElementById('form-recrutement').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const answers = {
                q1: formData.get('r_q1'),
                q2: formData.get('r_q2'),
                q3: formData.get('r_q3'),
                q4: formData.get('r_q4'),
                q5: formData.get('r_q5'),
                q6: formData.get('r_q6'),
                q7: formData.get('r_q7'),
                q8: formData.get('r_q8'),
                q9: formData.get('r_q9'),
                q10: formData.get('r_q10')
            };

            let score = 0;
            if (answers.q1 === 'Compression/Garrot') score++;
            if (answers.q2 === 'Rassurer et expliquer') score++;
            if (answers.q3 === 'Rectifier discrètement') score++;
            if (answers.q4 === 'Oxygénation / ACR') score++;
            if (answers.q5 === 'Load and Go (Bloc)') score++;
            if (answers.q6 === 'Expliquer la sécurité') score++;
            if (answers.q7 === 'Triage (Gravité)') score++;
            if (answers.q8 === 'Suivre le Triage') score++;
            if (answers.q9 === 'Urgence et sécurité') score++;
            if (answers.q10 === 'Convaincre / Respect') score++;

            let decision = 'Refusé';
            if (score >= 8) decision = 'Accepté';
            else if (score >= 6) decision = 'En attente';

            const newRecrutement = {
                id: generateId(),
                name: formData.get('candidate_name'),
                evaluator: formData.get('evaluator'),
                date: formData.get('date'),
                ...answers,
                decision: decision,
                notes: formData.get('notes'),
                score: score
            };

            const { error } = await _supabase.from('recrutements').insert([newRecrutement]);
            if (error) { showToast("Erreur d'enregistrement"); return; }
            
            appState.recrutements.push(newRecrutement);
            document.getElementById('modal-add-recrutement').classList.remove('active');
            renderRecrutements();
            showToast(`Évaluation terminée : ${decision} (${score}/10)`);
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

        document.getElementById('form-ppa').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const q1 = formData.get('p_q1');
            const q2 = formData.get('p_q2');
            const q3 = formData.get('p_q3');
            const q4 = formData.get('p_q4');

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
                name: formData.get('candidate_name'),
                evaluator: formData.get('evaluator'),
                date: formData.get('date'),
                q1, q2, q3, q4, 
                notes: formData.get('notes'),
                score, 
                decision
            };

            const { error } = await _supabase.from('ppa').insert([newPpa]);
            if (error) { showToast("Erreur d'enregistrement"); return; }
            
            appState.ppa.push(newPpa);
            document.getElementById('modal-add-ppa').classList.remove('active');
            renderPpa();
            showToast("Test PPA automatisé terminé");
        });

        // Change Password Confirmation
        const confirmBtn = document.getElementById('btn-confirm-change-pwd');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
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

                const { error } = await _supabase.from('doctors').update({ password: newPwd }).eq('id', docId);
                if (error) { showToast("Erreur lors du changement de mot de passe"); return; }
                
                const doc = appState.allowedDoctors.find(d => d.id === docId);
                if (doc) doc.password = newPwd;
                
                renderAllowedDoctors();
                showToast(`Mot de passe mis à jour`);
                document.getElementById('modal-change-password').classList.remove('active');
            });
        }
    }

    function renderPpa() {
        const grid = document.getElementById('ppa-grid');
        if (!grid) return;
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
            
            const managerActions = isManager() ? `<button class="btn-secondary btn-delete-ppa" data-id="${p.id}" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);">Supprimer</button>` : '';

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
                    <button class="btn-primary btn-print-ppa" data-id="${p.id}" style="padding: 4px 10px; font-size: 0.8em;">Certificat PDF</button>
                    ${managerActions}
                </div>
            `;
            grid.appendChild(card);
        });

        // Event listeners
        grid.querySelectorAll('.btn-print-ppa').forEach(btn => btn.addEventListener('click', () => printPpaCert(btn.dataset.id)));
        grid.querySelectorAll('.btn-delete-ppa').forEach(btn => btn.addEventListener('click', () => deletePpa(btn.dataset.id)));
    }

    function renderRecrutements() {
        const grid = document.getElementById('recrutement-grid');
        if (!grid) return;
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
            
            const managerActions = isManager() ? `
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button class="btn-secondary btn-delete-rec" data-id="${rec.id}" style="padding: 4px 10px; font-size: 0.8em; color: var(--status-elevee); border-color: var(--status-elevee);">Supprimer</button>
            </div>
            ` : '';

            card.innerHTML = `
                <div class="patient-card-header" style="margin-bottom: 8px;">
                    <div>
                        <h3>${rec.name}</h3>
                        <p class="subtitle" style="font-size: 0.85em;">Évalué le ${dateStr} par ${rec.evaluator}</p>
                    </div>
                </div>
                <div class="badges" style="margin-bottom: 12px;">
                    <span class="badge ${statusBadge}" style="background-color: ${statusBadge === '' ? statusColor : 'transparent'}; color: ${statusBadge === '' ? 'white' : statusColor}; border-color: ${statusColor}">${rec.decision} (${rec.score !== undefined ? rec.score : '?'}/10)</span>
                </div>
                <div style="font-size: 0.85em; opacity: 0.8; margin-top: 10px; background: rgba(0,0,0,0.02); padding: 8px; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div><strong>Q1:</strong> ${rec.q1 || '-'}</div>
                    <div><strong>Q2:</strong> ${rec.q2 || '-'}</div>
                    <div><strong>Q3:</strong> ${rec.q3 || '-'}</div>
                    <div><strong>Q4:</strong> ${rec.q4 || '-'}</div>
                    <div><strong>Q5:</strong> ${rec.q5 || '-'}</div>
                    <div><strong>Q6:</strong> ${rec.q6 || '-'}</div>
                    <div><strong>Q7:</strong> ${rec.q7 || '-'}</div>
                    <div><strong>Q8:</strong> ${rec.q8 || '-'}</div>
                    <div><strong>Q9:</strong> ${rec.q9 || '-'}</div>
                    <div><strong>Q10:</strong> ${rec.q10 || '-'}</div>
                </div>
                ${rec.notes ? `<p style="font-size: 0.85em; margin-top: 8px; font-style: italic;">"${rec.notes}"</p>` : ''}
                ${managerActions}
            `;
            grid.appendChild(card);
        });

        grid.querySelectorAll('.btn-delete-rec').forEach(btn => btn.addEventListener('click', () => deleteRecrutement(btn.dataset.id)));
    }

    function renderAllowedDoctors() {
        const list = document.getElementById('allowed-doctors-list');
        if (!list) return;
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
                        <button type="button" class="btn-toggle-pwd" data-target="${pwdId}" data-eye="${eyeId}" data-pwd="${(doc.password || 'password').replace(/'/g, "&apos;")}" style="background:none; border:none; cursor:pointer; color: var(--text-muted); padding:2px;" title="Afficher/masquer le mot de passe">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="btn-secondary btn-change-pwd" data-id="${doc.id}" style="padding: 4px 10px; font-size: 0.8em;" title="Modifier le mot de passe">Changer MDP</button>
                    <button class="btn-icon btn-remove-doc" data-id="${doc.id}" style="color: var(--danger);" title="Retirer">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            list.appendChild(div);
        });

        // Event listeners
        list.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
            btn.addEventListener('click', () => togglePasswordVisibility(btn.dataset.target, btn.dataset.eye, btn.dataset.pwd));
        });
        list.querySelectorAll('.btn-change-pwd').forEach(btn => {
            btn.addEventListener('click', () => changePassword(btn.dataset.id));
        });
        list.querySelectorAll('.btn-remove-doc').forEach(btn => {
            btn.addEventListener('click', () => removeDoctor(btn.dataset.id));
        });
    }

    // --- Sensitive Functions (Private) ---

    async function removeDoctor(id) {
        if (id.toLowerCase() === 'mancini13') {
            showToast("Impossible de retirer le Directeur Général Mancini13");
            return;
        }
        if(confirm("Retirer ce médecin ?")) {
            const { error } = await _supabase.from('doctors').delete().eq('id', id);
            if (error) { showToast("Erreur de suppression"); return; }
            
            appState.allowedDoctors = appState.allowedDoctors.filter(d => d.id !== id);
            renderAllowedDoctors();
            showToast("Médecin retiré");
        }
    }

    async function deleteIntervention(patientId, intId) {
        if(confirm("Supprimer cette intervention ?")) {
            const { error } = await _supabase.from('interventions').delete().eq('id', intId);
            if (error) { showToast("Erreur de suppression"); return; }
            
            const p = appState.patients.find(x => x.id === patientId);
            if(p) {
                p.interventions = p.interventions.filter(i => i.id !== intId);
                renderInterventions(p);
                showToast("Intervention supprimée");
            }
        }
    }

    async function editIntervention(patientId, intId) {
        const p = appState.patients.find(x => x.id === patientId);
        if(p) {
            const int = p.interventions.find(i => i.id === intId);
            if(int) {
                const newDesc = prompt("Modifier la description :", int.description);
                if(newDesc !== null && newDesc.trim() !== "") {
                    const { error } = await _supabase.from('interventions').update({ description: newDesc.trim() }).eq('id', intId);
                    if (error) { showToast("Erreur de modification"); return; }
                    
                    int.description = newDesc.trim();
                    renderInterventions(p);
                    showToast("Intervention modifiée");
                }
            }
        }
    }

    async function deleteRecrutement(id) {
        if(confirm("Supprimer cette évaluation de recrutement ?")) {
            const { error } = await _supabase.from('recrutements').delete().eq('id', id);
            if (error) { showToast("Erreur de suppression"); return; }
            
            appState.recrutements = appState.recrutements.filter(r => r.id !== id);
            renderRecrutements();
            showToast("Évaluation supprimée");
        }
    }

    async function deletePpa(id) {
        if(confirm("Supprimer cette évaluation PPA ?")) {
            const { error } = await _supabase.from('ppa').delete().eq('id', id);
            if (error) { showToast("Erreur de suppression"); return; }
            
            appState.ppa = appState.ppa.filter(p => p.id !== id);
            renderPpa();
            showToast("Évaluation supprimée");
        }
    }

    function changePassword(docId) {
        const doc = appState.allowedDoctors.find(d => d.id === docId);
        if (!doc) return;

        document.getElementById('change-pwd-doctor-id').value = docId;
        document.getElementById('change-pwd-subtitle').textContent = `Changer le mot de passe de ${doc.name} (@${doc.id})`;
        document.getElementById('change-pwd-new').value = '';
        document.getElementById('change-pwd-confirm').value = '';
        const errorEl = document.getElementById('change-pwd-error');
        if (errorEl) errorEl.style.display = 'none';
        document.getElementById('change-pwd-new').type = 'password';
        document.getElementById('change-pwd-confirm').type = 'password';

        document.getElementById('modal-change-password').classList.add('active');
    }

    function printPpaCert(id) {
        const p = appState.ppa.find(x => x.id === id);
        if (!p) return;

        const dateObj = new Date(p.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const isApte = p.decision === 'Apte';

        const container = document.getElementById('print-container');
        if (!container) return;
        container.innerHTML = `
            <div class="cert-logo">Unddreal EMS - Pôle de Médecine Légale et d'Évaluation</div>
            <div class="cert-title">CERTIFICAT D'APTITUDE<br>AU PORT D'ARME (PPA)</div>
            
            <div class="cert-body">
                <p>Je soussigné(e), <strong>${p.evaluator}</strong>, certifie avoir examiné ce jour, le <strong>${dateStr}</strong>, le/la candidat(e) :</p>
                <p style="font-size: 20px; text-align: center; font-weight: bold; margin: 15px 0;">${p.name}</p>
                <p>Cet examen comprenait une évaluation médicale générale, psychologique, ainsi que des mises en situation de stress et de jugement conformément à la législation en vigueur pour la délivrance d'un Permis de Port d'Arme (PPA).</p>
                
                <p>À l'issue de cet examen, et d'après les déclarations du candidat et mes observations cliniques, je déclare le candidat :</p>
                
                <div class="cert-status ${isApte ? 'cert-apte' : 'cert-inapte'}">
                    ${isApte ? 'APTE AU PORT D\'ARME' : 'INAPTE AU PORT D\'ARME'}
                </div>
                
                ${!isApte ? `<p style="margin-top: 10px;">Motif(s) médical(s) de l'inaptitude lié(s) aux résultats du test (Score : ${p.score}/10). Le candidat présente des facteurs de risques incompatibles avec la détention d'une arme à feu.</p>` : ''}
            </div>
            
            <div class="cert-footer">
                <p>Fait pour valoir ce que de droit.</p>
                <p style="margin-top: 20px; font-weight: bold;">Signature du Médecin :<br><br>_____________________<br><br>${p.evaluator}</p>
            </div>
        `;

        setTimeout(() => {
            window.print();
        }, 300);
    }

    window.togglePasswordVisibility = function (targetId, btnId, plainText) {
        const el = document.getElementById(targetId);
        if (!el) return;
        if (plainText !== undefined) {
            const isHidden = el.textContent.includes('•');
            el.textContent = isHidden ? plainText : '••••••••';
            return;
        }
        const input = document.getElementById(targetId);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    };

    window.toggleInputPassword = function(id) {
        const input = document.getElementById(id);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    };

})();
