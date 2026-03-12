import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Initialize UI
initSidebar();
initLogout();

let allUsersData = [];
let currentFilteredUsers = []; 
let donutChartInstance = null;
let predictiveChartInstance = null;
let categoryChartInstance = null;

// --- Helper: Category Map ---
const CATEGORY_MAP = {
    "a1": "Rape Victim", "a2": "Widow/er", "a3": "Spouse Detained",
    "a4": "Spouse Incapacitated", "a5": "Separated", "a6": "Annulled",
    "a7": "Abandoned", "b1": "Spouse OFW", "b2": "OFW Relative",
    "c": "Unmarried", "d": "Legal Guardian", 
    "e": "Relative (4th Degree)",
    "f": "Pregnant"
};

// ==========================================
// 1. DATA FETCHING
// ==========================================
async function fetchAllUsers() {
    if (!db) return;
    try {
        allUsersData = []; 
        const usersSnapshot = await getDocs(collection(db, "users"));
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === "pending" || data.status === "rejected") {
                allUsersData.push({ ...data, id: doc.id });
            }
        });

        const recordsSnapshot = await getDocs(collection(db, "solo_parent_records"));
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            allUsersData.push({
                ...data,
                id: doc.id,
                status: data.status || "approved",
                createdAt: data.registrationDate || data.createdAt 
            });
        });
    } catch (error) {
        console.error("❌ Error fetching combined users:", error);
    }
}

async function fetchUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events-list');
    if (!eventsList) return;

    eventsList.innerHTML = `<p class="text-sm text-gray-500">Loading upcoming events...</p>`;
    try {
        const eventsQuery = query(collection(db, "events"), where("eventDate", ">=", Timestamp.now()), orderBy("eventDate", "asc"));
        const snapshot = await getDocs(eventsQuery);

        if (snapshot.empty) {
            eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
            return;
        }

        eventsList.innerHTML = "";
        const topEvents = snapshot.docs.slice(0, 3);
        
        topEvents.forEach(doc => {
            const event = doc.data();
            const eventDate = event.eventDate.toDate();
            const eventHtml = `
            <div class="flex items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div class="bg-blue-100 p-2 rounded-lg mr-3 h-10 w-10 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    ${eventDate.getDate()}
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-800 truncate w-48">${event.eventName}</h3>
                    <p class="text-xs text-gray-500">${eventDate.toLocaleDateString()} • ${event.eventLocation || 'Online'}</p>
                </div>
            </div>`;
            eventsList.innerHTML += eventHtml;
        });
        if(typeof feather !== 'undefined') feather.replace();
    } catch (error) {
        eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
}

// ==========================================
// 2. CHART INITIALIZERS
// ==========================================
function initDonutChart() {
    const ctx = document.getElementById('donutChart');
    if(!ctx) return;
    donutChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Approved', 'Pending', 'Rejected'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }
    });
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
}

// ==========================================
// 3. LOGIC FUNCTIONS
// ==========================================
function updateCategoryChart(users, filterType) {
    if (!categoryChartInstance || !users) return;
    const totalUsers = users.length;
    const counts = {};
    users.forEach(user => {
        let label = CATEGORY_MAP[user.category] || user.category || "Unspecified";
        counts[label] = (counts[label] || 0) + 1;
    });

    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const sortedData = sortedLabels.map(label => counts[label]);

    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedData;
    categoryChartInstance.update();

    const descEl = document.getElementById('demographics-description');
    if (descEl) {
        if (totalUsers === 0) {
            descEl.textContent = "No data available for this time period.";
            return;
        }
        const textParts = sortedLabels.map(label => {
            const count = counts[label];
            const percentage = Math.round((count / totalUsers) * 100);
            return `<strong>${percentage}% (${count})</strong> ${label}`;
        });

        let dateContext = "";
        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();

        if (filterType === 'this_month') dateContext = `this ${monthName} ${year}`;
        else if (filterType === 'this_year') dateContext = `this year (${year})`;
        else if (filterType === 'all') dateContext = `of all time`;
        else if (filterType === 'custom') {
            const startInput = document.getElementById('start-date').value;
            const endInput = document.getElementById('end-date').value;
            if (startInput && endInput) {
                dateContext = `from ${new Date(startInput).toLocaleDateString()} to ${new Date(endInput).toLocaleDateString()}`;
            } else dateContext = `in the selected range`;
        } else dateContext = `in the selected range`;

        let sentence = textParts.length > 0 ? textParts.slice(0, 3).join(', ') + (textParts.length > 3 ? '...' : '') : "No categories found";
        descEl.innerHTML = `There are ${sentence} applied ${dateContext}.`;
    }
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    tableBody.innerHTML = users.length === 0 ? `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity.</td></tr>` : "";
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Unknown";
        let date = 'N/A';
        if (user.createdAt) {
            try { date = typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString(); } catch(e) {}
        }
        const statusClass = user.status === 'approved' ? 'bg-green-100 text-green-800' : (user.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');
        const statusText = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown";
        tableBody.innerHTML += `<tr><td class="px-6 py-4 text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 text-sm text-gray-500">Application</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-sm text-gray-500">${date}</td></tr>`;
    });
}

