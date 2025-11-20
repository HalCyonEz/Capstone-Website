import { db } from "./firebase-config.js";
import { initSidebar, initLogout, approveUser, rejectUser } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

async function loadPendingApplications() {
    const tbody = document.getElementById('applications-table-body');
    if (!tbody || !db) return;
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading applications...</td></tr>';
    try {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = "";
        if (querySnapshot.size === 0) { tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No pending applications found.</td></tr>`; return; }
        querySnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const name = `${data.firstName} ${data.lastName}`;
            const row = document.createElement('tr'); 
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `<td class="px-6 py-4 whitespace-nowrap"><input type="checkbox" class="rounded text-blue-600 focus:ring-blue-500"></td><td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="ml-4"><div class="text-sm font-medium text-gray-900">${name}</div></div></div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${data.soloParentIdNumber || 'N/A'}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A'}</div></td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span></td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div class="flex justify-end items-center space-x-3"><a href="profile.html?id=${docSnapshot.id}" target="_blank" class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">View</a><button data-action="approve" data-id="${docSnapshot.id}" class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">Approve</button><button data-action="reject" data-id="${docSnapshot.id}" class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">Reject</button></div></td>`;
            tbody.appendChild(row);
        });
        tbody.querySelectorAll('[data-action="approve"]').forEach(btn => btn.addEventListener('click', () => approveUser(btn.dataset.id)));
        tbody.querySelectorAll('[data-action="reject"]').forEach(btn => btn.addEventListener('click', () => rejectUser(btn.dataset.id)));
        feather.replace();
    } catch (error) { console.error('❌ Error loading applications:', error); }
}

document.addEventListener('DOMContentLoaded', loadPendingApplications);