chrome.storage.local.get(["autodetect"], function(items) {
  try {
    if (items["autodetect"] === undefined || items["autodetect"] === false) {
      return
    }

    if (document.body.innerText.substring(0, 2) === '{"') {
      chrome.runtime.sendMessage({message: "interpret"})
    }
  } catch (err) {
    console.error(err)
  }
})