function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    
    if (filter === 'this_week') { 
        startDate = new Date(); startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0,0,0,0);
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
    } else if (filter === 'this_month') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
    } else if (filter === 'this_year') { 
        startDate = new Date(now.getFullYear(), 0, 1); 
        endDate = new Date(now.getFullYear(), 11, 31); 
    } else if (filter === 'custom') {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        if (startVal && endVal) { startDate = new Date(startVal); endDate = new Date(endVal); } 
        else { startDate = new Date(0); endDate = new Date(); }
    } else {
        startDate = new Date(0); endDate = new Date();
    }
    
    let registered = 0, pending = 0, approved = 0, rejected = 0;
    
    const filteredUsers = allUsersData.filter(u => {
        const d = u.createdAt ? (typeof u.createdAt.toDate === 'function' ? u.createdAt.toDate() : new Date(u.createdAt)) : null;
        return filter === 'all' || (d && d >= startDate && d <= endDate);
    });

    currentFilteredUsers = filteredUsers; // Save for printing

    filteredUsers.forEach(u => {
        if (u.status === 'pending') pending++;
        else if (u.status === 'approved') approved++;
        else if (u.status === 'rejected') rejected++;
    });
    registered = filteredUsers.length;

    document.getElementById('registered-count').textContent = registered;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('approved-count').textContent = approved;

    if (donutChartInstance) {
        donutChartInstance.data.datasets[0].data = [approved, pending, rejected];
        donutChartInstance.update();
    }
    
    const pApproved = registered > 0 ? Math.round(approved/registered*100) : 0;
    const pPending = registered > 0 ? Math.round(pending/registered*100) : 0;
    const pRejected = registered > 0 ? Math.round(rejected/registered*100) : 0;

    document.getElementById('chart-label-approved').textContent = `Approved (${pApproved}%)`;
    document.getElementById('chart-label-pending').textContent = `Pending (${pPending}%)`;
    document.getElementById('chart-label-rejected').textContent = `Rejected (${pRejected}%)`;

    const statusDescEl = document.getElementById('status-description');
    if (statusDescEl) {
        if (pending > 0) {
            statusDescEl.innerHTML = `You have <strong>${pending} pending applications</strong> waiting for review.`;
        } else {
            statusDescEl.innerHTML = `Great job! You have <strong>no pending applications</strong>. The system has processed <strong>${registered}</strong> records in this range.`;
        }
    }

    updateRecentActivity(filteredUsers.slice(0, 5));
    updateCategoryChart(filteredUsers, filter);
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // Connect Print Button securely
    const reportBtn = document.getElementById('generate-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', window.handleGenerateReport);
    }

    try { initDonutChart(); } catch (e) {}
    try { initCategoryChart(); } catch (e) {}
    
    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range');
    
    if(dateSelect && customRangeDiv) {
        dateSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customRangeDiv.classList.remove('hidden');
                customRangeDiv.classList.add('flex');
            } else {
                customRangeDiv.classList.add('hidden');
                customRangeDiv.classList.remove('flex');
                updateDashboardStats(this.value);
            }
        });
    }
    
    const applyBtn = document.getElementById('apply-custom-date');
    if(applyBtn) applyBtn.addEventListener('click', function() { updateDashboardStats('custom'); });

    await fetchUpcomingEvents();
    await fetchAllUsers();
    updateDashboardStats('this_month');
});

