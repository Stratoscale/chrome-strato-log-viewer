chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message === "interpret") {
      runInterpreter(sender.tab.id, true)
    }
    if (request.message === "done") {
      chrome.browserAction.enable(sender.tab.id)
    }
  }
)