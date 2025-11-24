import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

let allUsersData = [];
let donutChartInstance = null;
let predictiveChartInstance = null;
let categoryChartInstance = null;

// --- 1. Forecast Data Configuration ---
const forecastData = [35, 42, 38, 45, 50, 55]; // [Aug, Sep, Oct, Nov, Dec, Jan]
const forecastMonths = ["Aug", "Sep", "Oct", "Nov (Current)", "Dec (Forecast)", "Jan (Forecast)"];

// --- 2. Map Helper (for Charts) ---
// Note: Ensure DESCRIPTION_TO_CODE_MAP is imported or defined if used here. 
// If not using the import from utils, we can rely on the raw category code or add the map here.
const CATEGORY_MAP = {
    "a1": "Rape Victim", "a2": "Widow/er", "a3": "Spouse Detained",
    "a4": "Spouse Incapacitated", "a5": "Separated", "a6": "Annulled",
    "a7": "Abandoned", "b1": "Spouse OFW", "b2": "OFW Relative",
    "c": "Unmarried", "d": "Legal Guardian", "f": "Pregnant"
};

// --- 3. Fetch Data ---
async function fetchAllUsers() {
    if (!db) return;
    try {
        const usersCollection = collection(db, "users");
        const snapshot = await getDocs(usersCollection);
        allUsersData = snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("❌ Error fetching all users:", error);
    }
}

async function fetchUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events-list');
    const eventsCountEl = document.getElementById('events-count');
    
    if (!eventsList || !eventsCountEl) return;

    eventsList.innerHTML = `<p class="text-sm text-gray-500">Loading upcoming events...</p>`;
    try {
        const eventsQuery = query(collection(db, "events"),
            where("eventDate", ">=", Timestamp.now()),
            orderBy("eventDate", "asc")
        );
        const snapshot = await getDocs(eventsQuery);
        eventsCountEl.textContent = snapshot.size;

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
        feather.replace();
    } catch (error) {
        console.error("❌ Error loading events:", error);
        eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
}

// --- 4. Chart Initializers ---
function initDonutChart() {
    const ctx = document.getElementById('donutChart');
    if(!ctx) return;
    
    donutChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: { legend: { display: false } }
        }
    });
}

function initPredictiveChart() {
    const ctx = document.getElementById('predictiveChart');
    if (!ctx) return;
    
    predictiveChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: forecastMonths,
            datasets: [{
                label: 'Registered Solo Parents',
                data: forecastData,
                backgroundColor: ['#93C5FD', '#93C5FD', '#93C5FD', '#3B82F6', '#8B5CF6', '#8B5CF6'],
                borderRadius: 4,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return context.raw + " Applicants"; } } }
            },
            scales: { 
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
}

