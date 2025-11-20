import { db } from "./firebase-config.js";
import { initSidebar, initLogout, DESCRIPTION_TO_CODE_MAP, CODE_TO_DESCRIPTION_MAP } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

const CATEGORY_LIST = Object.keys(DESCRIPTION_TO_CODE_MAP);
const MUNICIPALITY_LIST = ["Atok", "Bakun", "Bokod", "Buguias", "Itogon", "Kabayan", "Kapangan", "Kibungan", "La Trinidad", "Mankayan", "Sablan", "Tuba", "Tublay"];
let allApprovedMembers = [];
let filteredMembersList = [];

const categoryListEl = document.getElementById('category-filter-list');
const municipalitySelectEl = document.getElementById('municipality-filter-select');
const categorySelect = document.getElementById('category-filter-select');
const memberGridEl = document.getElementById('member-profile-grid');
const resultCountEl = document.getElementById('result-count');

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

function renderFilterOptions() {
    categorySelect.innerHTML = `<option value="All">All Categories</option>`;
    CATEGORY_LIST.forEach(cat => { categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`; });
    municipalitySelectEl.innerHTML = `<option value="All">All Municipalities</option>`;
    MUNICIPALITY_LIST.forEach(mun => { municipalitySelectEl.innerHTML += `<option value="${mun}">${mun}</option>`; });
    
    // Sidebar Stats
    categoryListEl.innerHTML = `<a href="#" data-category="All" class="flex justify-between items-center px-3 py-2 rounded-md bg-blue-50 text-blue-700 category-link active-category"><span>All Categories</span><span class="text-xs font-medium">${allApprovedMembers.length}</span></a>`;
    CATEGORY_LIST.forEach(cat => {
        const code = DESCRIPTION_TO_CODE_MAP[cat];
        const count = allApprovedMembers.filter(m => m.category === code).length;
        categoryListEl.innerHTML += `<a href="#" data-category="${cat}" class="flex justify-between items-center px-3 py-2 rounded-md hover:bg-gray-50 category-link"><span class="flex items-start"><span class="text-xs font-mono w-8 text-gray-400 flex-shrink-0">${code}</span><span class="ml-1">${cat}</span></span><span class="text-xs font-medium text-gray-500">${count}</span></a>`;
    });
}

function applyFiltersAndRender() {
    const search = document.getElementById('search-box').value.toLowerCase();
    const category = categorySelect.value;
    const municipality = municipalitySelectEl.value;
    const gender = document.getElementById('gender-filter').value;
    const philhealth = document.getElementById('philhealth-filter').value;
    
    filteredMembersList = allApprovedMembers.filter(member => {
        // ... (Keep existing filter logic, simplified for brevity here but same as original) ...
        const name = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
        if (search && !name.includes(search)) return false;
        if (category !== "All" && member.category !== DESCRIPTION_TO_CODE_MAP[category]) return false;
        const loc = member.municipality || member.placeOfBirth;
        if (municipality !== "All" && loc !== municipality) return false;
        if (gender !== "All" && member.sex !== gender) return false;
        if (philhealth !== "All") {
            const hasIt = member.hasPhilhealth === true;
            const wantIt = philhealth === "true";
            if (hasIt !== wantIt) return false;
        }
        return true;
    });

    renderMemberProfiles(filteredMembersList);
    if (resultCountEl) resultCountEl.textContent = filteredMembersList.length;
}

function renderMemberProfiles(members) {
    memberGridEl.innerHTML = "";
    if (members.length === 0) {
        memberGridEl.innerHTML = `<p class="text-sm text-gray-500">No members found matching your filters.</p>`;
        return;
    }
    members.forEach(data => {
        const name = `${data.firstName || ''} ${data.lastName || ''}`;
        memberGridEl.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 transition">
                <div class="flex items-start gap-4">
                    <img src="${data.profileImageUrl || 'https://i.pravatar.cc/200'}" class="w-16 h-16 rounded-full object-cover">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-800">${name}</h3>
                        <p class="text-sm text-gray-500">ID: ${data.soloParentIdNumber || 'N/A'}</p>
                        <p class="text-sm text-gray-500 mt-1">${data.address || 'N/A'}</p>
                    </div>
                </div>
                <div class="mt-4"><a href="profile.html?id=${data.id}" class="w-full block text-center py-2 px-4 border border-blue-600 text-blue-600 font-medium rounded-md hover:bg-blue-50 transition">View Profile</a></div>
            </div>`;
    });
}

function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    const date = new Date().toLocaleDateString();
    let rows = filteredMembersList.map(m => {
        const catName = CODE_TO_DESCRIPTION_MAP[m.category] || m.category || 'N/A';
        return `<tr><td>${m.firstName} ${m.lastName}</td><td>${m.sex || 'N/A'}</td><td>${m.age || 'N/A'}</td><td>${m.address || 'N/A'}</td><td>${catName}</td></tr>`;
    }).join('');
    printContainer.innerHTML = `<div class="letterhead"><h1>Solo Parent Data Analysis System</h1><p>Filtered Report - ${date}</p></div><table><thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Address</th><th>Category</th></tr></thead><tbody>${rows}</tbody></table>`;
    printContainer.style.display = 'block';
    window.print();
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    
    const inputs = document.querySelectorAll('#search-box, select, input[type="number"], input[type="date"]');
    inputs.forEach(el => {
        el.addEventListener('input', applyFiltersAndRender);
        el.addEventListener('change', applyFiltersAndRender);
    });
    
    document.getElementById('generate-category-report-btn').addEventListener('click', handleGenerateReport);
    document.getElementById('reset-filters-btn').addEventListener('click', (e) => {
        e.preventDefault();
        location.reload(); // Simplest reset
    });
    feather.replace();
});