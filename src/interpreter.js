MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
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
var SHOW_CREATED = true
var SHOW_DATE = false
var SHOW_THREAD_NAME = false
var customStyleSheet = null

function showHideByClassName(className, show) {
  if (customStyleSheet === null) {
    var style = document.createElement("style")
    document.head.appendChild(style)
    customStyleSheet = style.sheet
  }

  for (var i = 0; i < customStyleSheet.cssRules.length; ++i) {
    if (customStyleSheet.cssRules[i].selectorText === '.' + className.toLowerCase()) {
      document.styleSheets[1].removeRule(i)
    }
  }

  customStyleSheet.insertRule('.' + className + ' { display: ' + (show ? "inline" : "none") + '; }', 0)
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

function showCreated(cb) {
  chrome.storage.local.set({ "created": cb.checked })
  SHOW_CREATED = cb.checked
  showHideByClassName("created", cb.checked)
  return true
}

function showDate(cb) {
  chrome.storage.local.set({ "date": cb.checked })
  SHOW_DATE = cb.checked
  showHideByClassName("date", cb.checked)
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

function padSpacesRight(s, n) {
  return s + Array(n - s.length + 1).join(" ")
}

function padLeft(s, n, c) {
  return Array(n - s.length + 1).join(c) + s
}

function levelname(name, maxLevelNameWidth) {
  return '<span>' + padSpacesRight(name, maxLevelNameWidth) + '</span>'
}

function fileLocation(filename, lineno) {
  var index = filename.indexOf("/py/")
  if (index > 0) {
    filename = filename.substr(index + 1)
  }
    
  return '<span class="location">(' + filename + ':' + lineno + ')</span>'
}

function threadName(name) {
  return '<span class="threadName">' + name + ' </span>'
}

function created(utcSeconds) {
  var date = new Date(Math.floor(utcSeconds) * 1000)
  var dateString =
    MONTHS[date.getUTCMonth()] + ' ' +
    padLeft(date.getUTCDate().toString(), 2, ' ') + ' ' +
    padLeft(date.getUTCHours().toString(), 2, '0') + ':' +
    padLeft(date.getUTCMinutes().toString(), 2, '0') + ':'  +
    padLeft(date.getUTCSeconds().toString(), 2, '0')
  
  return '<span class="created">' + utcSeconds.toFixed(6) + ' </span><span class="date">' + dateString + ' </span>'
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
      var rekwargs = new RegExp("%\\(" + prop + "\\)([rdsf]|0?\\.?[0-9]+f)", "gm")
      msg = msg.replace(rekwargs, argument(args[prop]))
    }
  }
  // replace args
  msg = msg.replace(/%[rdf]/g, "%s")
  for (var i = 0; i < args.length; ++i) {
    msg = msg.replace("%s", argument(args[i]))
  }

  var exc_text = ""
  if (obj.exc_text) {
    exc_text = "<blockquote>" + lineBreaks(obj.exc_text) + "</blockquote>"
  }

  return '<span class="line ' + obj.levelname + '">' + created(obj.created) + threadName(obj.threadName) + levelname(obj.levelname, MAX_LEVEL_WIDTH) + " " + msg + exc_text + " " + fileLocation(obj.pathname, obj.lineno) + '</span><br class="' + obj.levelname + '" />'
}

function parse() {
  var parser = new DOMParser()
  var linesFragment = document.createDocumentFragment()
  var inputLines = document.body.innerText.split("\n")
  var lineParseSuccess = inputLines.every(function(line) {
    if (line === "") {
      line = '<span class="line">[EMPTY LOG LINE]</span><br/>'
    } else if (line === "None") {
      line = '<span class="line">[NONE LOG LINE]</span><br/>'
    } else if (line[0] === '\ufffd' && line === Array(line.length + 1).join('\ufffd')) {
      line = '<span class="line">' + line + '</span><br/>'
    } else {
      try {
        line = jsonLineToText(line)
      } catch(err) {
        console.log(err)
        if (autoParse === true) {
            return false // When not auto-parsing, continue
        }
        line = '<span class="line">[FAILED LOG LINE]: ' + line + '</span><br/>'
      }
    }

    var parsedLine = parser.parseFromString(line, "text/html").body
    linesFragment.appendChild(parsedLine.childNodes[0]) // <span line>
    linesFragment.appendChild(parsedLine.childNodes[0]) // <br>
    return true
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
    var levelProps = LOG_LEVELS[level]
    if (levelProps !== undefined && levelProps.show) {
      checked = "checked"
    }
    options += '<label><input id="' + level + '" type="checkbox"' + ' accesskey="' + level[0] + '" ' + checked + '>' + level + '</label>'
  })
  options += '<label><input id="created" type="checkbox" accesskey="U" ' + (SHOW_CREATED ? " checked" : "") + '>Unix time</label>'
  options += '<label><input id="date" type="checkbox" accesskey="A" ' + (SHOW_DATE ? " checked" : "") + '>UTC date</label>'
  options += '<label><input id="threadName" type="checkbox" accesskey="T" ' + (SHOW_THREAD_NAME ? " checked" : "") + '>Thread name</label>'
  options += "<br/>"
  var showOriginalLink = '<a href="#" id="showoriginal">Show original</a><br/>'

  document.head.innerHTML = css
  document.body.innerHTML = showOriginalLink + options + '<pre></pre>'

  Object.keys(LOG_LEVELS).forEach(function(level) {
    showHideByClassName(level, LOG_LEVELS[level].show)
    var button = document.getElementById(level)
    button.onclick = function() { return showLogLevel(level, button); }
  })
  
  var autoDetectButton = document.getElementById("autodetect")
  autoDetectButton.onclick = function() { return setAutoDetect(autoDetectButton); }
  
  var showOriginaLink = document.getElementById("showoriginal")
  showOriginaLink.onclick = function() { return showOriginal(); }

  showHideByClassName("created", SHOW_CREATED)
  var showCreatedButton = document.getElementById("created")
  showCreatedButton.onclick = function() { return showCreated(showCreatedButton); }

  showHideByClassName("date", SHOW_DATE)
  var showDateButton = document.getElementById("date")
  showDateButton.onclick = function() { return showDate(showDateButton); }

  showHideByClassName("threadName", SHOW_THREAD_NAME)
  var showThreadNameButton = document.getElementById("threadName")
  showThreadNameButton.onclick = function() { return showThreadName(showThreadNameButton); }

  var preTag = document.getElementsByTagName("pre")[0];
  preTag.appendChild(linesFragment)
}

var optionsKeys = Object.keys(LOG_LEVELS).concat(["autodetect", "showoriginal", "created", "date", "threadName"])

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

    if (items["created"] !== undefined) {
      SHOW_CREATED = items["created"]
    }

    if (items["date"] !== undefined) {
      SHOW_DATE = items["date"]
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
