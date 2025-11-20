import { db } from "./firebase-config.js";
import { initSidebar, initLogout, approveRenewal, rejectRenewal } from "./utils.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

async function loadPendingRenewals() {
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody || !db) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading renewals...</td></tr>';
    try {
        const q = query(collection(db, "renewalSubmissions"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = "";
        if (querySnapshot.empty) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No pending renewals found.</td></tr>'; return; }
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const row = document.createElement('tr'); row.className = 'hover:bg-gray-50 border-b border-gray-100';
            const dateObj = data.submittedAt || data.createdAt;
            const dateStr = dateObj ? dateObj.toDate().toLocaleDateString() : 'N/A';
            const fullName = `${data.firstName || ''} ${data.lastName || ''}`;
            row.innerHTML = `<td class="px-6 py-4 text-sm text-gray-900">${fullName}</td><td class="px-6 py-4 text-sm text-gray-500">ID Renewal</td><td class="px-6 py-4 text-sm text-gray-500">${dateStr}</td><td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span></td><td class="px-6 py-4 text-right"><div class="flex justify-end gap-2"><button class="btn-approve px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition" data-id="${docSnapshot.id}" data-userid="${data.userId}">Approve</button><button class="btn-reject px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition" data-id="${docSnapshot.id}">Reject</button></div></td>`;
            tbody.appendChild(row);
        });
        tbody.querySelectorAll('.btn-approve').forEach(btn => { btn.addEventListener('click', async () => { if(confirm("Approve this renewal?")) { await approveRenewal(btn.getAttribute('data-id')); } }); });
        tbody.querySelectorAll('.btn-reject').forEach(btn => { btn.addEventListener('click', async () => { const reason = prompt("Reason for rejection:", "Incomplete documents"); if (reason) { await rejectRenewal(btn.getAttribute('data-id'), reason); } }); });
    } catch (error) { console.error("❌ Error loading renewals:", error); tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`; }
}

document.addEventListener('DOMContentLoaded', loadPendingRenewals);