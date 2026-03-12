import { db } from "./firebase-config.js";
import { initSidebar, initLogout, DESCRIPTION_TO_CODE_MAP, CODE_TO_DESCRIPTION_MAP } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

let allMembers = [];
let filteredMembers = [];
const MUNICIPALITY_LIST = ["Atok","Baguio","Bakun","Bokod","Buguias","Itogon","Kabayan","Kapangan","Kibungan","La Trinidad","Mankayan","Sablan","Tuba", "Tublay"];

document.addEventListener('DOMContentLoaded', async () => {
    // 🔥 Ensure the Print button is hooked up directly!
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
        printBtn.addEventListener('click', window.handlePrint);
    }

    await loadData();
    initUI();
});

// ==========================================
// 1. LOAD DATA
// ==========================================
async function loadData() {
    if (!db) return;
    try {
        const q = query(collection(db, "users"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);
        allMembers = snapshot.docs.map(doc => doc.data());
        console.log(`Loaded ${allMembers.length} approved members.`);
        renderCategoryCheckboxes();
        renderLocationCheckboxes();
    } catch (error) {
        console.error("Error loading report data:", error);
    }
}

function renderCategoryCheckboxes() {
    const container = document.getElementById('category-checkbox-container');
    if (!container) return;
    container.innerHTML = ''; 
    for (const [name, code] of Object.entries(DESCRIPTION_TO_CODE_MAP)) {
        createCheckbox(container, name, code, 'category-filter');
    }
}

function renderLocationCheckboxes() {
    const container = document.getElementById('location-checkbox-container');
    if (!container) return;
    container.innerHTML = ''; 
    MUNICIPALITY_LIST.forEach(mun => {
        createCheckbox(container, mun, mun, 'location-filter');
    });
}

function createCheckbox(container, labelText, value, nameGroup) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start gap-2 mb-2 last:mb-0';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.id = `${nameGroup}-${value.replace(/\s+/g, '')}`;
    checkbox.name = nameGroup;
    checkbox.className = 'mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.className = 'text-sm text-gray-700 cursor-pointer select-none';
    label.textContent = labelText;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
}

// ==========================================
// 2. UI INITIALIZATION
// ==========================================
function initUI() {
    const periodSelect = document.getElementById('filter-period');
    const customDateBox = document.getElementById('custom-date-container');

    if (periodSelect && customDateBox) {
        periodSelect.addEventListener('change', () => {
            if (periodSelect.value === 'custom') {
                customDateBox.classList.remove('hidden');
                customDateBox.classList.add('grid');
            } else {
                customDateBox.classList.add('hidden');
                customDateBox.classList.remove('grid');
            }
        });
    }

    document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);

    document.getElementById('btn-reset')?.addEventListener('click', () => {
        document.querySelectorAll('input').forEach(i => {
            if(i.type === 'checkbox') i.checked = false;
            else i.value = '';
        });
        document.querySelectorAll('select').forEach(s => s.value = 'All');
        
        if(periodSelect) periodSelect.value = 'all';
        if(customDateBox) { customDateBox.classList.add('hidden'); customDateBox.classList.remove('grid'); }
        
        const tbody = document.getElementById('preview-table-body');
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-gray-500"><div class="flex flex-col items-center"><i data-feather="filter" class="w-8 h-8 text-gray-300 mb-2"></i><p>Filters reset. Select criteria and click <strong>Apply Filters</strong>.</p></div></td></tr>`;
        
        if(typeof feather !== 'undefined') feather.replace();
        
        const printBtn = document.getElementById('btn-print-report');
        if (printBtn) printBtn.disabled = true;
        
        filteredMembers = [];
        document.getElementById('result-count').textContent = "0 Records";
    });
}