// ==========================================
// 🖨️ INVISIBLE IFRAME PRINT METHOD
// ==========================================
window.handleGenerateReport = function() {
    const date = new Date().toLocaleDateString();
    
    // Get Selected Range Text
    const filterType = document.getElementById('date-range-select')?.value || 'all';
    let rangeLabel = "All Time";
    const now = new Date();
    
    if (filterType === 'this_week') {
        const start = new Date(now); start.setDate(now.getDate() - now.getDay()); 
        const end = new Date(start); end.setDate(start.getDate() + 6); 
        rangeLabel = `This Week (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
    } 
    else if (filterType === 'this_month') rangeLabel = `This Month (${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()})`;
    else if (filterType === 'this_year') rangeLabel = `This Year (${now.getFullYear()})`;
    else if (filterType === 'custom') {
        const s = document.getElementById('start-date')?.value;
        const e = document.getElementById('end-date')?.value;
        if (s && e) rangeLabel = `${new Date(s).toLocaleDateString()} - ${new Date(e).toLocaleDateString()}`;
    }

    // Get Data
    const registered = document.getElementById('registered-count')?.textContent || "0";
    const pending = document.getElementById('pending-count')?.textContent || "0";
    const approved = document.getElementById('approved-count')?.textContent || "0";

    const demoText = document.getElementById('demographics-description')?.innerHTML || "No data available.";
    const statusDesc = document.getElementById('status-description')?.innerHTML || "No status available.";

    const descriptiveNarrative = `
        The SPDA System currently manages a total of <strong>${registered} registered solo parents</strong>. 
        There are <strong>${pending} new applications</strong> pending review, and <strong>${approved} members</strong> have been fully verified.
    `;

    // GENERATE RECENT ACTIVITY LOG
    let activityRows = '';
    const recentUsersToPrint = currentFilteredUsers.slice(0, 5);

    if (recentUsersToPrint.length > 0) {
        recentUsersToPrint.forEach(user => {
            const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
            let dateStr = 'N/A';
            if (user.createdAt) {
                try { dateStr = typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString(); } catch(e) {}
            }
            const statusText = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown";
            
            // Adjust colors to match Tailwind
            let statusColor = '#d97706'; // Pending (Yellow/Orange)
            if(user.status === 'approved') statusColor = '#059669'; // Approved (Green)
            if(user.status === 'rejected') statusColor = '#dc2626'; // Rejected (Red)

            activityRows += `
                <tr>
                    <td>${name}</td>
                    <td>Application</td>
                    <td style="color: ${statusColor}; font-weight: 600;">${statusText}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        });
    } else {
        activityRows = `<tr><td colspan="4" style="text-align: center; color: #6b7280;">No recent activity found.</td></tr>`;
    }

    // COMPLETE STYLED HTML DOCUMENT
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SPDA Dashboard Report</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Inter', -apple-system, sans-serif;
                color: #1f2937;
                line-height: 1.6;
                padding: 40px;
                max-width: 800px;
                margin: 0 auto;
            }
            .letterhead { display: flex; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
            .letterhead img { width: 80px; height: 80px; margin-right: 15px; object-fit: contain; }
            .letterhead h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3a8a; }
            .letterhead p { margin: 0; font-size: 12px; color: #6b7280; }
            .report-date { margin: 5px 0 0 0 !important; font-size: 13px !important; color: #000 !important; font-weight: 600; }
            
            h3 { 
                font-size: 15px; 
                font-weight: 700; 
                margin-bottom: 12px; 
                text-transform: uppercase; 
                margin-top: 35px;
                color: #111827;
                border-bottom: 2px solid #3b82f6; 
                padding-bottom: 8px;
            }
            
            .text-box { margin-bottom: 20px; font-size: 14px; }
            
            .highlight-box { 
                background: #f9fafb; 
                padding: 16px; 
                border-radius: 8px; 
                border: 1px solid #e5e7eb; 
                font-size: 14px; 
                margin-bottom: 20px; 
            }
            
            table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 20px; }
            th { border-bottom: 2px solid #e5e7eb; padding: 12px 8px; color: #4b5563; font-weight: 600; }
            td { border-bottom: 1px solid #f3f4f6; padding: 12px 8px; color: #374151; }
            
            .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #9ca3af; font-style: italic; }
            
            @media print {
                body { padding: 0; }
                .highlight-box { break-inside: avoid; }
                table { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="letterhead">
            <img src="LOGO.png" alt="SPDA Logo" onerror="this.style.display='none'">
            <div>
                <h1>SPDA Analytics Report</h1>
                <p>Official Executive Summary • Generated: ${date}</p>
                <p class="report-date">Reporting Period: ${rangeLabel}</p>
            </div>
        </div>
        
        <h3>1. Descriptive Analytics (Status)</h3>
        <div class="text-box">
            <p>${descriptiveNarrative}</p>
            <p style="margin-top:10px;"><em>${statusDesc}</em></p>
        </div>
        
        <h3>2. Applicant Demographics</h3>
        <div class="highlight-box">
            <p style="color:#4b5563; margin-bottom:5px; font-weight:600;">Demographic Breakdown:</p>
            <p style="margin:0;">${demoText}</p>
        </div>

        <h3>3. Recent Activity Log</h3>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Activity</th>
                    <th>Status</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${activityRows}
            </tbody>
        </table>
        
        <div class="footer">
            <p>End of Report. Automatically generated by SPDA System.</p>
        </div>
    </body>
    </html>
    `;

    // CREATE INVISIBLE IFRAME
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-1000px'; // Hides it off-screen entirely
    printFrame.style.left = '-1000px';
    printFrame.style.width = '100%';
    printFrame.style.height = '100%';
    printFrame.id = 'hidden-print-frame';
    
    document.body.appendChild(printFrame);

    // WRITE HTML TO IFRAME
    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    // WAIT FOR FONT TO LOAD, THEN PRINT IFRAME
    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        
        // Clean up the invisible iframe after printing
        setTimeout(() => {
            if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
            }
        }, 5000); 
    }, 800); // 800ms gives Google Fonts time to apply 'Inter'
};