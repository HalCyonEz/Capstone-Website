// utils.js
import { db } from "./firebase-config.js";
import { doc, updateDoc, Timestamp, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- Constants ---
export const DESCRIPTION_TO_CODE_MAP = {
    "Birth of a child as a consequence of rape": "a1",
    "Widow/widower": "a2",
    "Spouse of person deprived of liberty": "a3",
    "Spouse of person with physical or mental incapacity": "a4",
    "Due to legal separation or de facto separation": "a5",
    "Due to nullity or annulment of marriage": "a6",
    "Abandonment by the spouse": "a7",
    "Spouse of OFW": "b1",
    "Relative of OFW": "b2",
    "Unmarried person": "c",
    "Legal guardian / Adoptive parent / Foster parent": "d",
    "Relative within the fourth (4th) civil degree of consanguinity of affinity": "e",
    "Pregnant Woman": "f"
};

export const CODE_TO_DESCRIPTION_MAP = {};
for (const description in DESCRIPTION_TO_CODE_MAP) {
    const code = DESCRIPTION_TO_CODE_MAP[description];
    CODE_TO_DESCRIPTION_MAP[code] = description;
}

// --- UI Helpers ---
export function initSidebar() {
    const sidebarLinks = document.querySelectorAll('nav a');
    const currentPath = window.location.pathname;
    
    // Highlight logic
    sidebarLinks.forEach(link => {
        // 1. Reset ALL links to gray first
        link.classList.remove('bg-blue-50', 'text-blue-700');
        link.classList.add('text-gray-600');
        
        const href = link.getAttribute('href');
        
        // 2. Only highlight if the URL matches EXACTLY
        // We removed the "profile.html" check, so it won't highlight Members anymore
        if (currentPath.endsWith(href)) {
            link.classList.add('bg-blue-50', 'text-blue-700');
            link.classList.remove('text-gray-600');
        }
    });

    // Mobile toggle logic
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    if (sidebarToggle && mobileSidebar) {
        sidebarToggle.addEventListener('click', function () {
            mobileSidebar.style.display = mobileSidebar.style.display === 'none' ? 'flex' : 'none';
        });
        mobileSidebar.addEventListener('click', function (e) {
            if (e.target === mobileSidebar) {
                mobileSidebar.style.display = 'none';
            }
        });
    }
}

export function initLogout() {
    const logoutButtons = Array.from(document.querySelectorAll('button')).filter(button =>
        button.textContent.includes('Log Out') || button.querySelector('i[data-feather="log-out"]')
    );
    logoutButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    });
}

// --- Database Actions (Shared) ---
export async function approveUser(docId) {
    try {
        await updateDoc(doc(db, "users", docId), {
            status: "approved",
            approvedAt: Timestamp.now()
        });
        console.log('✅ Application approved successfully!');
        location.reload();
    } catch (error) {
        console.error('❌ Error approving:', error);
    }
}

export async function rejectUser(docId) {
    try {
        await updateDoc(doc(db, "users", docId), { status: "rejected" });
        console.log('✅ Application rejected.');
        location.reload();
    } catch (error) {
        console.error('❌ Error rejecting:', error);
    }
}

export async function approveRenewal(submissionId) {
    const submissionRef = doc(db, "renewalSubmissions", submissionId);
    try {
        await runTransaction(db, async (transaction) => {
            const submissionSnap = await transaction.get(submissionRef);
            if (!submissionSnap.exists()) throw new Error("Submission does not exist!");
            const submissionData = submissionSnap.data();
            const userId = submissionData.userId;
            if (!userId) throw new Error("No User ID in submission.");
            const userRef = doc(db, "users", userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("User profile not found.");
            const { status, userId: uid, createdAt, submittedAt, ...profileUpdates } = submissionData;
            transaction.update(userRef, {
                ...profileUpdates,
                renewal_status: "approved",
                lastRenewalDate: serverTimestamp()
            });
            transaction.update(submissionRef, { status: "approved" });
        });
        alert("Renewal approved successfully!");
        location.reload(); 
    } catch (error) {
        console.error("❌ Renewal Transaction failed:", error);
        alert("Failed: " + error.message);
    }
}

export async function rejectRenewal(submissionId, reason) {
    const submissionRef = doc(db, "renewalSubmissions", submissionId);
    try {
        await runTransaction(db, async (transaction) => {
            const submissionSnap = await transaction.get(submissionRef);
            if (!submissionSnap.exists()) throw new Error("Submission not found.");
            const userId = submissionSnap.data().userId;
            const userRef = doc(db, "users", userId);
            transaction.update(submissionRef, { status: "rejected", rejectionReason: reason });
            transaction.update(userRef, { renewal_status: "rejected" });
        });
        alert("Renewal rejected.");
        location.reload();
    } catch (error) {
        console.error("❌ Renewal Rejection failed:", error);
        alert("Failed: " + error.message);
    }
}