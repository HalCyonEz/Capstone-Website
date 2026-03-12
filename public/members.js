console.log("🎯 members.js loaded - App Status Badges & Fast Reporting Active");
feather.replace();

const ITEMS_PER_PAGE = 100; 
let currentPage = 1;
let allMembersCache = []; 
let filteredMembers = []; 

// Default Filters 
let activeFilters = { 
    category: "", municipality: "", gender: "", 
    philhealth: "", appStatus: "", search: "", ageMin: "", 
    ageMax: "", dateFrom: "", dateTo: "", 
    childrenMin: "" 
};
let searchTimeout = null;

const CATEGORIES = {
    'a1': 'Birth of a child as a consequence of rape',
    'a2': 'Widow/widower',
    'a3': 'Spouse of person deprived of liberty',
    'a4': 'Spouse with physical/mental incapacity',
    'a5': 'Due to legal separation or de facto separation',
    'a6': 'Due to nullity or annulment of marriage',
    'a7': 'Abandonment by the spouse',
    'b1': 'Spouse of OFW',
    'b2': 'Relative of OFW',
    'c': 'Unmarried mother/father',
    'd': 'Legal guardian',
    'e': 'Family member/relative',
    'f': 'Foster parent'
};

document.addEventListener('DOMContentLoaded', async function() {
    const firebaseConfig = { 
        apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24", 
        authDomain: "solo-parent-app.firebaseapp.com", 
        databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app", 
        projectId: "solo-parent-app", 
        storageBucket: "solo-parent-app.firebasestorage.app", 
        messagingSenderId: "292578110807", 
        appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212" 
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore(); 

    const restored = restoreState();
    fetchAllMembers(restored);
});

// =============================================
// 1. STATE MANAGEMENT
// =============================================
function saveState() {
    const state = { filters: activeFilters, page: currentPage };
    sessionStorage.setItem('spda_member_state', JSON.stringify(state));
}

function restoreState() {
    const saved = sessionStorage.getItem('spda_member_state');
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        activeFilters = state.filters;
        currentPage = state.page || 1;

        document.getElementById('f-search').value = activeFilters.search || "";
        document.getElementById('f-category').value = activeFilters.category || "";
        document.getElementById('f-municipality').value = activeFilters.municipality || "";
        document.getElementById('f-gender').value = activeFilters.gender || "";
        document.getElementById('f-philhealth').value = activeFilters.philhealth || "";
        document.getElementById('f-app-status').value = activeFilters.appStatus || ""; 
        document.getElementById('f-age-min').value = activeFilters.ageMin || "";
        document.getElementById('f-age-max').value = activeFilters.ageMax || "";
        
        if (activeFilters.category) {
            setTimeout(() => {
                const row = document.getElementById(`cat-row-${activeFilters.category}`);
                if(row) row.classList.add('bg-blue-50', 'border-blue-200');
                document.getElementById('cat-all-btn').classList.remove('bg-blue-50', 'text-blue-700');
            }, 500);
        }
        return true; 
    } catch (e) {
        return false;
    }
}

function clearState() {
    sessionStorage.removeItem('spda_member_state');
}

// =============================================
// 2. DATA FETCHING (Official Records)
// =============================================
async function fetchAllMembers(isRestoring = false) {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<div class="col-span-2 text-center py-10 text-blue-500"><i data-feather="loader" class="animate-spin inline w-5 h-5 mr-2"></i> Loading LGU Database...</div>';
    feather.replace();
    
    try {
        const snapshot = await window.db.collection("solo_parent_records").get();
        allMembersCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        calculateCategoryStats(allMembersCache);
        applyFiltersLogic(isRestoring);
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-2 text-center py-10 text-red-500">Error loading data: ${e.message}</div>`;
    }
}

