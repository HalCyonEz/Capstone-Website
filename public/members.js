import { db } from "./firebase-config.js";
import { initSidebar, initLogout, CODE_TO_DESCRIPTION_MAP } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

async function loadVerifiedMembers() {
    const tableBody = document.getElementById('members-table-body');
    if (!tableBody || !db) return;
    tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading members...</td></tr>';
    try {
        const q = query(collection(db, "users"), where("status", "==", "approved"));
        const querySnapshot = await getDocs(q);
        document.getElementById('total-verified-members').textContent = querySnapshot.size;
        document.getElementById('pagination-total').textContent = querySnapshot.size;
        document.getElementById('total-verified-percent').textContent = "Total";
        tableBody.innerHTML = "";
        if (querySnapshot.size === 0) { tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No verified members found.</td></tr>`; return; }
        querySnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`;
            const categoryDescription = CODE_TO_DESCRIPTION_MAP[data.category] || data.category || 'N/A';
            const row = document.createElement('tr'); 
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `<td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="ml-4"><div class="text-sm font-medium text-gray-900">${name}</div><div class="text-sm text-gray-500">${categoryDescription}</div></div></div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${data.address || 'N/A'}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${data.soloParentIdNumber || 'N/A'}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${data.projectReceived || 'N/A'}</div></td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Verified</span></td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div class="flex justify-end space-x-2"><a href="profile.html?id=${docSnapshot.id}" class="text-blue-600 hover:text-blue-900" title="View Details"><i data-feather="eye" class="w-4 h-4"></i></a></div></td>`;
            tableBody.appendChild(row);
        });
        feather.replace();
    } catch (error) { console.error('❌ Error loading members:', error); }
}

document.addEventListener('DOMContentLoaded', loadVerifiedMembers);