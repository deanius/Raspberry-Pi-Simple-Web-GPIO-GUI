var express = require("express");
var path = require("path");
var process = require("process");
var rpio = require("rpio");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");

var routes = require("./routes/index");
var users = require("./routes/users");
var ajax = require("./routes/ajax");

require("dotenv").config();

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", routes);
app.use("/users", users);
app.post("/ajax", ajax);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render("error", {
    message: err.message,
    error: {}
  });
});

app.listen(app.get("port"));

var spawn = require("child_process").spawn;
const { Observable } = require("rxjs");
const { debounceTime } = require("rxjs/operators");

// const rfids = new Observable(notify => {
//   console.log("spawning python process...");
//   var child = spawn("sudo", ["python", "/home/pi/src/gpio-gui/rfid/Read.py"]);
//   child.stdout.setEncoding("utf8");
//   child.stdout.on("data", function(data) {
//     const noNewline = data.replace(/\s$/, "");

//     if (noNewline.indexOf("UID") === -1) return;
//     const rfid = noNewline.split(": ")[1];
//     notify.next(rfid);
//     // notify.next(noNewline);
//   });
//   child.on("close", function(code) {
//     if (!code) {
//       notify.complete();
//       return;
//     }
//     notify.error(code);
//   });

//   return () => child.kill();
// });

const rfid = require("node-rfid");

const rfids = new Observable(notify => {
  rfid.read(function(err, result) {
    if (err) console.log("Sorry, some hardware error occurred"); //some kind of hardware/wire error
    notify.next(result);
  });
});

const validKeys = [
  "198,169,99,26", // white card
  "166,168,89,211" // blue fob
];

// Pin 26 reflects our status
const statusPin = 26;

// on startup turn on status, off others
setRPIO({ gpio: statusPin, status: true });
setRed(false);
setGreen(false);

// and lock
setTimeout(setRed, 1500);

let rfidSub;
rfidSub = rfids.subscribe(
  rfid => {
    console.log("Scan: " + rfid);
    if (validKeys.includes(rfid)) {
      setGreen();
    }
  },
  e => {
    console.log("RFID error: " + e);
  }
);

process.on("SIGINT", function() {
  shutdown();
  process.exit();
});
process.on("exit", shutdown);

function shutdown() {
  try {
    setRed(false);
    setGreen(false);
    setRPIO({ gpio: statusPin, status: false });
    rpio.close(statusPin);
    rfidSub && rfidSub.unsubscribe();
  } catch (ex) {
    console.log("Error: " + ex.message);
  }
}

function setGreen(status = true) {
  setRPIO({ gpio: 5, status: false });
  setRPIO({ gpio: 6, status: status && true });
}

function setRed(status = true) {
  setRPIO({ gpio: 5, status: status && true });
  setRPIO({ gpio: 6, status: false });
}

// We need to mind our init/open/close lifecycle tightly
function setRPIO({ gpio, status }) {
  rpio.init({ mapping: "gpio" });
  rpio.open(gpio, rpio.OUTPUT, +status);
  rpio.write(gpio, +status);
}

module.exports = app;
