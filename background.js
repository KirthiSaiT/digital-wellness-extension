// Category definitions
const siteCategories = {
  'facebook.com': 'Social', 'twitter.com': 'Social', 'instagram.com': 'Social',
  'docs.google.com': 'Work', 'notion.so': 'Work', 'github.com': 'Work',
  'youtube.com': 'Entertainment', 'netflix.com': 'Entertainment',
  'default': 'Other'
};

// Initialize data structure
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    activityData: {},
    dailyStats: {},
    weeklyStats: {},
    settings: {
      dailyScreenTimeGoal: 180,
      focusModeDuration: 25,
      breakDuration: 5,
      breakReminderInterval: 60,
      notificationsEnabled: true,
      privacyLevel: 'standard',
      siteLimits: {}
    },
    focusMode: { active: false, startTime: null, endTime: null, blockedSites: [] },
    productivityScore: { today: 0, weeklyAvg: 0 }
  });

  chrome.alarms.create('dailySummary', { periodInMinutes: 1440 });
  chrome.alarms.create('weeklySummary', { periodInMinutes: 10080 });
  chrome.alarms.create('activityTracker', { periodInMinutes: 1 });
  chrome.alarms.create('breakReminder', { periodInMinutes: 60 });
});

// Active tab tracking
let activeTabId = null;
let activeTabUrl = null;
let activeTabStartTime = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === activeTabId) {
    handleTabChange(tab);
  }
});

function handleTabChange(tab) {
  if (activeTabId && activeTabUrl && activeTabStartTime) {
    recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
  }
  activeTabId = tab.id;
  activeTabUrl = tab.url;
  activeTabStartTime = Date.now();

  chrome.storage.local.get(['focusMode'], (data) => {
    if (data.focusMode?.active) checkFocusMode(tab.url, tab.id);
  });
}
function recordTabActivity(url, duration) {
  if (!url || url.startsWith('chrome://') || duration < 1000) return;

  const domain = extractDomain(url);
  const date = new Date().toISOString().split('T')[0];
  const seconds = Math.round(duration / 1000);
  const category = siteCategories[domain] || siteCategories['default'];

  chrome.storage.local.get(['activityData', 'dailyStats', 'settings', 'productivityScore'], (data) => {
    let activityData = data.activityData || {};
    let dailyStats = data.dailyStats || {};
    const settings = data.settings || {};
    let productivityScore = data.productivityScore || { today: 0, weeklyAvg: 0 };

    // Update activity data (site-specific)
    if (!activityData[date]) activityData[date] = {};
    activityData[date][domain] = (activityData[date][domain] || 0) + seconds;

    // Ensure dailyStats[date] is initialized properly
    if (!dailyStats[date]) {
      dailyStats[date] = { 
        totalTime: 0, 
        sites: {}, 
        categories: { Social: 0, Work: 0, Entertainment: 0, Other: 0 } 
      };
    }

    // Update daily stats
    dailyStats[date].totalTime += seconds;
    dailyStats[date].sites[domain] = (dailyStats[date].sites[domain] || 0) + seconds;
    dailyStats[date].categories[category] = (dailyStats[date].categories[category] || 0) + seconds;

    // Debugging: Log the update to confirm it’s working
    console.log(`Recording ${seconds}s for ${domain} in ${category} on ${date}`, dailyStats[date]);

    checkLimits(settings, dailyStats[date], domain, seconds);
    updateProductivityScore(productivityScore, domain, seconds, date);

    // Save the updated data and ensure it’s synced
    chrome.storage.local.set({ activityData, dailyStats, productivityScore }, () => {
      console.log(`Data saved for ${date}:`, dailyStats[date]);
      chrome.runtime.sendMessage({ action: 'dataUpdated' });
    });
  });
}
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (e) {
    return '';
  }
}

function checkFocusMode(url, tabId) {
  chrome.storage.local.get(['focusMode'], (data) => {
    if (data.focusMode?.active && data.focusMode.blockedSites.includes(extractDomain(url))) {
      chrome.tabs.update(tabId, { url: chrome.runtime.getURL('focus-blocked.html') });
    }
  });
}

function checkLimits(settings, dailyStats, domain, seconds) {
  const minutes = Math.round(dailyStats.totalTime / 60);
  if (settings.dailyScreenTimeGoal && minutes >= settings.dailyScreenTimeGoal && settings.notificationsEnabled) {
    notify('Daily Limit Reached', `You've spent ${minutes} minutes online today.`);
  }

  if (settings.siteLimits?.[domain] && (dailyStats.sites[domain] || 0) / 60 >= settings.siteLimits[domain]) {
    notify('Site Limit', `You've exceeded your limit for ${domain}.`);
  }
}

function updateProductivityScore(score, domain, seconds, date) {
  const today = new Date().toISOString().split('T')[0];
  const productiveSites = ['docs.google.com', 'notion.so', 'github.com'];
  const weight = productiveSites.includes(domain) ? 1 : -0.2;
  const points = weight * (seconds / 60);
  if (date === today) score.today = Math.max(0, Math.min(100, score.today + points));
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title,
    message,
    priority: 2
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailySummary') generateDailySummary();
  else if (alarm.name === 'weeklySummary') generateWeeklySummary();
  else if (alarm.name === 'activityTracker') updateCurrentActivity();
  else if (alarm.name === 'focusModeEnd') endFocusMode();
  else if (alarm.name === 'breakReminder') suggestBreak();
});

