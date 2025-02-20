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

// Function to send notification
async function sendNotification(title, message) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png', // Make sure to add an icon file to your extension
    title: title,
    message: message
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const data = await chrome.storage.local.get(tab.id.toString());
    const isRefreshing = data[tab.id.toString()];

    if (isRefreshing) {
      // Stop refreshing
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const highestId = window.setTimeout(() => {}, 0);
          for (let i = 0; i < highestId; i++) {
            window.clearInterval(i);
          }
          localStorage.removeItem('refreshInterval');
          localStorage.removeItem('previousTaskCount');
        }
      });
      
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
            
            // Store initial count of tasking elements
            const initialTaskCount = document.getElementsByClassName('tasking').length;
            localStorage.setItem('previousTaskCount', initialTaskCount.toString());
            localStorage.setItem('refreshInterval', milliseconds.toString());

            // Function to check for new tasks
            function checkForNewTasks() {
              const previousCount = parseInt(localStorage.getItem('previousTaskCount') || '0');
              const currentCount = document.getElementsByClassName('tasking').length;
              
              if (currentCount > previousCount) {
                // Return information about new tasks
                const newTasks = Array.from(document.getElementsByClassName('tasking'))
                  .slice(previousCount)
                  .map(el => el.textContent.trim());
                
                localStorage.setItem('previousTaskCount', currentCount.toString());
                return {
                  hasNew: true,
                  count: currentCount - previousCount,
                  tasks: newTasks
                };
              }
              return { hasNew: false };
            }

            // Set up refresh interval with task checking
            setInterval(() => {
              const taskCheck = checkForNewTasks();
              if (taskCheck.hasNew) {
                // Send message to background script
                chrome.runtime.sendMessage({
                  type: 'NEW_TASKS',
                  data: taskCheck
                });
              }
              location.reload();
            }, milliseconds);

            return { success: true, interval: milliseconds };
          }
          return { success: false };
        }
      });

      if (result[0].result.success) {
        await chrome.storage.local.set({ [tab.id.toString()]: true });
        await updateBadge(tab.id, true);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === 'NEW_TASKS') {
    const title = 'New Tasks Found!';
    const content = `Found ${message.data.count} new task(s)!\n${message.data.tasks.join('\n')}`;
    await sendNotification(title, content);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const data = await chrome.storage.local.get(tabId.toString());
    const isRefreshing = data[tabId.toString()];

    if (isRefreshing) {
      await updateBadge(tabId, true);

      await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          const interval = parseInt(localStorage.getItem('refreshInterval'));
          if (interval) {
            // Restore task checking functionality
            function checkForNewTasks() {
              const previousCount = parseInt(localStorage.getItem('previousTaskCount') || '0');
              const currentCount = document.getElementsByClassName('tasking').length;
              
              if (currentCount > previousCount) {
                const newTasks = Array.from(document.getElementsByClassName('tasking'))
                  .slice(previousCount)
                  .map(el => el.textContent.trim());
                
                localStorage.setItem('previousTaskCount', currentCount.toString());
                return {
                  hasNew: true,
                  count: currentCount - previousCount,
                  tasks: newTasks
                };
              }
              return { hasNew: false };
            }

            setInterval(() => {
              const taskCheck = checkForNewTasks();
              if (taskCheck.hasNew) {
                chrome.runtime.sendMessage({
                  type: 'NEW_TASKS',
                  data: taskCheck
                });
              }
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