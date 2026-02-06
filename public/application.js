// public/applications.js - DEBUG VERSION

console.log("🎯 applications.js loaded! (DEBUG MODE)");

let cachedApps = {};
let rejectTargetId = null;
let pendingRejectReason = "";

document.addEventListener('DOMContentLoaded', async function() {
    const tbody = document.getElementById('applications-table-body');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-blue-500">Loading, please wait...</td></tr>';

        // 1. Initialize Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
            authDomain: "solo-parent-app.firebaseapp.com",
            databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "solo-parent-app",
            storageBucket: "solo-parent-app.firebasestorage.app",
            messagingSenderId: "292578110807",
            appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212"
        };
        
        if (!firebase.apps.length) { 
            firebase.initializeApp(firebaseConfig); 
        }
        const db = firebase.firestore();
        console.log("✅ Firebase initialized");

        // 2. DIAGNOSTIC QUERY: No filters, No sorting. Just get ANY 10 users.
        console.log("🔍 Attempting to fetch first 10 users (raw)...");
        const snapshot = await db.collection("users").limit(10).get();

        if (snapshot.empty) {
            console.warn("⚠️ Snapshot is empty. No documents found in 'users' collection.");
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">❌ Connected, but found 0 users in the database.</td></tr>`;
            return;
        }

        console.log(`✅ Found ${snapshot.size} users. Rendering...`);
        tbody.innerHTML = ""; // Clear loading message

        // 3. RENDER EVERYTHING (Even if not pending)
        snapshot.forEach(doc => {
            const data = doc.data();
            cachedApps[doc.id] = data;
            
            // LOG DATA TO CONSOLE FOR YOU TO SEE
            console.log("--------------------------------");
            console.log(`User ID: ${doc.id}`);
            console.log("Fields found:", Object.keys(data)); // This lists all field names
            console.log("Status Field Value:", data.status); // Check exactly what this is
            console.log("Full Data:", data);

            const name = `${data.firstName || 'NoFirst'} ${data.lastName || 'NoLast'}`;
            const status = data.status ? data.status : "MISSING STATUS"; 
            
            // Handle Date
            let dateDisplay = "N/A";
            if (data.createdAt && data.createdAt.toDate) dateDisplay = data.createdAt.toDate().toLocaleDateString();
            else if (data.createdAt) dateDisplay = data.createdAt;

            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 border-b";
            
            // Highlight row color based on status
            let statusColor = "bg-gray-100 text-gray-800";
            if(status === "pending") statusColor = "bg-yellow-100 text-yellow-800";
            if(status === "verified" || status === "approved") statusColor = "bg-green-100 text-green-800";

            row.innerHTML = `
                <td class="px-6 py-4 font-bold text-gray-900">
                    ${name}<br>
                    <span class="text-xs font-normal text-gray-400">${doc.id}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">User Reg</td>
                <td class="px-6 py-4 text-sm text-gray-500">${dateDisplay}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs" onclick="openViewModal('${doc.id}')">View</button>
                    <button class="bg-green-600 text-white px-3 py-1 rounded text-xs" onclick="approveApplication('${doc.id}')">Approve</button>
                    <button class="bg-red-600 text-white px-3 py-1 rounded text-xs" onclick="openRejectModal('${doc.id}')">Reject</button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("❌ CRITICAL ERROR:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
});

// --- ACTIONS (Keep these so buttons don't crash) ---
window.openViewModal = function(id) { 
    const data = cachedApps[id];
    // ALERT THE RAW DATA SO WE CAN SEE IT
    alert("Raw Data:\n" + JSON.stringify(data, null, 2)); 
};

window.approveApplication = async function(userId) {
    if (!confirm("Approve this application?")) return;
    try {
        await firebase.firestore().collection("users").doc(userId).update({ 
            status: "verified", 
            isVerified: true, 
            verificationDate: firebase.firestore.FieldValue.serverTimestamp() 
        });
        showSuccessModal("Approved!");
    } catch (error) { alert("Error: " + error.message); }
};

window.openRejectModal = function(userId) {
    rejectTargetId = userId;
    document.getElementById('rejectModal').classList.remove('hidden');
};

window.closeRejectModal = function() {
    document.getElementById('rejectModal').classList.add('hidden');
};

window.updateRejectText = function() {
    const select = document.getElementById('reject-select');
    const text = document.getElementById('reject-reason-text');
    if(select.value === "Other") { text.value = ""; } else { text.value = select.value; }
};

window.confirmRejectSubmission = function() {
    pendingRejectReason = document.getElementById('reject-reason-text').value;
    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('confirmModal').classList.remove('hidden');
    document.getElementById('confirm-btn-action').onclick = finalizeRejection;
};

window.closeConfirmModal = function() {
    document.getElementById('confirmModal').classList.add('hidden');
};

window.finalizeRejection = async function() {
    try {
        await firebase.firestore().collection("users").doc(rejectTargetId).update({ 
            status: "rejected", rejectionReason: pendingRejectReason 
        });
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Rejected.");
    } catch (error) { alert("Error: " + error.message); }
};

window.showSuccessModal = function(msg) {
    if (document.getElementById('successModal')) {
        document.getElementById('success-message').innerText = msg;
        document.getElementById('successModal').classList.remove('hidden');
    } else { alert(msg); location.reload(); }
};

window.closeSuccessModal = function() { location.reload(); };