// =============================================
// 3. FILTERING LOGIC
// =============================================
window.applyFilters = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        activeFilters.search = document.getElementById('f-search').value.trim().toLowerCase();
        activeFilters.category = document.getElementById('f-category').value;
        activeFilters.municipality = document.getElementById('f-municipality').value;
        activeFilters.gender = document.getElementById('f-gender').value;
        activeFilters.philhealth = document.getElementById('f-philhealth').value;
        activeFilters.appStatus = document.getElementById('f-app-status').value; 
        activeFilters.ageMin = document.getElementById('f-age-min').value;
        activeFilters.ageMax = document.getElementById('f-age-max').value;
        
        // ADD THESE THREE LINES:
        activeFilters.dateFrom = document.getElementById('f-date-from').value;
        activeFilters.dateTo = document.getElementById('f-date-to').value;
        activeFilters.childrenMin = document.getElementById('f-children-min').value;
        
        applyFiltersLogic(false); 
    }, 300);
};

function applyFiltersLogic(keepPage = false) {
    filteredMembers = allMembersCache.filter(user => {
        // ... (keep your existing search, category, municipality, etc. filters) ...

        let age = parseInt(user.age);
        if (activeFilters.ageMin && (isNaN(age) || age < parseInt(activeFilters.ageMin))) return false;
        if (activeFilters.ageMax && (isNaN(age) || age > parseInt(activeFilters.ageMax))) return false;

        // ADD THIS NEW LOGIC:
        
        // 1. Min Children Filter
        if (activeFilters.childrenMin) {
            const minKids = parseInt(activeFilters.childrenMin);
            const childCount = Array.isArray(user.childrenAges) ? user.childrenAges.length : 0;
            if (childCount < minKids) return false;
        }

        // 2. Date Registered Filter
        if (activeFilters.dateFrom || activeFilters.dateTo) {
            let regDate = null;
            if (user.registrationDate && user.registrationDate.toDate) {
                regDate = user.registrationDate.toDate();
            } else if (user.createdAt && user.createdAt.toDate) {
                regDate = user.createdAt.toDate();
            }

            if (!regDate) return false; // Hide records without dates if date filter is active

            // Normalize time to midnight for accurate day comparison
            regDate.setHours(0,0,0,0); 

            if (activeFilters.dateFrom) {
                const from = new Date(activeFilters.dateFrom);
                from.setHours(0,0,0,0);
                if (regDate < from) return false;
            }
            if (activeFilters.dateTo) {
                const to = new Date(activeFilters.dateTo);
                to.setHours(0,0,0,0);
                if (regDate > to) return false;
            }
        }

        return true;
    });

    filteredMembers.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));

    if (!keepPage) currentPage = 1;
    renderPage();
}

// =============================================
// 4. PAGINATION & RENDER
// =============================================
function renderPage() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = "";

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = filteredMembers.slice(start, end);

    if (pageData.length === 0) {
        grid.innerHTML = '<div class="col-span-2 text-center py-10 text-gray-500">No members found matching criteria.</div>';
    } else {
        pageData.forEach(user => { grid.appendChild(createMemberCard(user.id, user)); });
    }

    const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) || 1;
    document.getElementById('page-indicator').innerText = `Page ${currentPage} of ${totalPages}`;
    
    const isFirst = currentPage === 1;
    const isLast = end >= filteredMembers.length;

    ['btn-prev', 'btn-prev-btm'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) { btn.disabled = isFirst; btn.classList.toggle('cursor-not-allowed', isFirst); }
    });
    ['btn-next', 'btn-next-btm'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) { btn.disabled = isLast; btn.classList.toggle('cursor-not-allowed', isLast); }
    });
}

window.changePage = function(dir) {
    if (dir === 'prev' && currentPage > 1) { currentPage--; renderPage(); } 
    else if (dir === 'next' && (currentPage * ITEMS_PER_PAGE) < filteredMembers.length) { currentPage++; renderPage(); }
    saveState(); 
};

