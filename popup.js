document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(button.id.replace('tab-', '')).classList.add('active');
        
        if (button.id === 'tab-insights') {
          loadInsightsData();
        }
      });
    });
    
    initDashboard();
    initFocusMode();
    initInsights();
    
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    document.getElementById('start-focus-btn').addEventListener('click', () => {
      document.getElementById('tab-focus').click();
    });
    
    document.getElementById('view-details-btn').addEventListener('click', () => {
      document.getElementById('tab-insights').click();
    });
});

function initDashboard() {
    updateDashboardData();
    setInterval(updateDashboardData, 60000);
}

function updateDashboardData() {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['dailyStats', 'settings'], (data) => {
      const dailyStats = data.dailyStats || {};
      const settings = data.settings || { dailyScreenTimeGoal: 240 };
      
      document.getElementById('daily-goal').textContent = settings.dailyScreenTimeGoal;
      const todayStats = dailyStats[today] || { totalTime: 0, categories: {} };
      const totalMinutes = Math.round(todayStats.totalTime / 60);
      document.getElementById('today-total-time').textContent = `${totalMinutes} minutes`;
      
      const progressPercentage = Math.min((totalMinutes / settings.dailyScreenTimeGoal) * 100, 100);
      document.getElementById('today-progress').style.width = `${progressPercentage}%`;
      document.getElementById('today-progress').style.background = progressPercentage > 75 ? '#e74c3c' : '#2ecc71';
      
      const categoryList = document.getElementById('category-list');
      categoryList.innerHTML = '';
      
      const categoryColors = {
        SOCIAL: '#3498db',
        PRODUCTIVITY: '#2ecc71',
        ENTERTAINMENT: '#e74c3c',
        NEWS: '#f39c12',
        SHOPPING: '#9b59b6',
        OTHER: '#95a5a6'
      };
      
      const categories = Object.entries(todayStats.categories || {});
      categories.sort((a, b) => b[1] - a[1]);
      
      categories.slice(0, 5).forEach(([category, seconds]) => {
        const minutes = Math.round(seconds / 60);
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.innerHTML = `
          <div class="category-name">
            <div class="category-color" style="background-color: ${categoryColors[category] || categoryColors.OTHER}"></div>
            ${category}
          </div>
          <div class="category-time">${minutes} min</div>
        `;
        categoryList.appendChild(categoryItem);
      });
      
      if (categories.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.textContent = 'No activity recorded yet today.';
        emptyItem.style.color = '#95a5a6';
        emptyItem.style.textAlign = 'center';
        emptyItem.style.padding = '12px 0';
        categoryList.appendChild(emptyItem);
      }
    });
}

function initFocusMode() {
    chrome.storage.local.get(['activityData', 'focusMode'], (data) => {
      const blockList = document.getElementById('block-sites-list');
      const commonSites = getCommonSites(data.activityData || {});
      blockList.innerHTML = '';
      
      const distractingSites = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'reddit.com'];
      const topSites = [...new Set([...distractingSites, ...commonSites])].slice(0, 10);
      
      topSites.forEach(site => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.innerHTML = `
          <input type="checkbox" id="block-${site}" value="${site}">
          <label for="block-${site}">${site}</label>
        `;
        blockList.appendChild(checkboxItem);
      });
      
      updateFocusModeStatus(data.focusMode);
    });
    
    document.getElementById('start-focus-session').addEventListener('click', () => {
      const duration = parseInt(document.getElementById('focus-duration').value, 10);
      if (isNaN(duration) || duration < 5 || duration > 120) {
        alert('Please enter a valid duration between 5 and 120 minutes.');
        return;
      }
      
      const blockedSites = [];
      document.querySelectorAll('#block-sites-list input[type="checkbox"]:checked').forEach(checkbox => {
        blockedSites.push(checkbox.value);
      });
      
      chrome.runtime.sendMessage({
        action: 'startFocusMode',
        duration: duration,
        blockedSites: blockedSites
      }, () => {
        updateFocusModeStatus({
          active: true,
          startTime: Date.now(),
          endTime: Date.now() + (duration * 60 * 1000),
          blockedSites: blockedSites
        });
      });
    });
    
    document.getElementById('end-focus-session').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'endFocusMode' }, () => {
        updateFocusModeStatus({ active: false });
      });
    });
    
    setInterval(() => {
      chrome.storage.local.get(['focusMode'], (data) => {
        updateFocusModeStatus(data.focusMode);
      });
    }, 1000);
}

