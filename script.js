// Core Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.getAttribute('data-target'));
            // Close mobile menu if open
            document.getElementById('nav-links').classList.remove('active');
        });
    });

    // Form: Severity Selection UI
    const severityRadios = document.querySelectorAll('.severity-radio');
    severityRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            severityRadios.forEach(r => {
                r.style.borderColor = 'rgba(255,255,255,0.1)';
                r.style.background = 'transparent';
            });
            const input = radio.querySelector('input');
            input.checked = true;
            const colors = { 'low': '#10b981', 'medium': '#eab308', 'high': '#f97316', 'critical': '#ef4444' };
            radio.style.borderColor = colors[input.value];
            radio.style.background = 'rgba(255,255,255,0.05)';
        });
    });

    fetchStats();
});

// View Switching
function switchView(viewId) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-target') === viewId);
    });
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `${viewId}-view`);
    });
    if (viewId === 'dashboard') refreshDashboardData();
}

// Dashboard Module Switching
function switchDashboardTab(tabId) {
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.classList.toggle('active', li.textContent.toLowerCase().includes(tabId));
    });
    document.querySelectorAll('.dash-module').forEach(mod => {
        mod.classList.toggle('active', mod.id === `module-${tabId}`);
    });

    const titles = {
        'overview': 'Command Overview',
        'incidents': 'Incident Log',
        'inventory': 'Supply Inventory',
        'volunteers': 'Volunteer Network',
        'shelters': 'Relief Camps'
    };
    document.getElementById('dash-title').innerText = titles[tabId] || 'Dashboard';

    if (tabId === 'overview') { fetchStats(); fetchIncidents(true); }
    else if (tabId === 'incidents') fetchIncidents(false);
    else if (tabId === 'inventory') fetchInventory();
    else if (tabId === 'volunteers') fetchVolunteers();
    else if (tabId === 'shelters') fetchShelters();
}

function refreshDashboardData() {
    const activeModule = document.querySelector('.dash-module.active')?.id.replace('module-', '') || 'overview';
    switchDashboardTab(activeModule);
    document.getElementById('last-updated').innerText = `Sync: ${new Date().toLocaleTimeString()}`;
}

// API Integration
async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setIfExits('stat-volunteers', data.volunteers);
        setIfExits('stat-camps', data.camps);
        setIfExits('stat-resources', data.resources);
        setIfExits('kpi-critical', data.critical_alerts);
        setIfExits('kpi-active', data.active_incidents);
        setIfExits('kpi-resolved', data.resolved_24h);
    } catch (err) { console.error(err); }
}

async function fetchIncidents(isMini) {
    try {
        const res = await fetch('/api/incidents');
        const incidents = await res.json();
        if (isMini) {
            const list = document.getElementById('report-list-mini');
            list.innerHTML = '';
            incidents.slice(0, 5).forEach(inc => {
                const li = document.createElement('li');
                li.className = 'report-item';
                li.innerHTML = `
                    <div class="report-icon ${['high', 'critical'].includes(inc.severity) ? 'high' : 'med'}"><i class="fas ${getIcon(inc.type)}"></i></div>
                    <div class="report-details">
                        <h4>${inc.type} - ${inc.location}</h4>
                        <span class="time">${new Date(inc.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                `;
                list.appendChild(li);
            });
        } else {
            const tbody = document.getElementById('incidents-tbody');
            tbody.innerHTML = '';
            incidents.forEach(inc => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(inc.timestamp + 'Z').toLocaleString()}</td>
                    <td style="text-transform: capitalize;">${inc.type}</td>
                    <td>${inc.location}</td>
                    <td><span class="status-badge ${inc.severity === 'critical' ? 'urgent' : 'pending'}">${inc.severity}</span></td>
                    <td>${inc.status}</td>
                    <td><button class="btn btn-sm btn-outline">Manage</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) { console.error(err); }
}

async function fetchInventory() {
    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card glass';
            card.innerHTML = `<span>${item.category}</span><h2>${item.quantity}</h2><h4>${item.item}</h4>`;
            grid.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

async function fetchVolunteers() {
    try {
        const res = await fetch('/api/volunteers');
        const data = await res.json();
        const list = document.getElementById('volunteer-list');
        list.innerHTML = '';
        data.forEach(v => {
            const row = document.createElement('div');
            row.className = 'data-row';
            row.innerHTML = `<div class="data-main"><div class="data-icon"><i class="fas fa-user-shield"></i></div><div><h4>${v.name}</h4><p>${v.skill} Expert</p></div></div><div><span class="status-badge pending">${v.availability}</span></div>`;
            list.appendChild(row);
        });
    } catch (err) { console.error(err); }
}

async function fetchShelters() {
    try {
        const res = await fetch('/api/shelters');
        const data = await res.json();
        const grid = document.getElementById('shelter-grid');
        grid.innerHTML = '';
        data.forEach(s => {
            const p = Math.round((s.occupied / s.capacity) * 100);
            const row = document.createElement('div');
            row.className = 'data-row';
            row.innerHTML = `<div class="data-main"><div class="data-icon"><i class="fas fa-campground"></i></div><div><h4>${s.name}</h4><p>${s.location}</p></div></div><div style="text-align:right"><span>${s.occupied}/${s.capacity}</span><br><strong>${p}% Full</strong></div>`;
            grid.appendChild(row);
        });
    } catch (err) { console.error(err); }
}

// --- Geolocation & File Upload Fixes ---

function getLocation() {
    const locInput = document.getElementById('location-field');
    locInput.value = "Locating via Satellite...";

    if (!navigator.geolocation) {
        locInput.value = "GPS Not Supported";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude.toFixed(4);
            const lng = pos.coords.longitude.toFixed(4);
            locInput.value = `${lat}, ${lng} (Auto-detected)`;
        },
        (err) => {
            console.error(err);
            locInput.value = "34.0522, -118.2437 (Default)";
            alert("Location access denied. Using center coordinates.");
        }
    );
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        document.getElementById('file-name').innerText = `Media Attached: ${file.name}`;
    }
}

