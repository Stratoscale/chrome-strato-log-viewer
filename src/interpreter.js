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
var SHOW_REQUEST_ID = true
var SHOW_PROCESS = false
var customStyleSheet = null

var HIGHLIGHT_COUNT = 0
var HIGHLIGHTED_CLASSES = {}

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

function showRequestId(cb) {
  chrome.storage.local.set({ "requestId": cb.checked })
  SHOW_REQUEST_ID = cb.checked
  showHideByClassName("requestId", cb.checked)
  return true
}

function showProcess(cb) {
  chrome.storage.local.set({ "process": cb.checked })
  SHOW_PROCESS = cb.checked
  showHideByClassName("process", cb.checked)
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
  return htmlEncode(text).replace(/\\n/g, "<br/>").replace(/\n/g, "<br/>")
}

function padSpacesRight(s, n) {
  return s.padEnd(n, ' ')
}

function padLeft(s, n, c) {
  return s.padStart(n ,c)
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

  return `<span class="location">(${filename}${lineno > 0 ? (':' + lineno) : ''})</span>`
}

function threadName(name) {
  return `<span class="threadName thread-${name}">${padSpacesRight(name, 6)} </span>`
}

function requestId(id) {
  return id ? `<span class="requestId req-${id.replace('.', '-')}">${id}</span>` : ''
}

function process(id) {
  return id ? `<span class="process req-${id}">${id} </span>` : ''
}

function keyVal(value) {
  return `<span class="key_val">${value} </span>`
}

function created(utcSeconds) {
  var date = new Date(Math.floor(utcSeconds) * 1000)
  var dateString = date2string(date)
  return `<span class="created">${utcSeconds.toFixed(6)} </span><span class="date">${dateString} </span>`
}

function date2string(date) {
    return MONTHS[date.getUTCMonth()] + ' ' +
      padLeft(date.getUTCDate().toString(), 2, ' ') + ' ' +
      padLeft(date.getUTCHours().toString(), 2, '0') + ':' +
      padLeft(date.getUTCMinutes().toString(), 2, '0') + ':'  +
      padLeft(date.getUTCSeconds().toString(), 2, '0')
}

