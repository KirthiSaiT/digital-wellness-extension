document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
  
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetBtn').addEventListener('click', resetSettings);
    document.getElementById('clearDataBtn').addEventListener('click', clearData);
    document.getElementById('addSiteLimit').addEventListener('click', addSiteLimit);
  });
  
  function loadSettings() {
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || {};
      document.getElementById('dailyScreenTimeGoal').value = settings.dailyScreenTimeGoal || 180;
      document.getElementById('focusModeDuration').value = settings.focusModeDuration || 25;
      document.getElementById('breakDuration').value = settings.breakDuration || 5;
      document.getElementById('breakReminderInterval').value = settings.breakReminderInterval || 60;
      document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled !== false;
      document.getElementById('privacyLevel').value = settings.privacyLevel || 'standard';
      updateSiteLimitsList(settings.siteLimits || {});
    });
  }
  
  function saveSettings() {
    const settings = {
      dailyScreenTimeGoal: parseInt(document.getElementById('dailyScreenTimeGoal').value),
      focusModeDuration: parseInt(document.getElementById('focusModeDuration').value),
      breakDuration: parseInt(document.getElementById('breakDuration').value),
      breakReminderInterval: parseInt(document.getElementById('breakReminderInterval').value),
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      privacyLevel: document.getElementById('privacyLevel').value,
      siteLimits: getSiteLimits()
    };
    chrome.storage.local.set({ settings }, () => {
      const status = document.getElementById('saveStatus');
      status.textContent = 'Settings saved!';
      status.className = 'save-status success';
      setTimeout(() => status.className = 'save-status', 2000);
    });
  }
  
  function resetSettings() {
    chrome.storage.local.set({
      settings: {
        dailyScreenTimeGoal: 180,
        focusModeDuration: 25,
        breakDuration: 5,
        breakReminderInterval: 60,
        notificationsEnabled: true,
        privacyLevel: 'standard',
        siteLimits: {}
      }
    }, loadSettings);
  }
  
  function clearData() {
    if (confirm('Are you sure you want to clear all data?')) {
      chrome.storage.local.set({
        activityData: {},
        dailyStats: {},
        weeklyStats: {},
        productivityScore: { today: 0, weeklyAvg: 0 }
      });
      const status = document.getElementById('saveStatus');
      status.textContent = 'Data cleared!';
      status.className = 'save-status success';
      setTimeout(() => status.className = 'save-status', 2000);
    }
  }
  
  function addSiteLimit() {
    const site = document.getElementById('siteLimitInput').value.trim();
    const limit = parseInt(document.getElementById('siteLimitValue').value);
    if (!site || isNaN(limit) || limit < 0) {
      alert('Please enter a valid site and limit.');
      return;
    }
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || {};
      settings.siteLimits = settings.siteLimits || {};
      settings.siteLimits[site] = limit;
      chrome.storage.local.set({ settings }, () => {
        updateSiteLimitsList(settings.siteLimits);
        document.getElementById('siteLimitInput').value = '';
        document.getElementById('siteLimitValue').value = '';
      });
    });
  }
  
  function updateSiteLimitsList(siteLimits) {
    const list = document.getElementById('siteLimitsList');
    list.innerHTML = '';
    Object.entries(siteLimits).forEach(([site, limit]) => {
      const item = document.createElement('div');
      item.className = 'site-limit-item';
      item.innerHTML = `
        ${site}: ${limit} min
        <button class="remove-btn" data-site="${site}">Remove</button>
      `;
      list.appendChild(item);
      item.querySelector('.remove-btn').addEventListener('click', () => removeSiteLimit(site));
    });
  }
  
  function removeSiteLimit(site) {
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || {};
      delete settings.siteLimits[site];
      chrome.storage.local.set({ settings }, () => updateSiteLimitsList(settings.siteLimits));
    });
  }
  
  function getSiteLimits() {
    const list = document.getElementById('siteLimitsList');
    const siteLimits = {};
    list.querySelectorAll('.site-limit-item').forEach(item => {
      const [site, limitText] = item.textContent.split(':');
      const limit = parseInt(limitText);
      siteLimits[site.trim()] = limit;
    });
    return siteLimits;
  }