function generateDailySummary() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  chrome.storage.local.get(['dailyStats', 'settings'], (data) => {
    const stats = data.dailyStats?.[yesterday];
    if (!stats) return;
    const minutes = Math.round(stats.totalTime / 60);
    const message = `Yesterday: ${minutes} min online.${minutes > data.settings.dailyScreenTimeGoal ? ' Over goal!' : ''}`;
    if (data.settings.notificationsEnabled) notify('Daily Summary', message);
  });
}

function generateWeeklySummary() {
  chrome.storage.local.get(['dailyStats', 'settings'], (data) => {
    const weeklyData = aggregateWeeklyStats(data.dailyStats || {});
    chrome.storage.local.set({ weeklyStats: weeklyData }, () => {
      chrome.runtime.sendMessage({ action: 'dataUpdated' });
    });
    if (data.settings.notificationsEnabled) notify('Weekly Summary', 'Your weekly report is ready!');
  });
}

function aggregateWeeklyStats(dailyStats) {
  const weeklySites = {};
  const weeklyCategories = {};
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  Object.entries(dailyStats).forEach(([date, stats]) => {
    if (date >= sevenDaysAgo) {
      Object.entries(stats.sites || {}).forEach(([site, seconds]) => {
        weeklySites[site] = (weeklySites[site] || 0) + seconds;
      });
      Object.entries(stats.categories || {}).forEach(([cat, seconds]) => {
        weeklyCategories[cat] = (weeklyCategories[cat] || 0) + seconds;
      });
    }
  });
  return {
    sites: weeklySites,
    categories: weeklyCategories,
    totalTime: Object.values(weeklySites).reduce((sum, sec) => sum + sec, 0)
  };
}

function updateCurrentActivity() {
  if (activeTabId && activeTabUrl && activeTabStartTime) {
    recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
    activeTabStartTime = Date.now();
  }
}

function startFocusMode(duration, blockedSites) {
  const startTime = Date.now();
  const endTime = startTime + duration * 60 * 1000;
  chrome.storage.local.set({
    focusMode: { active: true, startTime, endTime, blockedSites }
  });
  chrome.alarms.create('focusModeEnd', { when: endTime });
  notify('Focus Mode', `Started for ${duration} minutes.`);
}

function endFocusMode() {
  chrome.storage.local.set({
    focusMode: { active: false, startTime: null, endTime: null, blockedSites: [] }
  });
  notify('Focus Mode', 'Great job! Focus mode ended.');
}

function suggestBreak() {
  chrome.storage.local.get(['dailyStats', 'settings'], (data) => {
    const today = new Date().toISOString().split('T')[0];
    const minutes = Math.round((data.dailyStats?.[today]?.totalTime || 0) / 60);
    if (minutes >= data.settings.breakReminderInterval && data.settings.notificationsEnabled) {
      notify('Take a Break', 'You have been online for a while. Time for a break?');
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStats') {
    chrome.storage.local.get(['dailyStats', 'weeklyStats', 'productivityScore'], sendResponse);
    return true;
  } else if (message.action === 'getSettings') {
    chrome.storage.local.get(['settings'], (data) => sendResponse(data.settings));
    return true;
  } else if (message.action === 'updateSettings') {
    chrome.storage.local.set({ settings: message.settings }, () => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'startFocusMode') {
    startFocusMode(message.duration, message.blockedSites);
    sendResponse({ success: true });
  } else if (message.action === 'endFocusMode') {
    endFocusMode();
    sendResponse({ success: true });
  } else if (message.action === 'getFocusMode') {
    chrome.storage.local.get(['focusMode'], (data) => sendResponse(data.focusMode));
    return true;
  } else if (message.action === 'exportWeeklyReport') {
    exportWeeklyReport();
    sendResponse({ success: true });
  } else if (message.action === 'updateActivity') {
    if (message.data.isActive && activeTabUrl === message.data.url) {
      activeTabStartTime = message.data.timestamp;
    }
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'updateCurrentActivity') {
    updateCurrentActivity();
    sendResponse({ success: true });
    return true;
  }
  return true;
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    if (activeTabId && activeTabUrl && activeTabStartTime) {
      recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
      activeTabStartTime = null;
    }
  } else if (state === 'active') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) handleTabChange(tabs[0]);
    });
  }
});

function exportWeeklyReport() {
  chrome.storage.local.get(['weeklyStats'], (data) => {
    const weeklyStats = data.weeklyStats || { sites: {}, categories: {} };
    let content = 'Weekly Digital Wellbeing Report\n\n';
    content += `Total Time: ${Math.round(weeklyStats.totalTime / 60)} minutes\n\n`;
    content += 'Top Sites:\n';
    for (const [site, sec] of Object.entries(weeklyStats.sites || {})) {
      content += `  ${site}: ${Math.round(sec / 60)} minutes\n`;
    }
    content += '\nCategories:\n';
    for (const [cat, sec] of Object.entries(weeklyStats.categories || {})) {
      content += `  ${cat}: ${Math.round(sec / 60)} minutes\n`;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: `weekly_report_${new Date().toISOString().split('T')[0]}.txt`
    });
  });
}