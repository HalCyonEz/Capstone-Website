console.log("🎯 members.js loaded (State Persistence Enabled)");
feather.replace();

const ITEMS_PER_PAGE = 100; 
let currentPage = 1;
let allMembersCache = []; 
let filteredMembers = []; 

// Default Filters
let activeFilters = { 
    category: "", municipality: "", gender: "", 
    philhealth: "", search: "", ageMin: "", 
    ageMax: "", dateFrom: "", dateTo: "", 
    childrenMin: "" 
};
let searchTimeout = null;

// Categories
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
    const db = firebase.firestore();
    window.db = db; 

    // 1. Attempt to restore filters/page from previous session
    const restored = restoreState();
    
    // 2. Fetch Data (Pass 'true' if we restored state to preserve the page number)
    fetchAllMembers(restored);
});

// =============================================
// 1. STATE MANAGEMENT (The Fix)
// =============================================
function saveState() {
    const state = {
        filters: activeFilters,
        page: currentPage,
        scroll: window.scrollY
    };
    sessionStorage.setItem('spda_member_state', JSON.stringify(state));
}

function restoreState() {
    const saved = sessionStorage.getItem('spda_member_state');
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        activeFilters = state.filters;
        currentPage = state.page || 1;

        // Restore DOM Input Values
        document.getElementById('f-search').value = activeFilters.search || "";
        document.getElementById('f-category').value = activeFilters.category || "";
        document.getElementById('f-municipality').value = activeFilters.municipality || "";
        document.getElementById('f-gender').value = activeFilters.gender || "";
        document.getElementById('f-philhealth').value = activeFilters.philhealth || "";
        document.getElementById('f-age-min').value = activeFilters.ageMin || "";
        document.getElementById('f-age-max').value = activeFilters.ageMax || "";
        document.getElementById('f-date-from').value = activeFilters.dateFrom || "";
        document.getElementById('f-date-to').value = activeFilters.dateTo || "";
        document.getElementById('f-children-min').value = activeFilters.childrenMin || "";

        // Restore Sidebar Highlight
        if (activeFilters.category) {
            // Wait for DOM to allow highlighting
            setTimeout(() => {
                const row = document.getElementById(`cat-row-${activeFilters.category}`);
                if(row) row.classList.add('bg-blue-50', 'border-blue-200');
                document.getElementById('cat-all-btn').classList.remove('bg-blue-50', 'text-blue-700');
            }, 500);
        }

        return true; // Signal that we restored something
    } catch (e) {
        console.error("Failed to restore state", e);
        return false;
    }
}

function clearState() {
    sessionStorage.removeItem('spda_member_state');
}

// =============================================
// 2. DATA FETCHING
// =============================================
async function fetchAllMembers(isRestoring = false) {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<div class="col-span-2 text-center py-10 text-blue-500">Loading all members...</div>';
    
    try {
        const snapshot = await window.db.collection("users")
            .where("status", "in", ["verified", "approved"])
            .get();
        
        allMembersCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        calculateCategoryStats(allMembersCache);
        
        // If we are restoring, we pass 'true' to keep the saved page number.
        // If not, we pass 'false' to reset to Page 1.
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
        // Capture inputs
        activeFilters.search = document.getElementById('f-search').value.trim().toLowerCase();
        activeFilters.category = document.getElementById('f-category').value;
        activeFilters.municipality = document.getElementById('f-municipality').value;
        activeFilters.gender = document.getElementById('f-gender').value;
        activeFilters.philhealth = document.getElementById('f-philhealth').value;
        activeFilters.ageMin = document.getElementById('f-age-min').value;
        activeFilters.ageMax = document.getElementById('f-age-max').value;
        activeFilters.dateFrom = document.getElementById('f-date-from').value;
        activeFilters.dateTo = document.getElementById('f-date-to').value;
        activeFilters.childrenMin = document.getElementById('f-children-min').value;

        // When USER types/clicks, we always reset to Page 1
        applyFiltersLogic(false);
    }, 300);
};

window.filterByCategory = function(categoryCode) {
    document.getElementById('f-category').value = categoryCode || "";
    
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('bg-blue-50', 'border-blue-200'));
    const allBtn = document.getElementById('cat-all-btn');
    if(categoryCode) {
        const row = document.getElementById(`cat-row-${categoryCode}`);
        if(row) row.classList.add('bg-blue-50', 'border-blue-200');
        allBtn.classList.remove('bg-blue-50', 'text-blue-700');
    } else {
        allBtn.classList.add('bg-blue-50', 'text-blue-700');
    }
    
    window.applyFilters();
};

