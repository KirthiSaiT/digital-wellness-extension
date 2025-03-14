// Constants
const CATEGORIES = {
    SOCIAL: ['facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'linkedin.com'],
    PRODUCTIVITY: ['docs.google.com', 'notion.so', 'trello.com', 'asana.com', 'slack.com', 'github.com'],
    ENTERTAINMENT: ['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv', 'reddit.com'],
    NEWS: ['nytimes.com', 'cnn.com', 'bbc.com', 'reuters.com', 'apnews.com'],
    SHOPPING: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com']
  };
  
  // Initialize data structure
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
      activityData: {},
      dailyStats: {},
      weeklyStats: {},
      settings: {
        dailyScreenTimeGoal: 240, // 4 hours in minutes
        focusModeDuration: 25, // 25 minutes
        breakDuration: 5, // 5 minutes
        notificationsEnabled: true,
        privacyLevel: 'standard', // 'minimal', 'standard', 'detailed'
        categoriesLimit: {
          SOCIAL: 60, // minutes
          ENTERTAINMENT: 90 // minutes
        }
      },
      focusMode: {
        active: false,
        startTime: null,
        endTime: null,
        blockedSites: []
      }
    });
    
    // Create alarms for daily and weekly summaries
    chrome.alarms.create('dailySummary', { periodInMinutes: 1440 }); // 24 hours
    chrome.alarms.create('weeklySummary', { periodInMinutes: 10080 }); // 7 days
    chrome.alarms.create('activityTracker', { periodInMinutes: 1 }); // Check every minute
  });
  
  // Active tab tracking
  let activeTabId = null;
  let activeTabUrl = null;
  let activeTabStartTime = null;
  
  // Track active tab changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      handleTabChange(tab);
    } catch (error) {
      console.error("Error getting tab information:", error);
    }
  });
  
  // Track tab URL changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tabId === activeTabId) {
      handleTabChange(tab);
    }
  });
  
  // Handle tab changes
  function handleTabChange(tab) {
    // If there was an active tab, record its time
    if (activeTabId && activeTabUrl && activeTabStartTime) {
      recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
    }
    
    // Update active tab information
    activeTabId = tab.id;
    activeTabUrl = tab.url;
    activeTabStartTime = Date.now();
    
    // Check if focus mode is active and if site should be blocked
    chrome.storage.local.get(['focusMode'], (data) => {
      if (data.focusMode && data.focusMode.active) {
        checkFocusMode(tab.url, tab.id);
      }
    });
  }
  
  // Record tab activity
  function recordTabActivity(url, duration) {
    if (!url || url === 'chrome://newtab/' || duration < 1000) return;
    
    const domain = extractDomain(url);
    const category = categorizeUrl(domain);
    const date = new Date().toISOString().split('T')[0];
    
    chrome.storage.local.get(['activityData', 'dailyStats', 'settings'], (data) => {
      // Update activity data
      const activityData = data.activityData || {};
      if (!activityData[date]) activityData[date] = {};
      if (!activityData[date][domain]) activityData[date][domain] = 0;
      activityData[date][domain] += Math.round(duration / 1000);
      
      // Update daily stats
      const dailyStats = data.dailyStats || {};
      if (!dailyStats[date]) {
        dailyStats[date] = {
          totalTime: 0,
          categories: {}
        };
      }
      dailyStats[date].totalTime += Math.round(duration / 1000);
      
      if (!dailyStats[date].categories[category]) {
        dailyStats[date].categories[category] = 0;
      }
      dailyStats[date].categories[category] += Math.round(duration / 1000);
      
      // Check if any category limits are exceeded
      const settings = data.settings || {};
      if (settings.categoriesLimit && settings.categoriesLimit[category]) {
        const categoryTimeInMinutes = Math.round(dailyStats[date].categories[category] / 60);
        if (categoryTimeInMinutes >= settings.categoriesLimit[category] && settings.notificationsEnabled) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Category Limit Reached',
            message: `You've spent ${categoryTimeInMinutes} minutes on ${category.toLowerCase()} sites today, which exceeds your goal.`,
            priority: 2
          });
        }
      }
      
      // Save updated data
      chrome.storage.local.set({ activityData, dailyStats });
    });
  }
  
  // Extract domain from URL
  function extractDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch (e) {
      return '';
    }
  }
  
  // Categorize URL
  function categorizeUrl(domain) {
    for (const [category, domains] of Object.entries(CATEGORIES)) {
      if (domains.some(d => domain.includes(d))) {
        return category;
      }
    }
    return 'OTHER';
  }
  
  // Check focus mode
  function checkFocusMode(url, tabId) {
    chrome.storage.local.get(['focusMode'], (data) => {
      if (!data.focusMode || !data.focusMode.active) return;
      
      const domain = extractDomain(url);
      if (data.focusMode.blockedSites.includes(domain)) {
        chrome.tabs.update(tabId, { url: 'focus-blocked.html' });
      }
    });
  }
  
  // Alarm handler
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailySummary') {
      generateDailySummary();
    } else if (alarm.name === 'weeklySummary') {
      generateWeeklySummary();
    } else if (alarm.name === 'activityTracker') {
      updateCurrentActivity();
    } else if (alarm.name === 'focusModeEnd') {
      endFocusMode();
    }
  });
  
  // Generate daily summary
  function generateDailySummary() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];
    
    chrome.storage.local.get(['dailyStats', 'settings'], (data) => {
      if (!data.dailyStats || !data.dailyStats[date]) return;
      
      const stats = data.dailyStats[date];
      const totalTimeInMinutes = Math.round(stats.totalTime / 60);
      const settings = data.settings || {};
      
      let message = `Yesterday, you spent ${totalTimeInMinutes} minutes online.`;
      
      if (settings.dailyScreenTimeGoal && totalTimeInMinutes > settings.dailyScreenTimeGoal) {
        message += ` This exceeds your daily goal of ${settings.dailyScreenTimeGoal} minutes.`;
      }
      
      if (settings.notificationsEnabled) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'Daily Digital Wellbeing Summary',
          message: message,
          priority: 2
        });
      }
    });
  }
  
  // Generate weekly summary
  function generateWeeklySummary() {
    const today = new Date();
    const weeklyStats = {};
    
    chrome.storage.local.get(['dailyStats'], (data) => {
      if (!data.dailyStats) return;
      
      // Calculate weekly stats
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (data.dailyStats[dateStr]) {
          weeklyStats[dateStr] = data.dailyStats[dateStr];
        }
      }
      
      // Save weekly stats
      chrome.storage.local.set({ weeklyStats });
      
      // Show notification
      chrome.storage.local.get(['settings'], (settingsData) => {
        if (settingsData.settings && settingsData.settings.notificationsEnabled) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Weekly Digital Wellbeing Summary',
            message: 'Your weekly usage summary is ready. Click to view detailed insights.',
            priority: 2
          });
        }
      });
    });
  }
  
  // Update current activity
  function updateCurrentActivity() {
    if (activeTabId && activeTabUrl && activeTabStartTime) {
      recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
      activeTabStartTime = Date.now();
    }
  }
  
  // Start focus mode
  function startFocusMode(duration, blockedSites) {
    const startTime = Date.now();
    const endTime = startTime + (duration * 60 * 1000);
    
    chrome.storage.local.set({
      focusMode: {
        active: true,
        startTime,
        endTime,
        blockedSites
      }
    });
    
    chrome.alarms.create('focusModeEnd', { when: endTime });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'Focus Mode Started',
      message: `Focus mode activated for ${duration} minutes. Stay focused!`,
      priority: 2
    });
  }
  
  // End focus mode
  function endFocusMode() {
    chrome.storage.local.set({
      focusMode: {
        active: false,
        startTime: null,
        endTime: null,
        blockedSites: []
      }
    });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'Focus Mode Ended',
      message: 'Great job! Focus mode has ended.',
      priority: 2
    });
  }
  
  // Listen for messages from popup or content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStats') {
      chrome.storage.local.get(['dailyStats', 'weeklyStats'], (data) => {
        sendResponse(data);
      });
      return true;
    } else if (message.action === 'getSettings') {
      chrome.storage.local.get(['settings'], (data) => {
        sendResponse(data.settings);
      });
      return true;
    } else if (message.action === 'updateSettings') {
      chrome.storage.local.set({ settings: message.settings }, () => {
        sendResponse({ success: true });
      });
      return true;
    } else if (message.action === 'startFocusMode') {
      startFocusMode(message.duration, message.blockedSites);
      sendResponse({ success: true });
      return true;
    } else if (message.action === 'endFocusMode') {
      endFocusMode();
      sendResponse({ success: true });
      return true;
    } else if (message.action === 'getFocusMode') {
      chrome.storage.local.get(['focusMode'], (data) => {
        sendResponse(data.focusMode);
      });
      return true;
    }
  });
  
  // Handle idle state changes
  chrome.idle.onStateChanged.addListener((state) => {
    if (state === 'idle' || state === 'locked') {
      if (activeTabId && activeTabUrl && activeTabStartTime) {
        recordTabActivity(activeTabUrl, Date.now() - activeTabStartTime);
        activeTabStartTime = null;
      }
    } else if (state === 'active') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          handleTabChange(tabs[0]);
        }
      });
    }
  });