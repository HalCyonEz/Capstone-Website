import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

let allUsersData = [];
let donutChartInstance = null;
let predictiveChartInstance = null;
let categoryChartInstance = null; // ✅ NEW: Chart instance for demographics

// --- Data ---
const mockAnalyticsData = {
    predictive: [
        { metric: "Application Forecast", value: "45-55", notes: "65% confidence level" },
        { metric: "Approval Rate Prediction", value: "78%", notes: "Based on current trends" },
        { metric: "Resource Utilization", value: "82%", notes: "Predicted staff workload" },
        { metric: "Event Participation Forecast", value: "120-140", notes: "Based on RSVPs" }
    ],
    prescriptive: [
        { category: "Recommended Actions", details: "Increase outreach in District 5 - high potential applicants" },
        { category: "Recommended Actions", details: "Review pending applications from last week to meet monthly targets" },
        { category: "Recommended Actions", details: "Schedule additional verification staff for peak application days" },
        { category: "Optimization Suggestions", details: "Process optimization could reduce approval time by 2.3 days" },
        { category: "Optimization Suggestions", details: "Automate document verification to handle 30% more applications" }
    ]
};

const forecastData = [35, 42, 38, 45, 50, 55];
const forecastMonths = ["Aug", "Sep", "Oct", "Nov (Current)", "Dec (Forecast)", "Jan (Forecast)"];

// --- Helper: Description Map (To make pie chart labels readable) ---
// NOTE: You can also import this from utils.js if you exported it there
const CATEGORY_MAP = {
    "a1": "Rape Victim", "a2": "Widow/er", "a3": "Spouse Detained",
    "a4": "Spouse Incapacitated", "a5": "Separated", "a6": "Annulled",
    "a7": "Abandoned", "b1": "Spouse OFW", "b2": "OFW Relative",
    "c": "Unmarried", "d": "Legal Guardian", "f": "Pregnant"
};

// --- Fetch Data ---
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
    // const nextEventEl = document.getElementById('next-event-text'); // Removed from UI, keeping variable just in case
    
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
        // Show only top 3 events
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
        console.error("❌ Error loading upcoming events:", error);
        eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
}

// --- Chart Initializers ---

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
            plugins: { 
                legend: { display: false } 
            }
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
    
    const summaryEl = document.getElementById('predictive-summary-text');
    if(summaryEl) {
        summaryEl.innerHTML = `Based on the current trend, we project <strong>${forecastData[4]} to ${forecastData[5]}</strong> new solo parent registrations for the upcoming months. <br><br> This represents a <strong>10-15% increase</strong> compared to the previous quarter.`;
    }
}

// ✅ NEW: Initialize Applicant Demographics Pie Chart
function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: [], // Will populate dynamically
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
                    '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right',
                    labels: { boxWidth: 10, font: { size: 10 } }
                }
            }
        }
    });
}

// --- Updates & Logic ---

function updateCategoryChart() {
    if (!categoryChartInstance || allUsersData.length === 0) return;

    const counts = {};
    allUsersData.forEach(user => {
        // Use map to get readable name, fallback to code
        let label = CATEGORY_MAP[user.category] || user.category || "Unspecified";
        counts[label] = (counts[label] || 0) + 1;
    });

    // Sort by count descending to make chart look better
    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const sortedData = sortedLabels.map(label => counts[label]);

    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedData;
    categoryChartInstance.update();
}

function calculateAvgProcessingTime() {
    // Filter users who are approved AND have both timestamps
    const approvedUsers = allUsersData.filter(u => u.status === 'approved' && u.createdAt && u.approvedAt);
    
    if (approvedUsers.length === 0) {
        document.getElementById('avg-processing-time').textContent = "N/A";
        return;
    }

    let totalHours = 0;
    approvedUsers.forEach(user => {
        const created = user.createdAt.toDate();
        const approved = user.approvedAt.toDate();
        // Difference in milliseconds -> hours
        const diff = (approved - created) / (1000 * 60 * 60);
        totalHours += diff;
    });

    const avgHours = totalHours / approvedUsers.length;
    const avgDays = (avgHours / 24).toFixed(1); // Convert to days with 1 decimal

    // Update DOM
    const el = document.getElementById('avg-processing-time');
    if (el) el.textContent = `${avgDays} Days`;
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    if (!users || users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity for this period.</td></tr>`;
        return;
    }
    tableBody.innerHTML = "";
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
        let statusText = 'Pending';
        let statusClass = 'bg-yellow-100 text-yellow-800';
        if (user.status === 'approved') { statusText = 'Approved'; statusClass = 'bg-green-100 text-green-800'; }
        else if (user.status === 'rejected') { statusText = 'Rejected'; statusClass = 'bg-red-100 text-red-800'; }
        const row = `<tr><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">New Application</td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td></tr>`;
        tableBody.innerHTML += row;
    });
}