function getCommonSites(activityData) {
    const siteCounts = {};
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (activityData[dateStr]) {
        Object.keys(activityData[dateStr]).forEach(site => {
          siteCounts[site] = (siteCounts[site] || 0) + activityData[dateStr][site];
        });
      }
    }
    return Object.entries(siteCounts).sort((a, b) => b[1] - a[1]).map(([site]) => site);
}

function updateFocusModeStatus(focusMode) {
    const focusStatus = document.getElementById('focus-status');
    const startButton = document.getElementById('start-focus-session');
    const endButton = document.getElementById('end-focus-session');
    
    if (focusMode && focusMode.active) {
      const now = Date.now();
      const endTime = focusMode.endTime;
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      focusStatus.textContent = `Active: ${minutes}m ${seconds}s remaining`;
      focusStatus.classList.add('active');
      startButton.disabled = true;
      endButton.disabled = false;
      document.querySelectorAll('#block-sites-list input').forEach(checkbox => {
        checkbox.disabled = true;
        if (focusMode.blockedSites.includes(checkbox.value)) {
          checkbox.checked = true;
        }
      });
      document.getElementById('focus-duration').disabled = true;
    } else {
      focusStatus.textContent = 'Not active';
      focusStatus.classList.remove('active');
      startButton.disabled = false;
      endButton.disabled = true;
      document.querySelectorAll('#block-sites-list input').forEach(checkbox => {
        checkbox.disabled = false;
      });
      document.getElementById('focus-duration').disabled = false;
    }
}

function initInsights() {
    loadInsightsData();
    document.getElementById('insight-type').addEventListener('change', loadInsightsData);
}

let insightsChart = null;

function loadInsightsData() {
    console.log("Loading insights data...");
    chrome.storage.local.get(['dailyStats', 'weeklyStats', 'activityData'], (data) => {
      let dailyStats = data.dailyStats || {};
      let weeklyStats = data.weeklyStats || {};
      
      if (Object.keys(dailyStats).length === 0) {
        const sampleData = generateSampleData();
        dailyStats = sampleData.dailyStats;
        weeklyStats = sampleData.weeklyStats;
      }
      
      const insightType = document.getElementById('insight-type').value;
      if (insightsChart) {
        insightsChart.destroy();
      }
      
      const canvas = document.getElementById('insights-chart');
      if (!canvas) {
        console.error("Chart canvas not found!");
        return;
      }
      
      try {
        switch (insightType) {
          case 'daily':
            createDailyTrendsChart(dailyStats);
            break;
          case 'category':
            createCategoryBreakdownChart(dailyStats);
            break;
          case 'sites':
            createTopSitesChart(weeklyStats);
            break;
        }
        updateRecommendations(dailyStats);
      } catch (error) {
        console.error("Error creating chart:", error);
      }
    });
}

function generateSampleData() {
    const dailyStats = {};
    const weeklyStats = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const totalTime = Math.floor(Math.random() * 14400) + 7200;
      const socialTime = Math.floor(totalTime * (Math.random() * 0.3 + 0.1));
      const productivityTime = Math.floor(totalTime * (Math.random() * 0.3 + 0.1));
      const entertainmentTime = Math.floor(totalTime * (Math.random() * 0.3 + 0.1));
      const newsTime = Math.floor(totalTime * (Math.random() * 0.2 + 0.05));
      const shoppingTime = Math.floor(totalTime * (Math.random() * 0.1));
      const otherTime = totalTime - socialTime - productivityTime - entertainmentTime - newsTime - shoppingTime;
      
      dailyStats[dateStr] = {
        totalTime: totalTime,
        categories: {
          SOCIAL: socialTime,
          PRODUCTIVITY: productivityTime,
          ENTERTAINMENT: entertainmentTime,
          NEWS: newsTime,
          SHOPPING: shoppingTime,
          OTHER: otherTime
        }
      };
      
      weeklyStats[dateStr] = {
        'facebook.com': socialTime * 0.4,
        'twitter.com': socialTime * 0.3,
        'instagram.com': socialTime * 0.3,
        'gmail.com': productivityTime * 0.3,
        'docs.google.com': productivityTime * 0.3,
        'github.com': productivityTime * 0.4,
        'youtube.com': entertainmentTime * 0.6,
        'netflix.com': entertainmentTime * 0.4,
        'nytimes.com': newsTime * 0.5,
        'bbc.com': newsTime * 0.5,
        'amazon.com': shoppingTime * 0.7,
        'ebay.com': shoppingTime * 0.3
      };
    }
    return { dailyStats, weeklyStats };
}