// ==========================================
// 3. FILTER ENGINE
// ==========================================
function applyFilters() {
    const getVal = (id) => document.getElementById(id)?.value || '';
    const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

    const selectedCategories = getChecked('category-filter');
    const selectedLocations = getChecked('location-filter');

    const minAge = getVal('filter-age-min');
    const maxAge = getVal('filter-age-max');
    const minKids = getVal('filter-children-min');
    const maxKids = getVal('filter-children-max');
    const gender = getVal('filter-gender');
    const period = getVal('filter-period');

    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (period === 'week') {
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0,0,0,0);
        endDate = new Date();
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (period === 'custom') {
        const sVal = getVal('filter-date-start');
        const eVal = getVal('filter-date-end');
        if (sVal) startDate = new Date(sVal);
        if (eVal) { endDate = new Date(eVal); endDate.setHours(23, 59, 59); }
    }

    filteredMembers = allMembers.filter(m => {
        if (selectedCategories.length > 0 && !selectedCategories.includes(m.category)) return false;
        
        if (selectedLocations.length > 0) {
            const userLoc = m.municipality || m.address || "";
            const matches = selectedLocations.some(loc => userLoc.includes(loc));
            if (!matches) return false;
        }
        
        if (gender !== 'All' && m.sex !== gender) return false;
        
        const age = parseInt(m.age || 0);
        if (minAge && age < Math.max(0, parseInt(minAge))) return false;
        if (maxAge && age > Math.max(0, parseInt(maxAge))) return false;
        
        const kids = parseInt(m.numberOfChildren || 0);
        if (minKids && kids < Math.max(0, parseInt(minKids))) return false;
        if (maxKids && kids > Math.max(0, parseInt(maxKids))) return false;

        if (startDate || endDate) {
            const regDate = m.createdAt ? (typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
            if (!regDate) return false;
            if (startDate && regDate < startDate) return false;
            if (endDate && regDate > endDate) return false;
        }

        return true;
    });

    updateTable();
}

function updateTable() {
    const tbody = document.getElementById('preview-table-body');
    const countEl = document.getElementById('result-count');
    const printBtn = document.getElementById('btn-print-report');

    tbody.innerHTML = "";
    countEl.textContent = `${filteredMembers.length} Records`;
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No records match this criteria.</td></tr>`;
        if(printBtn) printBtn.disabled = true;
        return;
    }

    if(printBtn) printBtn.disabled = false;

    filteredMembers.forEach(m => {
        const catName = CODE_TO_DESCRIPTION_MAP[m.category] || m.category || "N/A";
        let regDateStr = "N/A";
        
        if (m.createdAt) {
           try { regDateStr = typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate().toLocaleDateString() : new Date(m.createdAt).toLocaleDateString(); } catch(e) {}
        }
        
        const address = m.address || m.municipality || "N/A";
        
        const row = `
            <tr>
                <td class="px-6 py-2">${m.firstName} ${m.lastName}</td>
                <td class="px-6 py-2">${m.age || 'N/A'}</td>
                <td class="px-6 py-2">${catName}</td>
                <td class="px-6 py-2">${address}</td>
                <td class="px-6 py-2">${m.numberOfChildren || '0'}</td>
                <td class="px-6 py-2">${regDateStr}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// ==========================================
// 4. GENERATE PDF (INVISIBLE IFRAME METHOD)
// ==========================================
window.handlePrint = function() {
    if (filteredMembers.length === 0) return;

    const date = new Date().toLocaleDateString();
    
    // --- Narrative Building ---
    const checkedCats = document.querySelectorAll('input[name="category-filter"]:checked');
    const selectedCategories = Array.from(checkedCats).map(cb => cb.nextElementSibling.textContent.trim());
    
    const checkedLocs = document.querySelectorAll('input[name="location-filter"]:checked');
    const selectedLocations = Array.from(checkedLocs).map(cb => cb.nextElementSibling.textContent.trim());

    const getVal = (id) => document.getElementById(id)?.value || '';
    const minAge = getVal('filter-age-min');
    const maxAge = getVal('filter-age-max');
    const minKids = getVal('filter-children-min');
    const maxKids = getVal('filter-children-max');
    const period = getVal('filter-period');
    const gender = getVal('filter-gender');
    
    let descriptionParts = [];
    
    if (selectedCategories.length > 0) {
        let str = selectedCategories.length > 2 ? selectedCategories.length + " categories" : selectedCategories.join(" or ");
        descriptionParts.push(`categorized as <strong>${str}</strong>`);
    }
    
    if (selectedLocations.length > 0) {
        let str = selectedLocations.length > 2 ? selectedLocations.length + " locations" : selectedLocations.join(" or ");
        descriptionParts.push(`living in <strong>${str}</strong>`);
    }

    if (gender && gender !== 'All') descriptionParts.push(`who are <strong>${gender}</strong>`);
    
    if (minAge && maxAge) descriptionParts.push(`aged <strong>${minAge} to ${maxAge}</strong>`);
    else if (maxAge) descriptionParts.push(`aged <strong>${maxAge} and below</strong>`);
    else if (minAge) descriptionParts.push(`aged <strong>${minAge} and above</strong>`);
    
    if (minKids && maxKids) {
        if (minKids === maxKids) descriptionParts.push(`with exactly <strong>${minKids} children</strong>`);
        else descriptionParts.push(`with <strong>${minKids} to ${maxKids} children</strong>`);
    }
    else if (minKids) descriptionParts.push(`with <strong>at least ${minKids} children</strong>`);
    else if (maxKids) descriptionParts.push(`with <strong>${maxKids} or fewer children</strong>`);
    
    if (period && period !== 'all') {
        let dateText = "";
        if (period === 'custom') {
            const s = getVal('filter-date-start');
            const e = getVal('filter-date-end');
            if (s && e) dateText = `between ${s} and ${e}`;
        } else {
            dateText = `this ${period}`;
        }
        if (dateText) descriptionParts.push(`registered <strong>${dateText}</strong>`);
    }

    let description = "";
    if (descriptionParts.length > 0) {
        description = `This report lists verified solo parents ` + descriptionParts.join(", ") + ".";
    } else {
        description = `This report is a complete master list of all verified solo parent members in the database.`;
    }
    
    // --- Table Row Generation ---
    const rows = filteredMembers.map(m => {
        const catName = CODE_TO_DESCRIPTION_MAP[m.category] || m.category || "N/A";
        return `
            <tr>
                <td style="border-bottom:1px solid #e5e7eb; padding:10px 8px; color: #374151;">${m.firstName} ${m.lastName}</td>
                <td style="border-bottom:1px solid #e5e7eb; padding:10px 8px; color: #374151;">${m.age || 'N/A'}</td>
                <td style="border-bottom:1px solid #e5e7eb; padding:10px 8px; color: #374151;">${catName}</td>
                <td style="border-bottom:1px solid #e5e7eb; padding:10px 8px; color: #374151;">${m.numberOfChildren || '0'}</td>
                <td style="border-bottom:1px solid #e5e7eb; padding:10px 8px; color: #374151;">${m.address || m.municipality || 'N/A'}</td>
            </tr>
        `;
    }).join('');

    // --- HTML Assembly ---
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SPDA Data Report</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1f2937; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
            .header img { width: 80px; height: 80px; margin-right: 15px; object-fit: contain; }
            .header h1 { margin: 0; font-size: 24px; color: #1e3a8a; }
            .header p { margin: 5px 0 0 0; font-size: 12px; color: #6b7280; }
            .params-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
            .params-box h3 { margin: 0 0 5px 0; font-size: 14px; font-weight: 600; color: #111827; }
            .params-box p { margin: 0; font-size: 13px; line-height: 1.5; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; padding: 12px 8px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; }
            .total { margin-top: 20px; text-align: right; font-size: 14px; font-weight: 700; color: #111827; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="LOGO.png" alt="Logo" onerror="this.style.display='none'">
            <div>
                <h1>SPDA Data Report</h1>
                <p>Generated on: ${date}</p>
            </div>
        </div>

        <div class="params-box">
            <h3>Report Parameters:</h3>
            <p>${description}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Age</th>
                    <th>Category</th>
                    <th>Children</th>
                    <th>Address</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        
        <div class="total">
            Total Records Found: ${filteredMembers.length}
        </div>

        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 800);
            };
        </script>
    </body>
    </html>
    `;

    // CREATE INVISIBLE IFRAME
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-1000px'; 
    printFrame.style.left = '-1000px';
    printFrame.style.width = '100%';
    printFrame.style.height = '100%';
    printFrame.id = 'reports-print-frame';
    
    document.body.appendChild(printFrame);

    // WRITE HTML TO IFRAME
    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    // CLEANUP
    setTimeout(() => {
        if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
        }
    }, 5000); 
};