function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    if (filter === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filter === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filter === 'custom') {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        if (!startVal || !endVal) { alert("Please select both dates."); return; }
        startDate = new Date(startVal + "T00:00:00");
        endDate = new Date(endVal + "T23:59:59");
    }

    let registeredCount = 0, pendingCount = 0, approvedCount = 0, rejectedCount = 0;
    registeredCount = allUsersData.filter(u => { const c = u.createdAt?.toDate(); return c && (filter === 'all' || (c >= startDate && c <= endDate)); }).length;
    pendingCount = allUsersData.filter(u => { const c = u.createdAt?.toDate(); return u.status === 'pending' && c && (filter === 'all' || (c >= startDate && c <= endDate)); }).length;
    approvedCount = allUsersData.filter(u => { const a = u.approvedAt?.toDate(); return u.status === 'approved' && a && (filter === 'all' || (a >= startDate && a <= endDate)); }).length;
    rejectedCount = allUsersData.filter(u => { const c = u.createdAt?.toDate(); return u.status === 'rejected' && c && (filter === 'all' || (c >= startDate && c <= endDate)); }).length;

    document.getElementById('registered-count').textContent = registeredCount;
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('approved-count').textContent = approvedCount;

    const total = approvedCount + pendingCount + rejectedCount;
    const approvedPercent = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
    const pendingPercent = total === 0 ? 0 : Math.round((pendingCount / total) * 100);
    const rejectedPercent = (total === 0 || (approvedPercent + pendingPercent) > 100) ? 0 : (100 - approvedPercent - pendingPercent);

    if (donutChartInstance) { donutChartInstance.data.datasets[0].data = [approvedCount, pendingCount, rejectedCount]; donutChartInstance.update(); }
    document.getElementById('chart-label-approved').textContent = `Approved (${approvedPercent}%)`;
    document.getElementById('chart-label-pending').textContent = `Pending (${pendingPercent}%)`;
    document.getElementById('chart-label-rejected').textContent = `Rejected (${rejectedPercent}%)`;

    const activityUsers = allUsersData.filter(u => { const c = u.createdAt?.toDate(); return c && (filter === 'all' || (c >= startDate && c <= endDate)); });
    const sortedActivityUsers = activityUsers.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)).slice(0, 5);
    updateRecentActivity(sortedActivityUsers);
    
    // ✅ NEW: Update the new analytics metrics
    updateCategoryChart();
    calculateAvgProcessingTime();
}

function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    const date = new Date().toLocaleDateString();
    const registered = document.getElementById('registered-count').textContent;
    const pending = document.getElementById('pending-count').textContent;
    const approved = document.getElementById('approved-count').textContent;
    
    let forecastImg = '';
    const forecastCanvas = document.getElementById('predictiveChart');
    if (forecastCanvas) forecastImg = `<div style="text-align:center; margin: 20px 0;"><img src="${forecastCanvas.toDataURL()}" style="max-width:100%; height:auto;"></div>`;

    // ✅ NEW: Include demographics chart in report
    let demoImg = '';
    const demoCanvas = document.getElementById('categoryChart');
    if (demoCanvas) demoImg = `<div style="text-align:center; margin: 20px 0;"><img src="${demoCanvas.toDataURL()}" style="max-width:60%; height:auto; margin: 0 auto;"></div>`;

    let html = `
    <div class="letterhead"><h1>Solo Parent Data Analysis System</h1><p>Official Analytical Report</p><p>Date Generated: ${date}</p></div>
    
    <h2 class="report-title">1. System Overview (Descriptive)</h2>
    <table><thead><tr><th>Metric</th><th>Count</th></tr></thead><tbody>
    <tr><td>Registered Solo Parents</td><td>${registered}</td></tr>
    <tr><td>Pending Applications</td><td>${pending}</td></tr>
    <tr><td>Approved Applications</td><td>${approved}</td></tr>
    </tbody></table>
    
    <h2 class="report-title">2. Applicant Demographics</h2>
    <p style="font-size:11px; color:#666;">Breakdown of applicants by solo parent category.</p>
    ${demoImg}

    <h2 class="report-title">3. Applicant Forecast (Predictive)</h2>
    <p style="font-size:11px; color:#666;">Visual representation of applicant trends.</p>
    ${forecastImg}
    <table><thead><tr><th>Metric</th><th>Predicted Value</th><th>Notes</th></tr></thead><tbody>
    ${mockAnalyticsData.predictive.map(item => `<tr><td>${item.metric}</td><td>${item.value}</td><td>${item.notes}</td></tr>`).join('')}
    </tbody></table>
    
    <h2 class="report-title">4. Prescriptive Analytics</h2>
    <table><thead><tr><th>Category</th><th>Suggestion / Action</th></tr></thead><tbody>
    ${mockAnalyticsData.prescriptive.map(item => `<tr><td>${item.category}</td><td>${item.details}</td></tr>`).join('')}
    </tbody></table>`;
    
    printContainer.innerHTML = html;
    printContainer.style.display = 'block';
    setTimeout(() => { window.print(); }, 500);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Dashboard Loaded");
    initDonutChart();
    initPredictiveChart();
    initCategoryChart(); // ✅ Initialize the new chart
    
    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range');
    const applyBtn = document.getElementById('apply-custom-date');
    const reportBtn = document.getElementById('generate-report-btn');

    if(dateSelect) {
        dateSelect.addEventListener('change', function () {
            const filterValue = this.value;
            if (filterValue === 'custom') { customRangeDiv.classList.remove('hidden'); customRangeDiv.classList.add('sm:flex'); }
            else { customRangeDiv.classList.add('hidden'); customRangeDiv.classList.remove('sm:flex'); updateDashboardStats(filterValue); }
        });
    }
    if(applyBtn) applyBtn.addEventListener('click', function () { updateDashboardStats('custom'); });
    if(reportBtn) reportBtn.addEventListener('click', handleGenerateReport);

    await fetchUpcomingEvents();
    await fetchAllUsers();
    updateDashboardStats('this_month');
    feather.replace();
});