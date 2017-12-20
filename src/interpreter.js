MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
var LOG_LEVELS = {
  "DEBUG"    : { "show": true, "count": 0 },
  "INFO"     : { "show": true, "count": 0 },
  "WARNING"  : { "show": true, "count": 0 },
  "WARN"     : { "show": true, "count": 0 },
  "ERROR"    : { "show": true, "count": 0 },
  "CRITICAL" : { "show": true, "count": 0 },
  "PROGRESS" : { "show": true, "count": 0 },
  "SUCCESS"  : { "show": true, "count": 0 },
  "STEP"     : { "show": true, "count": 0 },
  "PANIC"    : { "show": true, "count": 0 },
  "FATAL"    : { "show": true, "count": 0 },
}

var MAX_LEVEL_WIDTH = 0
Object.keys(LOG_LEVELS).forEach(function(level) {
  MAX_LEVEL_WIDTH = Math.max(MAX_LEVEL_WIDTH, level.length)
})

var AUTO_DETECT = false
var SHOW_CREATED = true
var SHOW_DATE = false
var SHOW_THREAD_NAME = false
var SHOW_LOCATION = true
var customStyleSheet = null

function showHideByClassName(className, show) {
  if (customStyleSheet === null) {
    var style = document.createElement("style")
    document.head.appendChild(style)
    customStyleSheet = style.sheet
  }

  // Restore default display for this class
  for (var i = 0; i < customStyleSheet.cssRules.length; ++i) {
    if (customStyleSheet.cssRules[i].selectorText.toLowerCase() === '.' + className.toLowerCase()) {
      document.styleSheets[1].removeRule(i)
      --i
    }
  }

  if (show === true) {
    return
  }

  customStyleSheet.insertRule('.' + className + ' { display: none; }', 0)
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

function showLocation(cb) {
  chrome.storage.local.set({ "location": cb.checked })
  SHOW_LOCATION = cb.checked
  showHideByClassName("location", cb.checked)
  return true
}

function showOriginal() {
  chrome.storage.local.set({ "showoriginal": true }, function() { location.reload(); })
  return false
}

var htmlEncodingHelper = null
function htmlEncode(s)
{
  if (htmlEncodingHelper === null) {
    htmlEncodingHelper = document.createElement("div")
  }
  htmlEncodingHelper.innerText = htmlEncodingHelper.textContent = s
  return htmlEncodingHelper.innerHTML;
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
  return padSpacesRight(name, maxLevelNameWidth)
}

function fileLocation(filename, lineno) {
  if (!filename) return '';
  var index = filename.indexOf("/py/")
  if (index > 0) {
    filename = filename.substr(index + 1)
  }
    
  return [
    '<span class="location">(',
    filename,
    lineno > 0 ? (':' + lineno) : '',
    ')</span>'
  ].join("")
}

function threadName(name) {
  return ['<span class="threadName">', name, ' </span>'].join("")
}

function created(utcSeconds) {
  var date = new Date(Math.floor(utcSeconds) * 1000)
  var dateString =
    MONTHS[date.getUTCMonth()] + ' ' +
    padLeft(date.getUTCDate().toString(), 2, ' ') + ' ' +
    padLeft(date.getUTCHours().toString(), 2, '0') + ':' +
    padLeft(date.getUTCMinutes().toString(), 2, '0') + ':'  +
    padLeft(date.getUTCSeconds().toString(), 2, '0')
  
  return ['<span class="created">', utcSeconds.toFixed(6), ' </span><span class="date">', dateString, ' </span>'].join("")
}

function argument(arg, fractional) {
  if (arg == null) {
    return "(null)"
  }
  if (typeof(arg) == "number" && typeof(fractional) != "undefined") {
    var fix = parseInt(fractional, 10)
    if (!isNaN(fix)) {
      return lineBreaks(arg.toFixed(fix))
    }
  }
  return lineBreaks(arg)
}

// Call to eval() in a separate function because functions that contain calls to eval() cannot
// be optimized. See: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
function doEval(args) {
  return eval(args)
}

function jsonLineToText(json) {
  var obj = JSON.parse(json)
  obj.level_key = (obj.level || obj.levelname).split(" ")[0]

  var msg = obj.message
  if (msg instanceof Array) {
    msg = msg.join(" ")
  }
  msg = lineBreaks(msg)

  var args = doEval(obj.args)
  if (typeof(args) != "undefined") {
    if (!(args instanceof Array)) {
      msg = handleDict(msg, args)
      // special case to handle log of a dict as is
      msg = msg.replace(/%[rdf]/g, "%s")
      msg = msg.replace("%s", argument(args))
    } else {
      var pattern = XRegExp("%([-]?[0-9]*[rdsf]|([0-9]*\\.)?(?<fractional>[0-9]+)f)", "gm");
      msg = msg.replace(pattern, function(match) {
        return argument(args.shift(), match.fractional)
      })
    }
  }

  var exc_text = " "
  if (obj.exc_text) {
    exc_text = [ "<blockquote>", lineBreaks(obj.exc_text), "</blockquote> " ].join("")
  }

  LOG_LEVELS[obj.level_key.toUpperCase()].count++;

  // if it's a Python-like log line
  if (obj.threadName && obj.pathname) {
    return [ [ created(obj.created), threadName(obj.threadName), levelname(obj.levelname, MAX_LEVEL_WIDTH), " ", msg, exc_text, fileLocation(obj.pathname, obj.lineno) ].join("") , obj.levelname ]
  }
  // otherwise, it could be Go application. (e.g: maestro project)
  var text = [
    obj.ts,
    levelname(obj.level, MAX_LEVEL_WIDTH),
    // key-value fields
    Object.keys(obj)
      .filter(k => k != 'level' && k != 'ts' && k  != 'path')
      .map(k => k + '=' + obj[k])
      .join(', '),
    fileLocation(obj.path, -1)
  ].join(' ');
  return [text, obj.level]
}

function handleDict(msg, dict) {
  if (!(dict instanceof Array)) {
    var pattern = new XRegExp("%\\((?<prop>[a-zA-Z_][a-zA-Z0-9-_]*)\\)([rdsf]|([0-9]*\\.)?(?<fractional>[0-9]+)f)", "gm")
    msg = msg.replace(pattern, function(match) {
      value = dict[match.prop]
      if (typeof(value) == "undefined") {
        console.log('did not find matching value for property: ('+match.prop+'), match: ('+match+')')
        return match
      } else {
        return argument(value, match.fractional)
      }
    })
  }
  return msg
}

function createDivFromLine(line, level) {
  var span = document.createElement("div")
  span.className = "line " + level
  span.innerHTML = line
  return span
}

function parse() {
  var linesFragment = document.createDocumentFragment()
  var inputLines = document.body.innerText.split("\n")
  var lineParseSuccess = inputLines.every(function(line) {
    var level = ""
    if (line === "") {
      line = '[EMPTY LOG LINE]'
    } else if (line === "None") {
      line = '[NONE LOG LINE]'
    } else if (line[0] === '\ufffd' && line === Array(line.length + 1).join('\ufffd')) {
      line = line
    } else {
      try {
        lineAndLevel = jsonLineToText(line)
        line = lineAndLevel[0]
        level = lineAndLevel[1]
      } catch(err) {
        console.log(err)
        if (autoParse === true) {
            return false // When not auto-parsing, continue
        }
        line = '[FAILED LOG LINE]: ' + line
      }
    }

    linesFragment.appendChild(createDivFromLine(line, level))
    return true
  });
  
  if (lineParseSuccess === false && autoParse === true) {
    // Auto parsing failed, so get out and don't tell the user we even tried
    console.warn("Auto parsing failed. Will not modify page")
    return
  }

  var css = '<link href="' + chrome.extension.getURL("interpreter.css") + '" rel="stylesheet" type="text/css" />'
  var options = '<label><input id="autodetect" type="checkbox"' + (AUTO_DETECT ? " checked" : "") + '>Auto detect</label><br/>'
  Object.keys(LOG_LEVELS).forEach(function(level) {
    var checked = ""
    var style = ""
    var levelProps = LOG_LEVELS[level]
    if (levelProps.count <= 0) {
      style = 'style="display: none"'
    }
    if (levelProps !== undefined && levelProps.show) {
      checked = "checked"
    }
    options += '<span ' + style + '><label><input id="' + level + '" type="checkbox"' + ' accesskey="' + level[0] + '" ' + checked + '>' + level + ' (' + levelProps.count + ')' + '</label></span>'
  })
  options += '<label><input id="created" type="checkbox" accesskey="U" ' + (SHOW_CREATED ? " checked" : "") + '>Unix time</label>'
  options += '<label><input id="date" type="checkbox" accesskey="A" ' + (SHOW_DATE ? " checked" : "") + '>UTC date</label>'
  options += '<label><input id="threadName" type="checkbox" accesskey="T" ' + (SHOW_THREAD_NAME ? " checked" : "") + '>Thread name</label>'
  options += '<label><input id="location" type="checkbox" accesskey="F" ' + (SHOW_LOCATION ? " checked" : "") + '>File</label>'
  options += "<br/>"
  var showOriginalLink = '<a href="#" id="showoriginal">Show original</a><br/>'

  document.head.innerHTML = css
  document.body.innerHTML = showOriginalLink + options + '<pre><span>LOADING...</span></pre>'

  Object.keys(LOG_LEVELS).forEach(function(level) {
    var levelProps = LOG_LEVELS[level]
    showHideByClassName(level, levelProps.show)
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

  showHideByClassName("location", SHOW_LOCATION)
  var showLocationButton = document.getElementById("location")
  showLocationButton.onclick = function() { return showLocation(showLocationButton); }

  // Why do this async? Because this lets the browser "digest" the CSS and consider it when
  // the fragment with all the lines is added, thus only rendering each line once
  setTimeout(function() {
    var preTag = document.getElementsByTagName("pre")[0];
    preTag.removeChild(preTag.firstChild) // "loading" span
    preTag.appendChild(linesFragment)
  }, 0);
}

var optionsKeys = Object.keys(LOG_LEVELS).concat(["autodetect", "showoriginal", "created", "date", "threadName", "location"])

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

    if (items["location"] !== undefined) {
      SHOW_LOCATION = items["location"]
    }

    console.time('parse')
    parse()
    console.timeEnd('parse')
  } finally {
    chrome.runtime.sendMessage({message: "done"})
  }
})