async function submitReport() {
    const btn = document.querySelector('#incident-form button[type="submit"]');
    const original = btn.innerHTML;

    const formData = new FormData();
    formData.append('type', document.getElementById('inc-type').value);
    formData.append('severity', document.querySelector('input[name="severity"]:checked').value);
    formData.append('location', document.getElementById('location-field').value || "Unknown");
    formData.append('description', document.getElementById('inc-desc').value);

    const fileInput = document.getElementById('file-input');
    if (fileInput.files.length > 0) {
        formData.append('media', fileInput.files[0]);
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/incidents', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error();

        btn.innerHTML = '<i class="fas fa-check"></i> Report Submitted';
        btn.classList.add('btn-success');

        setTimeout(() => {
            document.getElementById('incident-form').reset();
            document.getElementById('file-name').innerText = "Click to upload images or videos";
            btn.innerHTML = original; btn.disabled = false; btn.classList.remove('btn-success');
            switchView('dashboard');
        }, 1500);
    } catch (err) {
        btn.innerHTML = 'Error';
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
    }
}

function getIcon(t) { return { 'flood': 'fa-water', 'fire': 'fa-fire', 'earthquake': 'fa-house-damage', 'medical': 'fa-medkit', 'sos': 'fa-broadcast-tower' }[t] || 'fa-exclamation-triangle'; }
function setIfExits(id, v) { const el = document.getElementById(id); if (el) el.innerText = v; }
function openLogin() { document.getElementById('login-modal').classList.add('active'); }
function closeLogin() { document.getElementById('login-modal').classList.remove('active'); }
window.onclick = (e) => { if (e.target.id === 'login-modal') closeLogin(); }

// --- Mobile Navigation ---
function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('active');
}

// --- SOS Logic ---
async function triggerSOS() {
    const overlay = document.getElementById('sos-overlay');
    const statusText = document.getElementById('sos-status');
    const sosBtn = document.getElementById('sos-btn');

    // UI Feedback
    overlay.classList.add('active');
    if (sosBtn) sosBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transmitting...';

    // 1. Get Location
    let locationStr = "Unknown Origin (SOS)";
    if (navigator.geolocation) {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            locationStr = `SOS GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
            statusText.innerText = "Location locked. Transmitting to Command Center...";
        } catch (err) {
            console.warn("SOS Geolocation failed:", err);
            statusText.innerText = "GPS unavailable. Transmitting generic alert...";
        }
    }

    // 2. Send API Request
    const formData = new FormData();
    formData.append('type', 'sos');
    formData.append('severity', 'critical');
    formData.append('location', locationStr);
    formData.append('description', 'URGENT: Automated SOS Triggered by User. Immediate assistance required.');

    try {
        const res = await fetch('/api/incidents', {
            method: 'POST',
            body: formData
        });

        // Success
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            statusText.innerHTML = "<strong>CRITICAL ALERT RECEIVED</strong><br>Opening Emergency SMS...";
            // Trigger Native SMS App
            const emergencyNumber = "911"; // Replace with local emergency number if needed
            const smsBody = encodeURIComponent(`URGENT EMERGENCY!\nLocation: ${locationStr}\nPlease send immediate assistance.`);

            // Use a slight delay for visual feedback before opening the app
            setTimeout(() => {
                window.location.href = `sms:${emergencyNumber}?body=${smsBody}`;
            }, 1500);
        } else {
            statusText.innerHTML = "<strong>CRITICAL ALERT RECEIVED</strong><br>Help sequence initialized in Command Center.";
        }

        // Auto-close after 4 seconds
        setTimeout(() => {
            overlay.classList.remove('active');
            if (sosBtn) sosBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> SOS';
            // Open dashboard to show the new alert
            switchView('dashboard');
        }, 4000);

    } catch (err) {
        console.error("SOS Transmission Error:", err);
        statusText.innerHTML = "Transmission Failed! Please call emergency services locally.";
        setTimeout(() => {
            overlay.classList.remove('active');
            if (sosBtn) sosBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> SOS';
        }, 3000);
    }
}
