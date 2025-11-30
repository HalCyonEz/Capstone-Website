import { db } from "./firebase-config.js";
import { initSidebar, initLogout, DESCRIPTION_TO_CODE_MAP, CODE_TO_DESCRIPTION_MAP } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Initialize Sidebar
initSidebar();
initLogout();

// --- State Variables ---
let allApprovedMembers = [];
let filteredMembersList = [];
const CATEGORY_LIST = Object.keys(DESCRIPTION_TO_CODE_MAP);
const MUNICIPALITY_LIST = ["Atok", "Bakun", "Bokod", "Buguias", "Itogon", "Kabayan", "Kapangan", "Kibungan", "La Trinidad", "Mankayan", "Sablan", "Tuba", "Tublay"];

// --- Variables for DOM Elements ---
let categoryListEl, municipalitySelectEl, categorySelect, memberGridEl, resultCountEl;
let searchBoxEl, genderSelect, philhealthSelect, minAgeInput, maxAgeInput, childrenInput, dateStartInput, dateEndInput;

// --- 1. Load Data ---
async function loadAllData() {
    if (!db) return;
    try {
        const q = query(collection(db, "users"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);
        allApprovedMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilterOptions();
        applyFiltersAndRender();
    } catch (error) {
        console.error("❌ Error loading categories page:", error);
    }
}

// --- 2. Render Options ---
function renderFilterOptions() {
    if (!categorySelect || !municipalitySelectEl) return;

    categorySelect.innerHTML = `<option value="All">All Categories</option>`;
    CATEGORY_LIST.forEach(cat => { categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`; });

    municipalitySelectEl.innerHTML = `<option value="All">All Municipalities</option>`;
    MUNICIPALITY_LIST.forEach(mun => { municipalitySelectEl.innerHTML += `<option value="${mun}">${mun}</option>`; });

    categoryListEl.innerHTML = `<a href="#" data-category="All" class="flex justify-between items-center px-3 py-2 rounded-md bg-blue-50 text-blue-700 category-link active-category"><span>All Categories</span><span class="text-xs font-medium">${allApprovedMembers.length}</span></a>`;
    
    CATEGORY_LIST.forEach(cat => {
        const code = DESCRIPTION_TO_CODE_MAP[cat];
        const count = allApprovedMembers.filter(m => m.category === code).length;
        categoryListEl.innerHTML += `<a href="#" data-category="${cat}" class="flex justify-between items-center px-3 py-2 rounded-md hover:bg-gray-50 category-link"><span class="flex items-start"><span class="text-xs font-mono w-8 text-gray-400 flex-shrink-0">${code}</span><span class="ml-1">${cat}</span></span><span class="text-xs font-medium text-gray-500">${count}</span></a>`;
    });
}

// --- 3. Filter Logic ---
function applyFiltersAndRender() {
    if (!searchBoxEl) return;

    const search = searchBoxEl.value.toLowerCase();
    const category = categorySelect.value;
    const municipality = municipalitySelectEl.value;
    const gender = genderSelect.value;
    const philhealth = philhealthSelect.value;
    const minAge = minAgeInput.value ? parseInt(minAgeInput.value) : null;
    const maxAge = maxAgeInput.value ? parseInt(maxAgeInput.value) : null;
    const minChildren = childrenInput.value ? parseInt(childrenInput.value) : null;
    const dateStart = dateStartInput.value ? new Date(dateStartInput.value) : null;
    const dateEnd = dateEndInput.value ? new Date(dateEndInput.value) : null;
    
    if (dateEnd) dateEnd.setHours(23, 59, 59);

    filteredMembersList = allApprovedMembers.filter(member => {
        const name = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
        const id = (member.soloParentIdNumber || '').toLowerCase();
        
        if (search && !name.includes(search) && !id.includes(search)) return false;
        if (category !== "All" && member.category !== DESCRIPTION_TO_CODE_MAP[category]) return false;
        
        const loc = member.municipality || member.placeOfBirth || "";
        if (municipality !== "All" && loc !== municipality) return false;
        if (gender !== "All" && member.sex !== gender) return false;

        if (philhealth !== "All") {
            const hasIt = (member.hasPhilhealth === true || member.hasPhilhealth === "true");
            const wantIt = (philhealth === "true");
            if (hasIt !== wantIt) return false;
        }

        const age = parseInt(member.age);
        if (minAge !== null && (isNaN(age) || age < minAge)) return false;
        if (maxAge !== null && (isNaN(age) || age > maxAge)) return false;

        const children = parseInt(member.numberOfChildren);
        if (minChildren !== null && (isNaN(children) || children < minChildren)) return false;

        const regDate = member.createdAt ? member.createdAt.toDate() : null;
        if (dateStart && (!regDate || regDate < dateStart)) return false;
        if (dateEnd && (!regDate || regDate > dateEnd)) return false;

        return true;
    });

    renderMemberProfiles(filteredMembersList);
    if (resultCountEl) resultCountEl.textContent = filteredMembersList.length;
}

function renderMemberProfiles(members) {
    if (!memberGridEl) return;
    memberGridEl.innerHTML = "";
    
    if (members.length === 0) {
        memberGridEl.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">No members found matching your filters.</div>`;
        return;
    }
    
    members.forEach(data => {
        const name = `${data.firstName || ''} ${data.lastName || ''}`;
        const location = data.address || data.municipality || 'N/A';
        const idNum = data.soloParentIdNumber || 'N/A';
        const imgUrl = data.profileImageUrl || 'https://i.pravatar.cc/200?img=12';

        memberGridEl.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 transition flex items-center gap-4">
                <img src="${imgUrl}" class="w-16 h-16 rounded-full object-cover flex-shrink-0 bg-gray-100">
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-800 truncate">${name}</h3>
                    <p class="text-xs text-gray-500">ID: ${idNum}</p>
                    <p class="text-xs text-gray-500 mt-1 truncate">${location}</p>
                </div>
                <a href="profile.html?id=${data.id}" class="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 transition whitespace-nowrap">View</a>
            </div>`;
    });
}

// --- ✅ UPDATED: Report Generation with Smart Description ---
function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    if (filteredMembersList.length === 0) { alert("No data to print."); return; }

    const date = new Date().toLocaleDateString();
    const count = filteredMembersList.length;

    // 1. Capture ALL active filters
    const catFilter = document.getElementById('category-filter-select').value;
    const munFilter = document.getElementById('municipality-filter-select').value;
    const genderFilter = document.getElementById('gender-filter').value;
    const philFilter = document.getElementById('philhealth-filter').value;
    const minAge = document.getElementById('min-age-filter').value;
    const maxAge = document.getElementById('max-age-filter').value;
    const minKids = document.getElementById('children-filter').value;
    const dStart = document.getElementById('date-start-filter').value;
    const dEnd = document.getElementById('date-end-filter').value;

    // 2. Build the Narrative
    let filters = [];

    // Location
    if (munFilter !== "All") filters.push(`residing in <strong>${munFilter}</strong>`);
    
    // Category
    if (catFilter !== "All") filters.push(`categorized as <strong>${catFilter}</strong>`);
    
    // Gender
    if (genderFilter !== "All") filters.push(`who are <strong>${genderFilter}</strong>`);
    
    // Age Logic
    if (minAge && maxAge) filters.push(`aged <strong>${minAge} to ${maxAge}</strong>`);
    else if (minAge) filters.push(`aged <strong>${minAge} and above</strong>`);
    else if (maxAge) filters.push(`aged <strong>${maxAge} and below</strong>`);

    // PhilHealth
    if (philFilter !== "All") {
        filters.push(philFilter === "true" ? `<strong>with PhilHealth</strong>` : `<strong>without PhilHealth</strong>`);
    }

    // Children
    if (minKids) filters.push(`with at least <strong>${minKids} children</strong>`);

    // Date Range
    if (dStart && dEnd) filters.push(`registered between <strong>${dStart}</strong> and <strong>${dEnd}</strong>`);

    // Construct Sentence
    let narrative = `This report contains an official list of <strong>${count} verified solo parent members</strong>`;
    
    if (filters.length > 0) {
        // Join them nicely: "residing in Baguio, aged 20-30, and with PhilHealth"
        if (filters.length > 1) {
            const last = filters.pop();
            narrative += ` ` + filters.join(", ") + `, and ` + last + `.`;
        } else {
            narrative += ` ` + filters[0] + `.`;
        }
    } else {
        narrative += ` from the entire database (no specific filters applied).`;
    }

    // 3. Build Table
    let rows = filteredMembersList.map(m => {
        const catName = CODE_TO_DESCRIPTION_MAP[m.category] || m.category || 'N/A';
        const regDate = m.createdAt ? m.createdAt.toDate().toLocaleDateString() : 'N/A';
        return `
        <tr>
            <td style="border:1px solid #ddd; padding:8px;">${m.firstName} ${m.lastName}</td>
            <td style="border:1px solid #ddd; padding:8px;">${m.sex || 'N/A'}</td>
            <td style="border:1px solid #ddd; padding:8px;">${m.age || 'N/A'}</td>
            <td style="border:1px solid #ddd; padding:8px;">${m.address || m.municipality || 'N/A'}</td>
            <td style="border:1px solid #ddd; padding:8px;">${catName}</td>
            <td style="border:1px solid #ddd; padding:8px;">${m.numberOfChildren || '0'}</td>
            <td style="border:1px solid #ddd; padding:8px;">${regDate}</td>
        </tr>`;
    }).join('');

    // 4. Render HTML
    let html = `
        <div class="letterhead" style="display: flex; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
            <img src="LOGO.png" alt="SPDA Logo" style="width: 80px; height: 80px; margin-right: 15px; object-fit: contain;">
            <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #1e3a8a;">SPDA Category Report</h1>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">Official Member List • Generated: ${date}</p>
            </div>
        </div>
        
        <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px; text-transform:uppercase;">1. Report Description</h3>
        <div style="margin-bottom: 20px; font-size: 14px; line-height: 1.6; text-align: justify; background:#f9fafb; padding:15px; border:1px solid #e5e7eb; border-radius:8px;">
            ${narrative}
        </div>

        <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px; text-transform:uppercase;">2. Filtered Results</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr style="background:#f3f4f6;">
                    <th style="border:1px solid #ddd; padding:8px;">Name</th>
                    <th style="border:1px solid #ddd; padding:8px;">Gender</th>
                    <th style="border:1px solid #ddd; padding:8px;">Age</th>
                    <th style="border:1px solid #ddd; padding:8px;">Address</th>
                    <th style="border:1px solid #ddd; padding:8px;">Category</th>
                    <th style="border:1px solid #ddd; padding:8px;">Children</th>
                    <th style="border:1px solid #ddd; padding:8px;">Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        
        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af;">
            <p><em>End of Report. Automatically generated by SPDA System.</em></p>
        </div>
    `;

    printContainer.innerHTML = html;
    printContainer.style.display = 'block';
    setTimeout(() => window.print(), 1000);
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    categoryListEl = document.getElementById('category-filter-list');
    municipalitySelectEl = document.getElementById('municipality-filter-select');
    categorySelect = document.getElementById('category-filter-select');
    memberGridEl = document.getElementById('member-profile-grid');
    resultCountEl = document.getElementById('result-count');
    searchBoxEl = document.getElementById('search-box');
    genderSelect = document.getElementById('gender-filter');
    philhealthSelect = document.getElementById('philhealth-filter');
    minAgeInput = document.getElementById('min-age-filter');
    maxAgeInput = document.getElementById('max-age-filter');
    childrenInput = document.getElementById('children-filter');
    dateStartInput = document.getElementById('date-start-filter');
    dateEndInput = document.getElementById('date-end-filter');
    const resetBtn = document.getElementById('reset-filters-btn');
    const reportBtn = document.getElementById('generate-category-report-btn');

    // Event Listeners
    const inputs = [searchBoxEl, categorySelect, municipalitySelectEl, genderSelect, philhealthSelect, minAgeInput, maxAgeInput, childrenInput, dateStartInput, dateEndInput];
    inputs.forEach(el => { if (el) { el.addEventListener('input', applyFiltersAndRender); el.addEventListener('change', applyFiltersAndRender); } });

    if (categoryListEl) {
        categoryListEl.addEventListener('click', e => {
            e.preventDefault();
            const link = e.target.closest('.category-link');
            if (!link) return;
            const cat = link.dataset.category;
            if(categorySelect) categorySelect.value = cat;
            document.querySelectorAll('.category-link').forEach(l => {
                l.classList.remove('bg-blue-50', 'text-blue-700', 'active-category');
                l.classList.add('hover:bg-gray-50');
                const countSpan = l.querySelector('span:last-child');
                if(countSpan) { countSpan.classList.remove('text-blue-700'); countSpan.classList.add('text-gray-500'); }
            });
            link.classList.add('bg-blue-50', 'text-blue-700', 'active-category');
            link.classList.remove('hover:bg-gray-50');
            const activeCountSpan = link.querySelector('span:last-child');
            if(activeCountSpan) { activeCountSpan.classList.remove('text-gray-500'); activeCountSpan.classList.add('text-blue-700'); }
            applyFiltersAndRender();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', e => {
            e.preventDefault();
            if(searchBoxEl) searchBoxEl.value = "";
            if(categorySelect) categorySelect.value = "All";
            if(municipalitySelectEl) municipalitySelectEl.value = "All";
            if(genderSelect) genderSelect.value = "All";
            if(philhealthSelect) philhealthSelect.value = "All";
            if(minAgeInput) minAgeInput.value = "";
            if(maxAgeInput) maxAgeInput.value = "";
            if(childrenInput) childrenInput.value = "";
            if(dateStartInput) dateStartInput.value = "";
            if(dateEndInput) dateEndInput.value = "";
            const allLink = document.querySelector('.category-link[data-category="All"]');
            if(allLink) allLink.click(); else applyFiltersAndRender();
        });
    }

    if (reportBtn) reportBtn.addEventListener('click', handleGenerateReport);

    loadAllData();
    feather.replace();
});