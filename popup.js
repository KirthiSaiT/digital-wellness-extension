document.addEventListener('DOMContentLoaded', () => {
  // Force an update of current tab activity to ensure data is fresh
  chrome.runtime.sendMessage({ action: 'updateCurrentActivity' }, (response) => {
    console.log("updateCurrentActivity response:", response);
  });

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.id.replace('tab-', '')).classList.add('active');
      if (button.id === 'tab-insights') {
        console.log("Switching to Insights tab, loading data...");
        loadInsightsData();
      }
    });
  });

  initDashboard();
  initFocusMode();
  initInsights();

  document.getElementById('settings-btn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('start-focus-btn').addEventListener('click', () => document.getElementById('tab-focus').click());
  document.getElementById('view-details-btn').addEventListener('click', () => document.getElementById('tab-insights').click());
  document.getElementById('export-report')?.addEventListener('click', () => {
    console.log("Exporting weekly report...");
    chrome.runtime.sendMessage({ action: 'exportWeeklyReport' });
  });

  // Listen for data updates from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'dataUpdated') {
      console.log("Received dataUpdated message, refreshing dashboard and insights...");
      updateDashboardData();
      if (document.getElementById('insights').classList.contains('active')) {
        loadInsightsData();
      }
    }
  });
});

function initDashboard() {
  updateDashboardData();
  setInterval(updateDashboardData, 10000); // Reduced interval to 10 seconds for faster updates
}

function updateDashboardData() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['dailyStats', 'settings', 'productivityScore'], (data) => {
    console.log("Dashboard data fetched:", data);
    const dailyStats = data.dailyStats || {};
    const settings = data.settings || { dailyScreenTimeGoal: 180 };
    const productivityScore = data.productivityScore || { today: 0 };

    document.getElementById('daily-goal').textContent = settings.dailyScreenTimeGoal;
    const todayStats = dailyStats[today] || { 
      totalTime: 0, 
      sites: {}, 
      categories: { Social: 0, Work: 0, Entertainment: 0, Search: 0, Education: 0, Other: 0 } 
    };
    
    const totalMinutes = Math.round(todayStats.totalTime / 60);
    document.getElementById('today-total-time').textContent = `${totalMinutes} min`;
    const progressPercentage = Math.min((totalMinutes / settings.dailyScreenTimeGoal) * 100, 100);
    document.getElementById('today-progress').style.width = `${progressPercentage}%`;
    document.getElementById('today-progress').style.background = progressPercentage > 75 ? '#fa5252' : '#40c057';
    document.getElementById('prod-score').textContent = Math.round(productivityScore.today);

    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    const categoryColors = { 
      Social: '#ff6b6b', 
      Work: '#4ecdc4', 
      Entertainment: '#45b7d1', 
      Search: '#feca57', 
      Education: '#6ab04c', 
      Other: '#96c93d' 
    };
    
    const categories = Object.entries(todayStats.categories || {}).sort((a, b) => b[1] - a[1]);
    console.log("Today’s raw categories data:", todayStats.categories);

    const hasActivity = categories.some(([_, seconds]) => seconds > 0);
    if (!hasActivity) {
      categoryList.innerHTML = '<div style="text-align: center; color: #6c757d;">No activity yet today.</div>';
    } else {
      categories.forEach(([category, seconds]) => {
        const minutes = Math.round(seconds / 60);
        if (seconds > 0) {
          console.log(`Displaying ${category}: ${seconds} seconds (${minutes} min)`);
          const item = document.createElement('div');
          item.className = 'category-item';
          item.innerHTML = `
            <span><span class="category-color" style="background: ${categoryColors[category] || '#adb5bd'}"></span>${category}</span>
            <span>${minutes} min</span>
          `;
          categoryList.appendChild(item);
        }
      });
      if (categoryList.children.length === 0) {
        categoryList.innerHTML = '<div style="text-align: center; color: #6c757d;">No significant activity yet.</div>';
      }
    }

    const tips = [
      "Take short breaks every hour to boost focus.",
      "Limit social media to 30 minutes daily.",
      "Set specific goals for each browsing session."
    ];
    document.getElementById('daily-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
  });
}

