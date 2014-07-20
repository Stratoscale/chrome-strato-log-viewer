function runInterpreter(tabId, autoParse) {
  chrome.tabs.executeScript(tabId, {code: "var autoParse=" + autoParse.toString() + ";"}, function(){
    chrome.browserAction.disable(tabId)
    chrome.tabs.executeScript(tabId, {file: "interpreter.js"})
  })
}