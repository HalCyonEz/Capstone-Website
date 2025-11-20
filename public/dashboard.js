import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

let allUsersData = [];
let donutChartInstance = null;
let predictiveChartInstance = null;

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
    const nextEventEl = document.getElementById('next-event-text');
    if (!eventsList || !eventsCountEl || !nextEventEl) return;

    eventsList.innerHTML = `<p class="text-sm text-gray-500">Loading upcoming events...</p>`;
    try {
        const eventsQuery = query(collection(db, "events"),
            where("eventDate", ">=", Timestamp.now()),
            orderBy("eventDate", "asc")
        );
        const snapshot = await getDocs(eventsQuery);
        eventsCountEl.textContent = snapshot.size;

        if (snapshot.empty) {
            nextEventEl.textContent = "No upcoming events";
            eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
            return;
        }

        const nextEvent = snapshot.docs[0].data();
        nextEventEl.textContent = `Next: ${nextEvent.eventName}`;

        eventsList.innerHTML = "";
        snapshot.forEach(doc => {
            const event = doc.data();
            const eventDate = event.eventDate.toDate();
            const eventHtml = `
      <div class="flex items-start">
        <div class="bg-blue-100 p-3 rounded-lg mr-4">
          <i data-feather="calendar" class="text-blue-600"></i>
        </div>
        <div>
          <h3 class="font-medium text-gray-800">${event.eventName}</h3>
          <p class="text-sm text-gray-600">${eventDate.toLocaleDateString()} | ${event.eventTime || ''}</p>
          <p class="text-xs text-gray-500 mt-1">${event.eventLocation || 'Online'}</p>
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

function initDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChartInstance = new Chart(ctx, {
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
            cutout: '70%',
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
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return context.raw + " Applicants"; } } }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
    const summaryEl = document.getElementById('predictive-summary-text');
    if(summaryEl) {
        summaryEl.innerHTML = `Based on the current trend, we project <strong>${forecastData[4]} to ${forecastData[5]}</strong> new solo parent registrations for the upcoming months. <br><br> This represents a <strong>10-15% increase</strong> compared to the previous quarter.`;
    }
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
}

function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    const date = new Date().toLocaleDateString();
    const registered = document.getElementById('registered-count').textContent;
    const pending = document.getElementById('pending-count').textContent;
    const approved = document.getElementById('approved-count').textContent;
    
    let chartImg = '';
    const chartCanvas = document.getElementById('predictiveChart');
    if (chartCanvas) {
        chartImg = `<div style="text-align:center; margin: 20px 0;"><img src="${chartCanvas.toDataURL()}" style="max-width:100%; height:auto;"></div>`;
    }

    let html = `<div class="letterhead"><h1>Solo Parent Data Analysis System</h1><p>Official Analytical Report</p><p>Date Generated: ${date}</p></div><h2 class="report-title">1. System Overview (Descriptive)</h2><table><thead><tr><th>Metric</th><th>Count</th></tr></thead><tbody><tr><td>Registered Solo Parents</td><td>${registered}</td></tr><tr><td>Pending Applications</td><td>${pending}</td></tr><tr><td>Approved Applications</td><td>${approved}</td></tr></tbody></table><h2 class="report-title">2. Predictive Analytics (Forecast)</h2><p style="font-size:11px; color:#666;">Visual representation of applicant trends.</p>${chartImg}<table><thead><tr><th>Metric</th><th>Predicted Value</th><th>Notes</th></tr></thead><tbody>${mockAnalyticsData.predictive.map(item => `<tr><td>${item.metric}</td><td>${item.value}</td><td>${item.notes}</td></tr>`).join('')}</tbody></table><h2 class="report-title">3. Prescriptive Analytics</h2><table><thead><tr><th>Category</th><th>Suggestion / Action</th></tr></thead><tbody>${mockAnalyticsData.prescriptive.map(item => `<tr><td>${item.category}</td><td>${item.details}</td></tr>`).join('')}</tbody></table>`;
    printContainer.innerHTML = html;
    printContainer.style.display = 'block';
    setTimeout(() => { window.print(); }, 500);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Dashboard Loaded");
    initDonutChart();
    initPredictiveChart();
    
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