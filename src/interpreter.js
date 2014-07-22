var LOG_LEVELS = {
  "DEBUG"    : { "show": true },
  "INFO"     : { "show": true },
  "WARNING"  : { "show": true },
  "ERROR"    : { "show": true },
  "CRITICAL" : { "show": true },
  "PROGRESS" : { "show": true },
  "SUCCESS"  : { "show": true },
}
var MAX_LEVEL_WIDTH = 0
Object.keys(LOG_LEVELS).forEach(function(level) {
  MAX_LEVEL_WIDTH = Math.max(MAX_LEVEL_WIDTH, level.length)
})

var AUTO_DETECT = false
var SHOW_THREAD_NAME = false
var maxThreadNameLength = -1

function showHideByClassName(className, show) {
  filteredElements = document.getElementsByClassName(className)
  Array.prototype.filter.call(filteredElements, function(element){
    element.style.display = show ? "inline" : "none"
  })
}

function showLogLevel(level, cb) {
  var value = {}
  value[level] = cb.checked
  chrome.storage.local.set(value)
  LOG_LEVELS[level].show = cb.checked
  showHideByClassName(level, cb.checked)
  return true
}

function setAutoDetect(cb) {
  chrome.storage.local.set({ "autodetect": cb.checked })
  AUTO_DETECT = cb.checked
  return true
}

function showThreadName(cb) {
  chrome.storage.local.set({ "threadName": cb.checked })
  SHOW_THREAD_NAME = cb.checked
  showHideByClassName("threadName", cb.checked)
  return true  
}

function showOriginal() {
  chrome.storage.local.set({ "showoriginal": true }, function() { location.reload(); })
  return false
}

function htmlEncode(s)
{
  var el = document.createElement("div");
  el.innerText = el.textContent = s;
  s = el.innerHTML;
  return s;
}

function lineBreaks(obj) {
  var text
  if (typeof obj == 'string' || obj instanceof String) {
    text = obj
  } else {
    text = JSON.stringify(obj)
  }
  return htmlEncode(text).replace(/\n/g, "<br/>")
}

function padSpaces(s, n) {
  return s + Array(n - s.length + 1).join(" ")
}

function levelname(name, maxLevelNameWidth) {
  return '<span>' + padSpaces(name, maxLevelNameWidth) + '</span>'
}

function fileLocation(filename, lineno) {
  var index = filename.indexOf("/py/")
  if (index > 0) {
    filename = filename.substr(index + 1)
  }
    
  return '<span class="location">(' + filename + ':' + lineno + ')</span>'
}

function threadName(name) {
  maxThreadNameLength = Math.max(maxThreadNameLength, name.length)
  var style = ''
  if (SHOW_THREAD_NAME === false) {
    style = 'style="display: none"'
  } 
  return '<span class="threadName" ' + style + '>' + name + ' </span>'
}

// function adjustThreadNameLengthToMax() {
//   nameElements = document.getElementsByClassName("threadName")
//   Array.prototype.filter.call(nameElements, function(nameElement){
//     nameElement.innerText = padSpaces(nameElement.innerText, maxThreadNameLength)
//   })  
// }

// var date = new Date(0)
// var dateOptions =
// {
//   year: "numeric", month: "short",
//   day: "numeric", hour: "2-digit", minute: "2-digit"
// }
function created(utcSeconds) {
  //date.setUTCSeconds(date)
  //var dateString = date.toUTCString()
  
  return '<span class="created">' + utcSeconds.toFixed(6) + /*' ' + dateString +*/ '</span>'
}

function argument(arg) {
  if (arg == null) {
    return "(null)"
  }
  return lineBreaks(arg).toString()
}

function jsonLineToText(json) {
  var obj = JSON.parse(json)

  var msg = obj.msg
  if (msg instanceof Array) {
    msg = msg.join(" ")
  }
  msg = lineBreaks(msg)

  var args = eval(obj.args)
  // replace kwargs
  if (!(args instanceof Array)) {
    for (prop in args) {
      rekwargs = new RegExp("%\\(" + prop + "\\)[rds]", "gm")
      msg = msg.replace(rekwargs, argument(args[prop]))
    }
  }
  // replace args
  msg = msg.replace(/%[rd]/g, "%s")
  for (var i = 0; i < args.length; ++i) {
    msg = msg.replace("%s", argument(args[i]))
  }

  exc_text = ""
  if (obj.exc_text) {
    exc_text = "<blockquote>" + lineBreaks(obj.exc_text) + "</blockquote>"
  }

  var levelProps = LOG_LEVELS[obj.levelname]
  var lineStyle = ''
  if (levelProps !== undefined) {
    if (levelProps.show === false) {
      lineStyle = 'style="display: none"'
    } 
  }
  
  return '<span class="line ' + obj.levelname +'" ' + lineStyle + '>' + created(obj.created) + " " + threadName(obj.threadName) + levelname(obj.levelname, MAX_LEVEL_WIDTH) + " " + msg + exc_text + " " + fileLocation(obj.pathname, obj.lineno) + '</span><br class="' + obj.levelname + '" ' + lineStyle + '/>'
}

