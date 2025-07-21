// Background service worker for Manifest V3

function runInterpreter(tabId, autoParse) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(autoParse) {
      window.autoParse = autoParse;
    },
    args: [autoParse]
  }).then(() => {
    chrome.action.disable(tabId);
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["XRegExp.js"]
    });
  }).then(() => {
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["interpreter.js"]
    });
  }).catch((error) => {
    console.error('Script injection failed:', error);
    chrome.action.enable(tabId);
  });
}

// Message listener
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message === "interpret") {
      runInterpreter(sender.tab.id, true);
    }
    if (request.message === "done") {
      chrome.action.enable(sender.tab.id);
    }
  }
);

// Browser action click handler
chrome.action.onClicked.addListener(function(tab) {
  var tabId = tab.id;
  // Reset showoriginal before running the interpreter
  chrome.storage.local.set({ "showoriginal": false }, function() {
    runInterpreter(tabId, false);
  });
});