chrome.storage.local.get(["autodetect"], function(items) {
  try {
    if (items["autodetect"] === undefined || items["autodetect"] === false) {
      return
    }

    if (document.body.innerText[0] === "{" && document.body.innerText[1] === '"') {
      chrome.runtime.sendMessage({message: "interpret"})
    }
  } catch (err) {
    console.error(err)
  }
})