window.resetFilters = function() {
    document.getElementById('f-search').value = "";
    document.getElementById('f-category').selectedIndex = 0;
    document.getElementById('f-municipality').selectedIndex = 0;
    document.getElementById('f-gender').selectedIndex = 0;
    document.getElementById('f-philhealth').selectedIndex = 0;
    document.getElementById('f-age-min').value = "";
    document.getElementById('f-age-max').value = "";
    document.getElementById('f-date-from').value = "";
    document.getElementById('f-date-to').value = "";
    document.getElementById('f-children-min').value = "";
    
    activeFilters = { category: "", municipality: "", gender: "", philhealth: "", search: "", ageMin: "", ageMax: "", dateFrom: "", dateTo: "", childrenMin: "" };
    
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('bg-blue-50', 'border-blue-200'));
    document.getElementById('cat-all-btn').classList.add('bg-blue-50', 'text-blue-700');

    clearState(); // Clear saved state on reset
    applyFiltersLogic(false);
};

function applyFiltersLogic(keepPage = false) {
    // 1. Filter the cache
    filteredMembers = allMembersCache.filter(user => {
        // --- SEARCH FIX: Check First Name OR Last Name OR ID ---
        if (activeFilters.search) {
            const s = activeFilters.search; // already lowercased in applyFilters()
            const fName = (user.firstName || "").toLowerCase();
            const lName = (user.lastName || "").toLowerCase();
            const idNum = (user.soloParentIdNumber || "").toLowerCase();
            
            // Check if search term exists in any of these fields
            const match = fName.includes(s) || lName.includes(s) || idNum.includes(s);
            if (!match) return false;
        }

        // Exact Matches
        if (activeFilters.category && (!user.category || !user.category.startsWith(activeFilters.category))) return false;
        if (activeFilters.municipality && user.municipality !== activeFilters.municipality) return false;
        if (activeFilters.gender && user.sex !== activeFilters.gender) return false;
        
        // PhilHealth
        if (activeFilters.philhealth === 'Yes' && !user.philhealthIdNumber) return false;
        if (activeFilters.philhealth === 'No' && user.philhealthIdNumber) return false;

        // Ranges
        let age = parseInt(user.age);
        if (activeFilters.ageMin && (isNaN(age) || age < parseInt(activeFilters.ageMin))) return false;
        if (activeFilters.ageMax && (isNaN(age) || age > parseInt(activeFilters.ageMax))) return false;

        let childCount = Array.isArray(user.childrenAges) ? user.childrenAges.length : 0;
        if (activeFilters.childrenMin && childCount < parseInt(activeFilters.childrenMin)) return false;

        if (user.createdAt) {
            let regDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
            if (activeFilters.dateFrom && regDate < new Date(activeFilters.dateFrom)) return false;
            if (activeFilters.dateTo) {
                let endDate = new Date(activeFilters.dateTo);
                endDate.setHours(23,59,59);
                if (regDate > endDate) return false;
            }
        }

        return true;
    });

    // 2. Sort (Alphabetical Last Name)
    filteredMembers.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));

    // 3. Reset Pagination (Only if NOT restoring state)
    if (!keepPage) {
        currentPage = 1;
    }
    
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
        pageData.forEach(user => {
            grid.appendChild(createMemberCard(user.id, user));
        });
    }

    // Update UI
    const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) || 1;
    document.getElementById('page-indicator').innerText = `Page ${currentPage} of ${totalPages}`;
    
    // Update Buttons
    const prevBtns = [document.getElementById('btn-prev'), document.getElementById('btn-prev-btm')];
    const nextBtns = [document.getElementById('btn-next'), document.getElementById('btn-next-btm')];

    const isFirst = currentPage === 1;
    const isLast = end >= filteredMembers.length;

    prevBtns.forEach(b => {
        b.disabled = isFirst;
        b.classList.toggle('cursor-not-allowed', isFirst);
    });
    nextBtns.forEach(b => {
        b.disabled = isLast;
        b.classList.toggle('cursor-not-allowed', isLast);
    });
}

window.changePage = function(dir) {
    if (dir === 'prev' && currentPage > 1) {
        currentPage--;
        renderPage();
    } else if (dir === 'next' && (currentPage * ITEMS_PER_PAGE) < filteredMembers.length) {
        currentPage++;
        renderPage();
    }
};