// --- 5. SMART ANALYTICS LOGIC (SIMPLIFIED LANGUAGE) ---
function generateSmartAnalytics(avgDays) {
    const summaryEl = document.getElementById('predictive-summary-text');
    const actionBox = document.getElementById('prescriptive-action-box');
    const actionContent = document.getElementById('prescriptive-actions-content');
    const optBox = document.getElementById('prescriptive-opt-box');
    const optContent = document.getElementById('prescriptive-opt-content');

    // 1. Analyze Forecast Data
    const currentVal = forecastData[3]; // Nov
    const futureVal = forecastData[5];  // Jan
    const diff = futureVal - currentVal;
    const percentChange = Math.round((diff / currentVal) * 100);
    
    // 2. Analyze Processing Efficiency
    const isSlow = avgDays > 3.0; // If taking more than 3 days, it's slow
    const isFast = avgDays < 1.0; // If taking less than 1 day, it's fast

    // --- PREDICTIVE LOGIC (Simple Explanations) ---
    let predictiveTitle = "";
    let predictiveDesc = "";

    if (percentChange > 10) {
        predictiveTitle = "📈 Expect More Applicants";
        predictiveDesc = `The system predicts <strong>${percentChange}% more applicants</strong> in the coming months. It is going to get busy.`;
    } else if (percentChange < -5) {
        predictiveTitle = "📉 Fewer Applicants Expected";
        predictiveDesc = `The number of applicants is going down by ${Math.abs(percentChange)}%. This might mean people in the barangay don't know about the program yet.`;
    } else {
        predictiveTitle = "⚖️ Steady Number of Applicants";
        predictiveDesc = `The number of applicants is stable. Use this time to finish checking old applications.`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = `
            <strong class="block text-blue-800 mb-1" style="font-size: 14px;">${predictiveTitle}</strong>
            <p style="margin-top: 5px; line-height: 1.4;">${predictiveDesc}</p>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                <span class="text-xs text-gray-500">Current Speed: <strong>${avgDays} Days per approval</strong></span>
            </div>
        `;
    }

    // --- PRESCRIPTIVE LOGIC (Simple Commands) ---
    let actionsHTML = "";
    let optsHTML = "";

    // Scenario A: It's getting busy AND we are slow
    if (percentChange > 10 && isSlow) {
        actionBox.className = "bg-red-50 p-4 rounded-lg border border-red-200";
        actionBox.querySelector('h3').className = "font-medium text-red-800 mb-2";
        
        actionsHTML = `
            <li class="flex items-start"><i data-feather="users" class="text-red-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Assign more staff</strong> to check documents today.</span></li>
            <li class="flex items-start"><i data-feather="clock" class="text-red-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Speed up:</strong> Try to approve IDs within 2 days.</span></li>
        `;
        optsHTML = `
            <li class="flex items-start"><i data-feather="check-square" class="text-orange-500 mr-2 mt-0.5 w-4 h-4"></i><span>Check "Pending" list every morning.</span></li>
        `;
    } 
    // Scenario B: It's getting busy BUT we are fast
    else if (percentChange > 10 && !isSlow) {
        actionsHTML = `
            <li class="flex items-start"><i data-feather="thumbs-up" class="text-green-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Good job!</strong> Your speed is fast enough for the new applicants.</span></li>
            <li class="flex items-start"><i data-feather="printer" class="text-blue-500 mr-2 mt-0.5 w-4 h-4"></i><span>Prepare extra ID cards for printing.</span></li>
        `;
        optsHTML = `
            <li class="flex items-start"><i data-feather="calendar" class="text-orange-500 mr-2 mt-0.5 w-4 h-4"></i><span>Schedule a mass-oath taking event.</span></li>
        `;
    }
    // Scenario C: Few applicants
    else if (percentChange < 0) {
        actionsHTML = `
            <li class="flex items-start"><i data-feather="mic" class="text-blue-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Promote the program:</strong> Announce benefits in the Barangay.</span></li>
            <li class="flex items-start"><i data-feather="search" class="text-purple-500 mr-2 mt-0.5 w-4 h-4"></i><span>Check if applicants are having trouble with the website.</span></li>
        `;
        optsHTML = `
            <li class="flex items-start"><i data-feather="file-text" class="text-gray-500 mr-2 mt-0.5 w-4 h-4"></i><span>Review old rejected applications.</span></li>
        `;
    }
    // Scenario D: Normal
    else {
        actionsHTML = `
            <li class="flex items-start"><i data-feather="check" class="text-green-500 mr-2 mt-0.5 w-4 h-4"></i><span>Operations are normal. Keep it up.</span></li>
        `;
        optsHTML = `
            <li class="flex items-start"><i data-feather="archive" class="text-blue-500 mr-2 mt-0.5 w-4 h-4"></i><span>Archive old completed records.</span></li>
        `;
    }

    // Inject Content
    actionContent.innerHTML = actionsHTML;
    optContent.innerHTML = optsHTML;
    feather.replace();
}

// --- 6. Update Functions ---
function updateCategoryChart() {
    if (!categoryChartInstance || allUsersData.length === 0) return;
    const counts = {};
    allUsersData.forEach(user => {
        let label = CATEGORY_MAP[user.category] || user.category || "Unspecified";
        counts[label] = (counts[label] || 0) + 1;
    });
    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedLabels.map(label => counts[label]);
    categoryChartInstance.update();
}

function calculateAvgProcessingTime() {
    const approvedUsers = allUsersData.filter(u => u.status === 'approved' && u.createdAt && u.approvedAt);
    let avgDays = 0;

    if (approvedUsers.length > 0) {
        let totalHours = 0;
        approvedUsers.forEach(user => {
            const created = user.createdAt.toDate();
            const approved = user.approvedAt.toDate();
            totalHours += (approved - created) / (1000 * 60 * 60);
        });
        avgDays = (totalHours / 24 / approvedUsers.length).toFixed(1);
        document.getElementById('avg-processing-time').textContent = `${avgDays} Days`;
    } else {
        document.getElementById('avg-processing-time').textContent = "N/A";
        avgDays = 0;
    }

    // ✅ Trigger the Smart Analytics after calculation
    generateSmartAnalytics(Number(avgDays));
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    tableBody.innerHTML = users.length === 0 ? `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity.</td></tr>` : "";
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
        const statusClass = user.status === 'approved' ? 'bg-green-100 text-green-800' : (user.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');
        const statusText = user.status.charAt(0).toUpperCase() + user.status.slice(1);
        tableBody.innerHTML += `<tr><td class="px-6 py-4 text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 text-sm text-gray-500">Application</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-sm text-gray-500">${date}</td></tr>`;
    });
}

