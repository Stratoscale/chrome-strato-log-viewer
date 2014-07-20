chrome.browserAction.onClicked.addListener(function(tab) {
  var tabId = tab.id
  // Reset showoriginal before running the interpreter
  chrome.storage.local.set({ "showoriginal": false }, function() {
    runInterpreter(tabId, false)
  })
})