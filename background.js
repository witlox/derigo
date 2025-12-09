chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentCategorized") {
    console.log(`Content categorized as: ${message.category}`);
  }
});