function initFocusMode() {
  const quotes = [
    "Focus turns dreams into achievements.",
    "One step at a time leads to success.",
    "Clarity begins with concentration."
  ];
  chrome.storage.local.get(['activityData', 'focusMode'], (data) => {
    const blockList = document.getElementById('block-sites-list');
    const commonSites = getCommonSites(data.activityData || {});
    blockList.innerHTML = '';
    commonSites.slice(0, 10).forEach(site => {
      const item = document.createElement('div');
      item.className = 'checkbox-item';
      item.innerHTML = `
        <input type="checkbox" id="block-${site}" value="${site}">
        <label for="block-${site}">${site}</label>
      `;
      blockList.appendChild(item);
    });
    updateFocusModeStatus(data.focusMode);
    document.getElementById('motivation-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
  });

  document.getElementById('start-focus-session').addEventListener('click', () => {
    const duration = parseInt(document.getElementById('focus-duration').value, 10);
    if (isNaN(duration) || duration < 5 || duration > 120) {
      alert('Please enter a duration between 5 and 120 minutes.');
      return;
    }
    const blockedSites = Array.from(document.querySelectorAll('#block-sites-list input[type="checkbox"]:checked')).map(cb => cb.value);
    chrome.runtime.sendMessage({ action: 'startFocusMode', duration, blockedSites }, () => {
      updateFocusModeStatus({ active: true, startTime: Date.now(), endTime: Date.now() + duration * 60 * 1000, blockedSites });
    });
  });

  document.getElementById('end-focus-session').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'endFocusMode' }, () => updateFocusModeStatus({ active: false }));
  });

  setInterval(() => chrome.storage.local.get(['focusMode'], (data) => updateFocusModeStatus(data.focusMode)), 1000);
}

function getCommonSites(activityData) {
  const siteCounts = {};
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(now - i * 86400000).toISOString().split('T')[0];
    if (activityData[date]) {
      Object.keys(activityData[date]).forEach(site => {
        siteCounts[site] = (siteCounts[site] || 0) + activityData[date][site];
      });
    }
  }
  return Object.entries(siteCounts).sort((a, b) => b[1] - a[1]).map(([site]) => site);
}

function updateFocusModeStatus(focusMode) {
  const status = document.getElementById('focus-status');
  const startBtn = document.getElementById('start-focus-session');
  const endBtn = document.getElementById('end-focus-session');
  if (focusMode?.active) {
    const timeLeft = Math.max(0, Math.floor((focusMode.endTime - Date.now()) / 1000));
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    status.textContent = `Active: ${minutes}m ${seconds}s left`;
    status.classList.add('active');
    startBtn.disabled = true;
    endBtn.disabled = false;
    document.querySelectorAll('#block-sites-list input, #focus-duration').forEach(el => el.disabled = true);
  } else {
    status.textContent = 'Not active';
    status.classList.remove('active');
    startBtn.disabled = false;
    endBtn.disabled = true;
    document.querySelectorAll('#block-sites-list input, #focus-duration').forEach(el => el.disabled = false);
  }
}

function initInsights() {
  loadInsightsData();
  document.getElementById('insight-type').addEventListener('change', () => {
    console.log("Insight type changed to:", document.getElementById('insight-type').value);
    loadInsightsData();
  });
}

let insightsChart = null;

function loadInsightsData() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['dailyStats', 'weeklyStats'], (data) => {
    console.log("Insights data fetched from storage:", data);
    const dailyStats = data.dailyStats || {};
    const weeklyStats = data.weeklyStats || { sites: {}, categories: {}, totalTime: 0 };
    const todayStats = dailyStats[today] || { sites: {}, categories: {}, totalTime: 0 };
    console.log("Processed dailyStats for today:", todayStats);
    console.log("Processed weeklyStats for rendering:", weeklyStats);
    renderCharts(dailyStats, weeklyStats, todayStats);
  });
}

function renderCharts(dailyStats, weeklyStats, todayStats) {
  if (insightsChart) insightsChart.destroy();
  const canvas = document.getElementById('insights-chart');
  const ctx = canvas.getContext('2d');
  const insightType = document.getElementById('insight-type').value;

  // Clear canvas and add chart title
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#495057';
  ctx.font = '14px Segoe UI';
  ctx.textAlign = 'center';
  let title = '';
  switch (insightType) {
    case 'daily':
      title = 'Daily Trends (Last 7 Days)';
      break;
    case 'categories':
      title = 'Weekly Category Breakdown';
      break;
    case 'sites':
      title = 'Weekly Top Sites';
      break;
    case 'dailyCategories':
      title = 'Daily Category Breakdown';
      break;
    case 'dailySites':
      title = 'Daily Top Sites';
      break;
  }
  ctx.fillText(title, canvas.width / 2, 20);

  console.log("Rendering chart for insight type:", insightType);

  switch (insightType) {
    case 'daily':
      createDailyTrendsChart(ctx, dailyStats);
      break;
    case 'categories':
      createCategoryChart(ctx, weeklyStats);
      break;
    case 'sites':
      createTopSitesChart(ctx, weeklyStats);
      break;
    case 'dailyCategories':
      createDailyCategoryChart(ctx, todayStats);
      break;
    case 'dailySites':
      createDailyTopSitesChart(ctx, todayStats);
      break;
  }
  updateRecommendations(dailyStats);
}