// =============================================
// 5. REPORT GENERATION
// =============================================
window.generateReport = function() {
    if (filteredMembers.length === 0) { alert("No members to report."); return; }
    
    const btn = document.querySelector('button[onclick="generateReport()"]');
    const originalText = btn.innerHTML;
    btn.innerText = "Generating...";
    btn.disabled = true;

    // Build Description
    let desc = `This report contains an official list of <b>${filteredMembers.length} verified solo parent members</b>`;
    let criteriaParts = [];
    if (activeFilters.search) criteriaParts.push(`matching search "<b>${activeFilters.search}</b>"`);
    if (activeFilters.gender && activeFilters.gender !== 'All') criteriaParts.push(`who are <b>${activeFilters.gender}</b>`);
    if (activeFilters.municipality && activeFilters.municipality !== 'All Municipalities') criteriaParts.push(`residing in <b>${activeFilters.municipality}</b>`);
    if (activeFilters.category) criteriaParts.push(`under category <b>${activeFilters.category}</b>`);
    
    if (criteriaParts.length > 0) desc += " " + criteriaParts.join(", ") + ".";
    else desc += " from the entire database.";

    // Build Rows
    let rows = filteredMembers.map(m => {
        const catCode = m.category ? m.category.split(' ')[0] : '-';
        const date = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleDateString() : '-';
        const kids = Array.isArray(m.childrenAges) ? m.childrenAges.length : 0;
        return `<tr><td style="padding:8px;border:1px solid #ddd">${m.firstName} ${m.lastName}</td><td style="padding:8px;border:1px solid #ddd">${m.sex||'-'}</td><td style="padding:8px;border:1px solid #ddd">${m.age||'-'}</td><td style="padding:8px;border:1px solid #ddd">${m.municipality||'-'}</td><td style="padding:8px;border:1px solid #ddd">${catCode}</td><td style="padding:8px;border:1px solid #ddd">${kids}</td><td style="padding:8px;border:1px solid #ddd">${date}</td></tr>`;
    }).join('');

    const iframe = document.getElementById('printFrame');
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>SPDA Report</title><style>body{font-family:sans-serif;padding:20px;color:#333}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px}th{background:#f3f4f6;padding:8px;text-align:left;border:1px solid #ddd}td{padding:8px;border:1px solid #ddd}.header{text-align:center;margin-bottom:10px}h1{color:#1e3a8a;margin:0;font-size:22px}.meta{font-size:12px;color:#666;margin-top:5px}.desc-box{margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;line-height:1.5}.desc-title{font-weight:bold;font-size:12px;text-transform:uppercase;border-bottom:2px solid #2563eb;padding-bottom:5px;margin-bottom:10px;margin-top:20px;color:#1e293b}</style></head><body><div class="header"><h1>SPDA Category Report</h1><div class="meta">Official Member List • Generated: ${new Date().toLocaleDateString()}</div></div><div class="desc-title">1. REPORT DESCRIPTION</div><div class="desc-box">${desc}</div><div class="desc-title">2. FILTERED RESULTS</div><table><thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Address</th><th>Cat</th><th>Kids</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    doc.close();
    
    setTimeout(() => { 
        iframe.contentWindow.focus(); 
        iframe.contentWindow.print(); 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
    }, 500);
};

// =============================================
// 6. HELPERS
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
    div.innerHTML = `<div class="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center"><span class="text-lg font-bold text-gray-500">${initial}</span></div><div class="flex-1 min-w-0"><h3 class="text-sm font-bold text-gray-900 truncate">${name}</h3><p class="text-xs text-gray-500 truncate font-mono">ID: ${data.soloParentIdNumber || id}</p><p class="text-xs text-gray-400 truncate">${address}</p></div><button onclick="openMemberModal(${safeData})" class="px-3 py-1.5 border border-blue-600 text-blue-600 rounded text-xs font-medium hover:bg-blue-50">View</button>`;
    return div;
}

window.openMemberModal = function(data) {
    document.getElementById('m-modal-avatar').innerText = (data.firstName || "U").charAt(0);
    document.getElementById('m-modal-name').innerText = `${data.firstName} ${data.lastName}`;
    document.getElementById('m-modal-id').innerText = data.soloParentIdNumber || data.id;
    document.getElementById('m-modal-email').innerText = data.email || "N/A";
    document.getElementById('m-modal-contact').innerText = data.contact || "N/A";
    const code = data.category || "N/A";
    let displayCat = code;
    for(let key in CATEGORIES) { if(code.toLowerCase().includes(key)) { displayCat = `${key} (${CATEGORIES[key]})`; break; } }
    document.getElementById('m-modal-category').innerText = displayCat;
    const fullAddress = [data.houseNumber, data.street, data.barangay, data.municipality].filter(Boolean).join(', ');
    document.getElementById('m-modal-address').innerText = fullAddress || data.address;
    
    // SAVE STATE BEFORE NAVIGATING AWAY
    document.getElementById('btn-view-full-profile').onclick = () => {
        saveState();
        window.location.href = `profile.html?id=${data.id}`;
    };
    
    document.getElementById('viewModal').classList.remove('hidden');
};