function createDailyTrendsChart(dailyStats) {
    const ctx = document.getElementById('insights-chart').getContext('2d');
    const dates = [];
    const usageTimes = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      usageTimes.push(dailyStats[dateStr] ? Math.round(dailyStats[dateStr].totalTime / 60) : 0);
    }
    
    insightsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Screen Time (minutes)',
          data: usageTimes,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#3498db',
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: value => `${value}m` },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2c3e50',
            titleFont: { size: 14 },
            bodyFont: { size: 12 },
            callbacks: {
              label: context => `${context.parsed.y} minutes on ${context.label}`
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        }
      }
    });
}

function createCategoryBreakdownChart(dailyStats) {
    const ctx = document.getElementById('insights-chart').getContext('2d');
    const categoryTotals = {};
    Object.values(dailyStats).forEach(day => {
      if (day.categories) {
        Object.entries(day.categories).forEach(([cat, sec]) => {
          categoryTotals[cat] = (categoryTotals[cat] || 0) + sec;
        });
      }
    });
    
    const sortedCategories = Object.entries(categoryTotals)
      .map(([cat, sec]) => ({ category: cat, minutes: Math.round(sec / 60) }))
      .sort((a, b) => b.minutes - a.minutes);
    
    insightsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sortedCategories.map(item => item.category),
        datasets: [{
          data: sortedCategories.map(item => item.minutes),
          backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#95a5a6'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 12 },
              color: '#2c3e50'
            }
          },
          tooltip: {
            backgroundColor: '#2c3e50',
            titleFont: { size: 14 },
            bodyFont: { size: 12 },
            callbacks: {
              label: context => `${context.label}: ${context.raw} minutes`
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        }
      }
    });
}

function createTopSitesChart(weeklyStats) {
    const ctx = document.getElementById('insights-chart').getContext('2d');
    const combinedData = {};
    Object.values(weeklyStats).forEach(day => {
      Object.entries(day).forEach(([site, sec]) => {
        combinedData[site] = (combinedData[site] || 0) + (typeof sec === 'number' ? sec : 0);
      });
    });
    
    const topSites = Object.entries(combinedData)
      .map(([site, sec]) => ({ site, minutes: Math.round(sec / 60) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);
    
    insightsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topSites.map(item => item.site.length > 20 ? item.site.substring(0, 17) + '...' : item.site),
        datasets: [{
          label: 'Minutes',
          data: topSites.map(item => item.minutes),
          backgroundColor: 'rgba(52, 152, 219, 0.7)',
          borderColor: '#2980b9',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: value => `${value}m` },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2c3e50',
            titleFont: { size: 14 },
            bodyFont: { size: 12 },
            callbacks: {
              label: context => `${context.label}: ${context.parsed.y} minutes`
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        }
      }
    });
}

function updateRecommendations(dailyStats) {
    const recommendationsList = document.getElementById('recommendations-list');
    recommendationsList.innerHTML = '';
    
    if (!dailyStats || Object.keys(dailyStats).length === 0) {
      const li = document.createElement('li');
      li.textContent = "Use the extension for a few days to receive personalized recommendations.";
      recommendationsList.appendChild(li);
      return;
    }
  
    let totalMinutes = 0;
    let categoryTotals = {};
    Object.values(dailyStats).forEach(dayData => {
      Object.entries(dayData.categories || {}).forEach(([category, seconds]) => {
        categoryTotals[category] = (categoryTotals[category] || 0) + seconds;
        totalMinutes += Math.round(seconds / 60);
      });
    });
  
    if (Object.keys(categoryTotals).length === 0) {
      const li = document.createElement('li');
      li.textContent = "No data available yet. Keep using the extension for better insights!";
      recommendationsList.appendChild(li);
      return;
    }
  
    const recommendations = [];
    if (totalMinutes > 240) {
      recommendations.push('Your total screen time is quite high. Consider taking more breaks or setting app usage limits.');
    }
    if (categoryTotals['SOCIAL'] && categoryTotals['SOCIAL'] > 120 * 60) {
      recommendations.push('You have spent over 2 hours on social media. Try setting time limits to improve productivity.');
    }
    if (categoryTotals['ENTERTAINMENT'] > categoryTotals['PRODUCTIVITY']) {
      recommendations.push('Consider shifting focus to productive tasks instead of entertainment.');
    }
  
    recommendations.slice(0, 3).forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      recommendationsList.appendChild(li);
    });
  
    if (recommendations.length === 0) {
      const li = document.createElement('li');
      li.textContent = "You're doing great! Keep maintaining a balanced digital lifestyle.";
      recommendationsList.appendChild(li);
    }
}