// Initialize when the content script is injected
let lastActiveTime = Date.now();
let isActive = true;

// Track user activity on the page
document.addEventListener('mousemove', updateActivity);
document.addEventListener('keydown', updateActivity);
document.addEventListener('scroll', updateActivity);
document.addEventListener('click', updateActivity);

// Update active state when tab visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateActivity();
  } else {
    isActive = false;
    notifyBackgroundScript();
  }
});

// Function to update activity timestamp
function updateActivity() {
  lastActiveTime = Date.now();
  if (!isActive) {
    isActive = true;
    notifyBackgroundScript();
  }
}

// Send periodic updates to background script
setInterval(notifyBackgroundScript, 5000); // Every 5 seconds

// Notify background script about activity state
function notifyBackgroundScript() {
  const inactiveThreshold = 60000; // 1 minute
  const currentlyActive = (Date.now() - lastActiveTime) < inactiveThreshold;
  
  if (isActive !== currentlyActive) {
    isActive = currentlyActive;
  }
  
  chrome.runtime.sendMessage({
    action: 'updateActivity',
    data: {
      isActive: isActive,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now()
    }
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkActive') {
    sendResponse({
      isActive: isActive,
      lastActiveTime: lastActiveTime
    });
    return true;
  }
});