function tsCreated(ts) {
  if (typeof ts  === "string") {
    var date = new Date(ts)
    var dateString = date2string(date)
    return `<span class="created">${padSpacesRight((date.getTime() / 1000).toString(), 14)} </span><span class="date">${dateString} </span>`
  } else {
    return created(ts)
  }
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

function messageFormatter(msg, args) {
  if (msg instanceof Array) {
    msg = msg.join(" ")
  }
  msg = lineBreaks(msg)

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
  return msg
}

function pythonLineToText(lineObj) {
  msg = messageFormatter(lineObj.msg, lineObj.args)

  var exc_text = " "
  if (lineObj.exc_text) {
    exc_text = `<blockquote>${lineBreaks(lineObj.exc_text)}</blockquote> `
  }

  var text = [
    created(lineObj.created),
    process(lineObj.process),
    threadName(lineObj.threadName),
    levelname(lineObj.levelname, MAX_LEVEL_WIDTH),
    requestId(lineObj.request_id),
    " ",
    msg,
    exc_text,
    fileLocation(lineObj.pathname, lineObj.lineno)
  ].join("")
  return [ text, lineObj.levelname ]
}

function golangLineToText(lineObj) {
  var request_id = ""
  var thread = ""
  var error = ""
  var caller

  // New logging format, all key-val args are under the 'extra_data'
  // stack context is under 'stack' keyword
  if ('extra_data' in lineObj) {
    request_id = lineObj.extra_data['request_id']
    delete lineObj.extra_data['request_id']
    caller = lineObj.extra_data.caller
    delete lineObj.extra_data.caller
    thread = lineObj.extra_data['go-id'] || '0000'
    delete lineObj.extra_data['go-id']

    var stack = lineObj.extra_data.stack
    if (stack) {
        error += "\n"
        stack.forEach(function (s) {
            error += `\tfile ${s.File},line ${s.Line}, in ${s.Name}\n`
        })
        delete lineObj.extra_data.stack
    }
  // Older logging format
  // stack context string is under 'error' keyword
  } else {
    lineObj.extra_data = {}
    caller = lineObj.caller
    request_id = lineObj.request_id
    error = lineObj.error ? `<blockquote>${lineBreaks(lineObj.error)}</blockquote>` : ""
  }

  var {File, Line} = caller || {}

  var text = [
    tsCreated(lineObj.ts),
    threadName(thread),
    levelname(lineObj.level.toUpperCase(), MAX_LEVEL_WIDTH),
    requestId(request_id),
    " ",
    lineObj.msg.trim(),
    error,
    // key-value fields
    keyVal(Object.keys(lineObj.extra_data)
      .map(k => `${k}=${lineObj.extra_data[k]}`)
      .join(', ')),
    fileLocation(File, Line)
  ].join(' ');
  return [text, lineObj.level]
}

function jsonLineToText(json) {
  var obj = JSON.parse(json)

  var level_key = (obj.level || obj.levelname).split(" ")[0]
  LOG_LEVELS[level_key.toUpperCase()].count++;

  if (obj.threadName && obj.pathname) {
    return pythonLineToText(obj)
  }

  return golangLineToText(obj)
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
        level = lineAndLevel[1].toUpperCase()
      } catch(err) {
        console.log(err)
        if (!(window.location.pathname.endsWith('.stratolog') || (window.location.pathname.endsWith('.log'))) && autoParse === true) {
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

  var css = '<link href="' + chrome.runtime.getURL("interpreter.css") + '" rel="stylesheet" type="text/css" />'
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
  options += '<label><input id="requestId" type="checkbox" accesskey="R" ' + (SHOW_REQUEST_ID ? " checked" : "") + '>requestId</label>'
  options += '<label><input id="process" type="checkbox" accesskey="P" ' + (SHOW_PROCESS ? " checked" : "") + '>Process</label>'
  options += '<label><input id="clearHighlights" type="button" accesskey="C" value="clear highlights"></label>'
  options += "<br/>"
  var showOriginalLink = '<a href="#" id="showoriginal">Show original</a><br/>'

  document.head.innerHTML = css
  document.body.innerHTML = '<div class="page"><div class="controls">' + showOriginalLink + options + '</div><pre class="lines"><span>LOADING...</span></pre></div>'

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

  showHideByClassName("requestId", SHOW_REQUEST_ID)
  var showRequestIdButton = document.getElementById("requestId")
  showRequestIdButton.onclick = function() { return showRequestId(showRequestIdButton); }

  showHideByClassName("process", SHOW_PROCESS)
  var showProcessButton = document.getElementById("process")
  showProcessButton.onclick = function() { return showProcess(showProcessButton); }

  var clearHighlightsButton = document.getElementById("clearHighlights")
  clearHighlightsButton.onclick = function() { return clearHighlights(); }

  // Why do this async? Because this lets the browser "digest" the CSS and consider it when
  // the fragment with all the lines is added, thus only rendering each line once
  setTimeout(function() {
    var preTag = document.getElementsByTagName("pre")[0];
    preTag.removeChild(preTag.firstChild) // "loading" span
    preTag.appendChild(linesFragment)
  }, 0);

  document.body.addEventListener('click', (e) => handleHighlightClick(e.target))
}

const colors = ["#393b79", "#5254a3", "#6b6ecf", "#9c9ede", "#637939", "#8ca252", "#b5cf6b", "#cedb9c", "#8c6d31", "#bd9e39", "#e7ba52", "#e7cb94", "#843c39", "#ad494a", "#d6616b", "#e7969c", "#7b4173", "#a55194", "#ce6dbd", "#de9ed6"]

function getColor(i) {
    return colors[i % colors.length]
}


function handleHighlightClick(target) {
  if (target.classList.contains("requestId")) {
    classInstance = target.classList[1]
    toggleHighlight("requestId", classInstance)
  }
  if (target.classList.contains("threadName")) {
    classInstance = target.classList[1]
    toggleHighlight("threadName", classInstance)
  }
}

function toggleHighlight(generalClass, classInstance) {
  if (!HIGHLIGHTED_CLASSES.hasOwnProperty(classInstance)) {
    var background = getColor(HIGHLIGHT_COUNT++)
    customStyleSheet.insertRule(`body.${classInstance} .${generalClass}.${classInstance} { color: white; background-color: ${background} }`, 0)
  }
  if (HIGHLIGHTED_CLASSES[classInstance]) {
    document.body.classList.remove(classInstance)
    HIGHLIGHTED_CLASSES[classInstance] = false
  } else {
    document.body.classList.add(classInstance)
    HIGHLIGHTED_CLASSES[classInstance] = true
  }
}

function clearHighlights(generalClass, classInstance) {
  var toRemove = []
  document.body.classList.forEach(function(cls) {
    toRemove.push(cls)
  })
  toRemove.forEach(function(cls) {
    if (cls.startsWith("req-") || cls.startsWith("thread-")) {
      document.body.classList.remove(cls)
    }
  })
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

    if (items["process"] !== undefined) {
      SHOW_PROCESS = items["process"]
    }

    console.time('parse')
    parse()
    console.timeEnd('parse')
  } finally {
    chrome.runtime.sendMessage({message: "done"})
  }
})
