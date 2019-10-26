var express = require("express");
var path = require("path");
var process = require("process");
var rpio = require("rpio");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");

var routes = require("./routes/index");
var users = require("./routes/users");
var ajax = require("./routes/ajax");

const { agent, after } = require("rx-helper");
const { concat, Observable } = require("rxjs");
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

// We have a single white (RGB) bulb, we dont control blue, and we control RG on 5/6
const redPin = 5;
const greenPin = 6;
const statusPin = 26;
const buttonPin = 16;
setUpAgent();
agent.process({ type: "start" });
agent.process({ type: "initButtons" });

process.on("SIGINT", function() {
  agent.process({ type: "shutdown" });
  process.exit();
});
process.on("exit", () => agent.process({ type: "shutdown" }));

function setGreen(status = true) {
  if (status) {
    // must turn off 5 red to have 6 green on
    setRPIO({ gpio: redPin, status: false });
    setRPIO({ gpio: greenPin, status: true });
  } else {
    setRPIO({ gpio: greenPin, status: false });
  }
}

function setRed(status = true) {
  if (status) {
    // turn off 6 green to show 5 red
    setRPIO({ gpio: greenPin, status: false });
    setRPIO({ gpio: redPin, status: true });
  } else {
    setRPIO({ gpio: redPin, status: false });
  }
}

function setStatus(status = true) {
  setRPIO({ gpio: statusPin, status });
}

function setRPIO({ gpio, status }) {
  rpio.write(gpio, +status);
}

function pp({ type, payload = {} }) {
  return (
    type +
    ": " +
    (typeof payload !== "object"
      ? payload
      : Array.from(Object.keys(payload))
          .map(k => `${k}: ${payload[k]}`)
          .join(", "))
  );
}

function setUpAgent() {
  // Filters run synchronously!
  // See what events we get
  agent.spy(({ action }) => console.log(pp(action)));

  // Make a graceful exit
  agent.filter("shutdown", handleShutdown);
  // See what events we get
  agent.spy(({ action }) => console.log(pp(action)));

  // Process a buttonEvent" }
  agent.on(
    "initButtons",
    () => {
      /*
       * Use the internal pulldown resistor to default to off.  Pressing the button
       * causes the input to go high, releasing it leaves the pulldown resistor to
       * pull it back down to low.
       */
      rpio.open(buttonPin, rpio.INPUT);
      return new Observable(notify => {
        rpio.poll(buttonPin, pin => {
          try {
            /*
             * Wait for a small period of time to avoid rapid changes which
             * can't all be caught with the 1ms polling frequency.  If the
             * pin is no longer down after the wait then ignore it.
             */
            rpio.msleep(20);
            const state = rpio.read(pin);
            notify.next({ pin, state });
          } catch (ex) {
            console.log("Button error: " + ex.message);
            // notify.error(ex)
          }
        });
        return () => rpio.close(buttonPin);
      });
    },
    { type: "buttonEvent" }
  );

  // Process a buttonEvent
  agent.on(
    "initButtons",
    () => {
      /*
       * Use the internal pulldown resistor to default to off.  Pressing the button
       * causes the input to go high, releasing it leaves the pulldown resistor to
       * pull it back down to low.
       */
      rpio.open(buttonPin, rpio.INPUT);
      return new Observable(notify => {
        rpio.poll(buttonPin, pin => {
          try {
            /*
             * Wait for a small period of time to avoid rapid changes which
             * can't all be caught with the 1ms polling frequency.  If the
             * pin is no longer down after the wait then ignore it.
             */
            rpio.msleep(20);
            const state = rpio.read(pin);
            notify.next({ pin, state });
          } catch (ex) {
            console.log("Button error: " + ex.message);
            // notify.error(ex)
          }
        });
        return () => rpio.close(buttonPin);
      });
    },
    { type: "buttonEvent" }
  );

  agent.on(
    "start",
    () => {
      rpio.init({ mapping: "gpio" });
      // spare us the need of a wire to do this
      rpio.pud(buttonPin, rpio.PULL_DOWN);

      [statusPin, greenPin, redPin].forEach(pin => {
        rpio.open(pin, rpio.OUTPUT, rpio.LOW);
      });
      // on startup turn on status
      setStatus(true);
      setRed(false);
      setGreen(false);

      // Return the startup dance
      return concat(
        after(2000, () => setStatus(false)),
        after(500, "red"),
        after(500, "off"),
        after(500, "red"),
        after(500, "off"),
        after(500, "red"),
        after(500, "off"),
        after(500, "red")
      );
    },
    { type: "setColor" }
  );

  // LEFTOFF doesn't work - kills the Pi! :( durned IOT
  agent.on(
    "buttonEvent",
    ({ action }) => {
      const { pin, status } = action.payload;
      // if (!status && pin === buttonPin) {
      //   return empty();
      // }

      // return a dance which turns green for 2500 msec, then reverts to off
      return concat(
        after(0, "off"),
        after(200, "green"),
        after(2500, "off"),
        after(200, "red")
      );
    },
    { concurrency: "mute", type: "setColor" }
  );

  agent.on("setColor", ({ action }) => {
    const color = action.payload;
    switch (color) {
      case "red":
        setRed(true);
        break;
      case "green":
        setGreen(true);
        break;
      case "off":
        setRed(false);
        setGreen(false);
        break;
    }
  });
}

function handleShutdown() {
  try {
    setRed(false);
    setGreen(false);
    setStatus(false);
    [statusPin, greenPin, redPin].forEach(pin => rpio.close(pin));
  } catch (ex) {
    console.log("Error: " + ex.message);
  }
}
// const { Observable } = require("rxjs");
// const validKeys = [
//   "198,169,99,26", // white card
//   "166,168,89,211" // blue fob
// ];
// const rfids = new Observable(notify => {
// var spawn = require("child_process").spawn;
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

// const rfid = require("node-rfid");

// const rfids = new Observable(notify => {
//   rfid.read(function(err, result) {
//     if (err) console.log("Sorry, some hardware error occurred"); //some kind of hardware/wire error
//     notify.next(result);
//   });
// });

module.exports = app;