function createDailyTrendsChart(ctx, dailyStats) {
  const dates = [];
  const usageTimes = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    dates.push(new Date(date).toLocaleDateString('en-US', { weekday: 'short' }));
    usageTimes.push(dailyStats[date] ? Math.round(dailyStats[date].totalTime / 60) : 0);
  }
  console.log("Daily Trends data:", { dates, usageTimes });
  if (usageTimes.every(time => time === 0)) {
    ctx.fillStyle = '#6c757d';
    ctx.textAlign = 'center';
    ctx.fillText('No daily data yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  insightsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Screen Time (min)',
        data: usageTimes,
        borderColor: '#339af0',
        backgroundColor: 'rgba(51, 154, 240, 0.1)',
        tension: 0.3
      }]
    }
  });
}

function createCategoryChart(ctx, weeklyStats) {
  const categories = Object.entries(weeklyStats.categories || {})
    .map(([cat, seconds]) => ({ category: cat, minutes: Math.round(seconds / 60) }))
    .filter(item => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  console.log("Categories chart data:", categories);

  if (!categories.length) {
    ctx.fillStyle = '#6c757d';
    ctx.textAlign = 'center';
    ctx.fillText('No category data yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  insightsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(item => item.category),
      datasets: [{
        data: categories.map(item => item.minutes),
        backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#feca57', '#6ab04c', '#96c93d', '#adb5bd']
      }]
    }
  });
}

function createTopSitesChart(ctx, weeklyStats) {
  const topSites = Object.entries(weeklyStats.sites || {})
    .map(([site, seconds]) => ({ site, minutes: Math.round(seconds / 60) }))
    .filter(item => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  console.log("Top Sites chart data:", topSites);

  if (!topSites.length) {
    ctx.fillStyle = '#6c757d';
    ctx.textAlign = 'center';
    ctx.fillText('No site data yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  insightsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topSites.map(item => item.site.length > 15 ? item.site.substring(0, 12) + '...' : item.site),
      datasets: [{
        label: 'Minutes',
        data: topSites.map(item => item.minutes),
        backgroundColor: '#339af0',
        borderColor: '#228be6',
        borderWidth: 1
      }]
    }
  });
}

function createDailyCategoryChart(ctx, todayStats) {
  const categories = Object.entries(todayStats.categories || {})
    .map(([cat, seconds]) => ({ category: cat, minutes: Math.round(seconds / 60) }))
    .filter(item => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  console.log("Daily Categories chart data:", categories);

  if (!categories.length) {
    ctx.fillStyle = '#6c757d';
    ctx.textAlign = 'center';
    ctx.fillText('No daily category data yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  insightsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(item => item.category),
      datasets: [{
        data: categories.map(item => item.minutes),
        backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#feca57', '#6ab04c', '#96c93d', '#adb5bd']
      }]
    }
  });
}

function createDailyTopSitesChart(ctx, todayStats) {
  const topSites = Object.entries(todayStats.sites || {})
    .map(([site, seconds]) => ({ site, minutes: Math.round(seconds / 60) }))
    .filter(item => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  console.log("Daily Top Sites chart data:", topSites);

  if (!topSites.length) {
    ctx.fillStyle = '#6c757d';
    ctx.textAlign = 'center';
    ctx.fillText('No daily site data yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  insightsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topSites.map(item => item.site.length > 15 ? item.site.substring(0, 12) + '...' : item.site),
      datasets: [{
        label: 'Minutes',
        data: topSites.map(item => item.minutes),
        backgroundColor: '#339af0',
        borderColor: '#228be6',
        borderWidth: 1
      }]
    }
  });
}

function updateRecommendations(dailyStats) {
  const list = document.getElementById('recommendations-list');
  list.innerHTML = '';
  if (!Object.keys(dailyStats).length) {
    list.innerHTML = '<li>Track activity for personalized tips.</li>';
    return;
  }
  let totalMinutes = 0;
  Object.values(dailyStats).forEach(day => totalMinutes += Math.round(day.totalTime / 60));
  const avgDaily = totalMinutes / Object.keys(dailyStats).length;
  const recs = [];
  if (avgDaily > 180) recs.push('Reduce screen time by 30 min/day.');
  if (totalMinutes > 1200) recs.push('Consider stricter site limits.');
  recs.slice(0, 3).forEach(rec => list.innerHTML += `<li>${rec}</li>`);
  if (!recs.length) list.innerHTML = '<li>You are doing great!</li>';
}