// =============================================
// 5. HELPERS & CARD RENDERER
// =============================================
function calculateCategoryStats(data) {
    const counts = {};
    for (let key in CATEGORIES) counts[key] = 0;
    data.forEach(user => {
        const cat = (user.category || "").toLowerCase();
        for(let key in CATEGORIES) { if (cat.includes(key)) { counts[key]++; break; } }
    });
    document.getElementById('total-count-display').innerText = data.length;
    const listContainer = document.getElementById('category-list');
    listContainer.innerHTML = ""; 
    for (let [code, label] of Object.entries(CATEGORIES)) {
        const item = document.createElement('div');
        item.id = `cat-row-${code}`;
        item.className = "cat-item flex justify-between items-start text-sm text-gray-600 p-2 rounded cursor-pointer hover:bg-gray-50 border border-transparent transition";
        item.onclick = () => filterByCategory(code);
        item.innerHTML = `<div class="flex gap-3"><span class="text-gray-400 font-mono text-xs mt-0.5 w-6 shrink-0">${code}</span><span class="leading-tight select-none">${label}</span></div><span class="font-medium text-gray-800 ml-2">${counts[code] || 0}</span>`;
        listContainer.appendChild(item);
    }
}

function createMemberCard(id, data) {
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition";
    const name = `${data.firstName || ''} ${data.lastName || ''}`;
    const address = data.municipality || data.city || data.address || "No Address";
    const initial = (data.firstName || "U").charAt(0).toUpperCase();
    const safeData = JSON.stringify({id, ...data}).replace(/"/g, '&quot;');
    
    let appBadgeHTML = "";
    if (data.is_online === true) {
        appBadgeHTML = `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full ml-2 whitespace-nowrap shadow-sm font-semibold tracking-wide">App Registered</span>`;
    } else {
        appBadgeHTML = `<span class="bg-gray-50 text-gray-500 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full ml-2 whitespace-nowrap shadow-sm font-medium">App Unregistered</span>`;
    }

    div.innerHTML = `<div class="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center"><span class="text-lg font-bold text-gray-500">${initial}</span></div><div class="flex-1 min-w-0"><h3 class="text-sm font-bold text-gray-900 truncate flex items-center">${name} ${appBadgeHTML}</h3><p class="text-xs text-gray-500 truncate font-mono mt-0.5">ID: ${data.soloParentIdNumber || id}</p><p class="text-xs text-gray-400 truncate">${address}</p></div><button onclick="openMemberModal(${safeData})" class="px-3 py-1.5 border border-blue-600 text-blue-600 rounded text-xs font-medium hover:bg-blue-50">View</button>`;
    return div;
}

window.openMemberModal = function(data) {
    document.getElementById('m-modal-avatar').innerText = (data.firstName || "U").charAt(0);
    document.getElementById('m-modal-name').innerText = `${data.firstName || ''} ${data.lastName || ''}`;
    document.getElementById('m-modal-id').innerText = data.soloParentIdNumber || data.id;
    document.getElementById('m-modal-email').innerText = data.email || "N/A";
    document.getElementById('m-modal-contact').innerText = data.contact || "N/A";
    
    let displayCat = data.category || "N/A";
    for(let key in CATEGORIES) { if(displayCat.toLowerCase().includes(key)) { displayCat = `${key} (${CATEGORIES[key]})`; break; } }
    document.getElementById('m-modal-category').innerText = displayCat;
    
    const fullAddress = [data.barangay, data.municipality].filter(Boolean).join(', ');
    document.getElementById('m-modal-address').innerText = fullAddress || data.address || "N/A";
    
    document.getElementById('btn-view-full-profile').onclick = () => {
        saveState();
        window.location.href = `profile.html?id=${data.id}`;
    };
    
    document.getElementById('viewModal').classList.remove('hidden');
};

// =============================================
// 6. FAST GENERATE REPORT LOGIC
// =============================================
window.generateReport = function() {
    if (filteredMembers.length === 0) {
        alert("There are no members matching your current filters to generate a report for.");
        return;
    }

    const btn = document.querySelector('button[onclick="generateReport()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2 inline"></i> Generating...';
    btn.disabled = true;
    feather.replace();

    try {
        // Build metadata text to show what filters are active
        let criteriaParts = [];
        if (activeFilters.search) criteriaParts.push(`Search: "${activeFilters.search}"`);
        if (activeFilters.category) criteriaParts.push(`Category: ${activeFilters.category}`);
        if (activeFilters.municipality) criteriaParts.push(`Municipality: ${activeFilters.municipality}`);
        if (activeFilters.gender) criteriaParts.push(`Gender: ${activeFilters.gender}`);
        if (activeFilters.philhealth) criteriaParts.push(`PhilHealth: ${activeFilters.philhealth}`);
        if (activeFilters.appStatus) criteriaParts.push(`App Status: ${activeFilters.appStatus}`);
        
        const filterDescription = criteriaParts.length > 0 ? criteriaParts.join(" | ") : "All Verified Members (No Filters Applied)";
        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Build Table Rows
        let rows = "";
        filteredMembers.forEach((m, index) => {
            const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
            const idNum = m.soloParentIdNumber || m.id;
            const gender = m.sex || '-';
            const age = m.age || '-';
            const address = `${m.barangay || ''}, ${m.municipality || ''}`.replace(/^, | ,$/g, '') || '-';
            const catCode = m.category ? m.category.split('-')[0].trim() : '-';
            const kids = Array.isArray(m.childrenAges) ? m.childrenAges.length : 0;
            const appStatus = m.is_online ? '<span style="color:#059669;font-weight:bold;">Registered</span>' : '<span style="color:#64748b;">Unregistered</span>';
            
            let regDate = '-';
            if (m.registrationDate && m.registrationDate.toDate) {
                regDate = m.registrationDate.toDate().toLocaleDateString();
            } else if (m.createdAt && m.createdAt.toDate) {
                regDate = m.createdAt.toDate().toLocaleDateString();
            }

            rows += `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td>
                        <strong style="color:#1e293b; display:block;">${name}</strong>
                        <span style="font-size:10px; color:#64748b; font-family:monospace;">${idNum}</span>
                    </td>
                    <td>${gender}</td>
                    <td style="text-align:center;">${age}</td>
                    <td>${address}</td>
                    <td style="text-align:center;"><strong>${catCode}</strong></td>
                    <td style="text-align:center;">${kids}</td>
                    <td>${regDate}</td>
                    <td>${appStatus}</td>
                </tr>
            `;
        });

        // Beautiful Print Template
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>SPDA Master List Report</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 20px; font-size: 12px; }
                    .header-container { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                    .header-container h1 { margin: 0; color: #1e3a8a; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
                    .header-container p { margin: 5px 0 0 0; color: #475569; font-size: 13px; }
                    
                    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; margin-bottom: 20px; }
                    .meta-box p { margin: 4px 0; font-size: 12px; color: #334155; }
                    .meta-title { font-weight: bold; color: #0f172a; display: inline-block; width: 120px; }

                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
                    th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; border-bottom: 2px solid #94a3b8; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    
                    .footer { margin-top: 30px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                    
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <h1>Solo Parent Official Master List</h1>
                    <p>Generated by SPDA System</p>
                </div>

                <div class="meta-box">
                    <p><span class="meta-title">Date Generated:</span> ${currentDate}</p>
                    <p><span class="meta-title">Total Records:</span> <strong>${filteredMembers.length} Members</strong></p>
                    <p><span class="meta-title">Applied Filters:</span> ${filterDescription}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align:center;">#</th>
                            <th style="width: 200px;">Applicant Name & ID</th>
                            <th>Sex</th>
                            <th>Age</th>
                            <th style="width: 200px;">Address</th>
                            <th>Category</th>
                            <th>Children</th>
                            <th>Date Reg</th>
                            <th>App Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer">
                    Confidential and Official Record • SPDA Data Management System • Printed on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;

        const iframe = document.getElementById('printFrame');
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // Print Trigger
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            btn.innerHTML = originalText;
            btn.disabled = false;
            feather.replace();
        }, 500);

    } catch (error) {
        console.error("Report Error:", error);
        alert("Failed to generate report.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        feather.replace();
    }
};