function parse() {
  var inputLines = document.body.innerText.split("\n")
  var outputLines = []
  var lineParseSuccess = inputLines.every(function(line) {
    if (line === "") {
      outputLines.push("[EMPTY LOG LINE]" + "<br/>")
      return true
    }
    if (line === "None") {
      outputLines.push("[NONE LOG LINE]" + "<br/>")
      return true
    }
    if (line[0] === '\ufffd' && line === Array(line.length + 1).join('\ufffd')) {
      outputLines.push(line + "<br/>")
      return true
    }
    try {
      outputLines.push(jsonLineToText(line))
      return true
    } catch(err) {
      console.log(err)
      outputLines.push("[FAILED LOG LINE]: " + line + "<br/>")
      return autoParse === false // When not auto-parsing, continue
    }
  });
  
  if (lineParseSuccess === false && autoParse === true) {
    // Auto parsing failed, so get out and don't tell the user we even tried
    console.warn("Auto parsing failed. Will not modify page")
    return
  }

  var css = '<link href="' + chrome.extension.getURL("interpreter.css") + '" rel="stylesheet" type="text/css" />'
  var options = '<label><input id="autodetect" type="checkbox"' + (AUTO_DETECT ? " checked" : "") + '>Auto detect (experimental)</label><br/>'
  Object.keys(LOG_LEVELS).forEach(function(level) {
    var checked = ""
    levelProps = LOG_LEVELS[level]
    if (levelProps !== undefined && levelProps.show) {
      checked = "checked"
    }
    options += '<label><input id="' + level + '" type="checkbox"' + ' accesskey="' + level[0] + '" ' + checked + '>' + level + '</label>'
  })
  options += '<label><input id="threadName" type="checkbox" accesskey="T" ' + (SHOW_THREAD_NAME ? " checked" : "") + '>Thread name</label>'
  options += "<br/>"
  var showOriginalLink = '<a href="#" id="showoriginal">Show original</a><br/>'

  document.head.innerHTML = css
  document.body.innerHTML = showOriginalLink + options + '<pre>' + outputLines.join("") + '</pre>'

//   adjustThreadNameLengthToMax()
  
  Object.keys(LOG_LEVELS).forEach(function(level) {
    var button = document.getElementById(level)
    button.onclick = function() { return showLogLevel(level, button); }
  })
  
  var autoDetectButton = document.getElementById("autodetect")
  autoDetectButton.onclick = function() { return setAutoDetect(autoDetectButton); }
  
  var showOriginaLink = document.getElementById("showoriginal")
  showOriginaLink.onclick = function() { return showOriginal(); }

  var showThreadNameButton = document.getElementById("threadName")
  showThreadNameButton.onclick = function() { return showThreadName(showThreadNameButton); }
}

var optionsKeys = Object.keys(LOG_LEVELS).concat(["autodetect", "showoriginal", "threadName"])

chrome.storage.local.get(optionsKeys, function(items) {
  try {
    if (items["showoriginal"] !== undefined && items["showoriginal"] === true) {
      chrome.storage.local.set({ "showoriginal": false })
      return
    } 

    Object.keys(LOG_LEVELS).forEach(function(level) {
      if (items[level] !== undefined) {
        if (items[level] === true) {
          LOG_LEVELS[level].show = true
        } else {
          LOG_LEVELS[level].show = false
        }
      } else {
        // default
        LOG_LEVELS[level].show = true
      }
    })

    if (items["autodetect"] !== undefined) {
      AUTO_DETECT = items["autodetect"]
    }

    if (items["threadName"] !== undefined) {
      SHOW_THREAD_NAME = items["threadName"]
    }

    console.time('parse')
    parse()
    console.timeEnd('parse')
  } finally {
    chrome.runtime.sendMessage({message: "done"})
  }
})
