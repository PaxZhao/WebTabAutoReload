// background.js
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
  });
  
  // Function to update badge
  async function updateBadge(tabId, isOn) {
    if (isOn) {
      await chrome.action.setBadgeText({ text: "ON", tabId });
      await chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId });
    } else {
      await chrome.action.setBadgeText({ text: "", tabId });
    }
  }
  
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      // Check current state from storage
      const data = await chrome.storage.local.get(tab.id.toString());
      const isRefreshing = data[tab.id.toString()];
  
      if (isRefreshing) {
        // Stop refreshing
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            // Clear all intervals
            const highestId = window.setTimeout(() => {}, 0);
            for (let i = 0; i < highestId; i++) {
              window.clearInterval(i);
            }
            localStorage.removeItem('refreshInterval');
          }
        });
        
        // Remove from storage and update badge
        await chrome.storage.local.remove(tab.id.toString());
        await updateBadge(tab.id, false);
      } else {
        // Start refreshing
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            const interval = prompt("Enter refresh interval in seconds:", "5");
            if (interval !== null && !isNaN(interval)) {
              const milliseconds = parseInt(interval) * 1000;
              localStorage.setItem('refreshInterval', milliseconds.toString());
              setInterval(() => {
                location.reload();
              }, milliseconds);
              return { success: true, interval: milliseconds };
            }
            return { success: false };
          }
        });
  
        if (result[0].result.success) {
          // Save to storage and update badge
          await chrome.storage.local.set({ [tab.id.toString()]: true });
          await updateBadge(tab.id, true);
        }
      }
    } catch (err) {
      console.error('Error:', err);
    }
  });
  
  // Handle tab updates (restore refresh if active)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      // Check if this tab should be refreshing
      const data = await chrome.storage.local.get(tabId.toString());
      const isRefreshing = data[tabId.toString()];
  
      if (isRefreshing) {
        // Restore badge
        await updateBadge(tabId, true);
  
        // Restore refresh interval
        await chrome.scripting.executeScript({
          target: { tabId },
          function: () => {
            const interval = parseInt(localStorage.getItem('refreshInterval'));
            if (interval) {
              setInterval(() => {
                location.reload();
              }, interval);
            }
          }
        });
      }
    }
  });
  
  // Clean up when a tab is closed
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await chrome.storage.local.remove(tabId.toString());
  });