function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    if (filter === 'this_month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    else if (filter === 'this_year') { startDate = new Date(now.getFullYear(), 0, 1); endDate = new Date(now.getFullYear(), 11, 31); }
    
    let registered = 0, pending = 0, approved = 0, rejected = 0;
    const filteredUsers = allUsersData.filter(u => {
        const d = u.createdAt?.toDate();
        return filter === 'all' || (d >= startDate && d <= endDate);
    });

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
    document.getElementById('chart-label-approved').textContent = `Approved (${Math.round(approved/registered*100)||0}%)`;
    document.getElementById('chart-label-pending').textContent = `Pending (${Math.round(pending/registered*100)||0}%)`;
    document.getElementById('chart-label-rejected').textContent = `Rejected (${Math.round(rejected/registered*100)||0}%)`;

    updateRecentActivity(filteredUsers.slice(0, 5));
    updateCategoryChart();
    calculateAvgProcessingTime();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initDonutChart();
    initPredictiveChart();
    initCategoryChart();
    
    const dateSelect = document.getElementById('date-range-select');
    if(dateSelect) dateSelect.addEventListener('change', function() { updateDashboardStats(this.value); });
    document.getElementById('generate-report-btn')?.addEventListener('click', handleGenerateReport);

    await fetchUpcomingEvents();
    await fetchAllUsers();
    updateDashboardStats('this_month');
    feather.replace();
});

function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    
    const date = new Date().toLocaleDateString();
    
    // 1. Get the Counts
    const registered = document.getElementById('registered-count').textContent;
    const pending = document.getElementById('pending-count').textContent;
    const approved = document.getElementById('approved-count').textContent;
    
    // 2. Get the Charts as Images
    let forecastImg = '';
    const forecastCanvas = document.getElementById('predictiveChart');
    if (forecastCanvas) {
        forecastImg = `<div style="text-align:center; margin: 20px 0;"><img src="${forecastCanvas.toDataURL()}" style="max-width:100%; height:auto; border:1px solid #eee;"></div>`;
    }

    let demoImg = '';
    const demoCanvas = document.getElementById('categoryChart');
    if (demoCanvas) {
        // Smaller width for the pie chart so it doesn't take up the whole page
        demoImg = `<div style="text-align:center; margin: 20px 0;"><img src="${demoCanvas.toDataURL()}" style="max-width:60%; height:auto; margin: 0 auto;"></div>`;
    }

    // 3. Get the Smart Text Analysis
    const predictiveText = document.getElementById('predictive-summary-text').innerHTML;
    const actionsText = document.getElementById('prescriptive-actions-content').innerHTML;
    const optsText = document.getElementById('prescriptive-opt-content').innerHTML;

    // 4. Build the HTML
    let html = `
    <div class="letterhead">
        <h1>SPDA Analytics Report</h1>
        <p>Official Report • Generated: ${date}</p>
    </div>
    
    <h2 class="report-title">1. System Overview</h2>
    <table>
        <thead>
            <tr>
                <th>Metric</th>
                <th>Count</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>Total Registered Solo Parents</td><td>${registered}</td></tr>
            <tr><td>Pending Applications</td><td>${pending}</td></tr>
            <tr><td>Verified/Approved Members</td><td>${approved}</td></tr>
        </tbody>
    </table>
    
    <h2 class="report-title">2. Applicant Demographics</h2>
    <p style="font-size:11px; color:#666; text-align:center;">Breakdown of applicants by solo parent category.</p>
    ${demoImg}

    <h2 class="report-title">3. Applicant Forecast (Predictive)</h2>
    <div style="background:#f9fafb; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #e5e7eb;">
        ${predictiveText}
    </div>
    ${forecastImg}
    
    <h2 class="report-title">4. Prescriptive Recommendations</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
            <h3 style="font-size:14px; border-bottom:2px solid #10B981; padding-bottom:5px;">Recommended Actions</h3>
            <ul style="font-size:12px; margin-top:10px;">${actionsText}</ul>
        </div>
        <div>
            <h3 style="font-size:14px; border-bottom:2px solid #F59E0B; padding-bottom:5px;">Optimization Tips</h3>
            <ul style="font-size:12px; margin-top:10px;">${optsText}</ul>
        </div>
    </div>
    `;
    
    printContainer.innerHTML = html;
    printContainer.style.display = 'block';
    
    // Wait for images to render in the DOM before printing
    setTimeout(() => { 
        window.print(); 
    }, 500);
}