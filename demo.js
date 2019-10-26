const process = require("process");
const rpio = require("rpio");
const { agent: pubsub, after } = require("rx-helper");
const { concat, Observable } = require("rxjs");

// A function that runs when a 'shutdown' event is triggered
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

// Two ways we might hook, and then trigger, a 'shutdown' event.
process.on("SIGINT", function() {
  pubsub.trigger("shutdown");
  process.exit();
});
process.on("exit", () => agent.trigger("shutdown"));

// The agent's mechanism
pubsub.on("shutdown", handleShutdown);

// We have a single white (RGB) bulb, we dont control blue, and we control RG on 5/6
const redPin = 5;
const greenPin = 6;
const statusPin = 26;
const buttonPin = 16;
setUpAgent();
pubsub.process({ type: "start" });
pubsub.process({ type: "initButtons" });

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

function turnGreenOn() {
  setGreen(true);
}
function turnGreenOff() {
  setGreen(false);
}
function turnRedOn() {
  setRed(true);
}
function turnRedOff() {
  setRed(false);
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
  // See what events we get
  pubsub.spy(({ event }) => console.log(pp(event)));

  // Make a graceful exit
  pubsub.filter("shutdown", handleShutdown);

  // Process a buttonEvent" }
  pubsub.on(
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

  // Process some buttonEvents upon startup
  pubsub.on(
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

  pubsub.on(
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
      turnRedOff()
      turnGreenOff()

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

  pubsub.on("buttonEvent", buzzThemIn, {
    concurrency: "mute"
  });

  pubsub.on("setColor", ({ event }) => {
    const color = action.payload;
    switch (color) {
      case "red":
        turnRedOn();
        break;
      case "green":
        turnGreenOn();
        break;
      case "off":
        turnRedOff();
        turnRedOff();
        break;
    }
  });
}

function buzzThemIn() {
  // return a dance which turns green for 2500 msec, then reverts to off
  return concat(
    after(0, () => trigger("setColor", "off")),
    after(200, () => trigger("setColor", "green")),
    after(2500, () => trigger("setColor", "off")),
    after(200, () => trigger("setColor", "red"))
  );
}
// const { Observable } = require("rxjs");
// const validKeys = [
//   "198,169,99,26", // white card
//   "166,168,89,211" // blue fob
// ];
// const rfids = new Observable(notify => {
// const spawn = require("child_process").spawn;
//   console.log("spawning python process...");
//   const child = spawn("sudo", ["python", "/home/pi/src/gpio-gui/rfid/Read.py"]);
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
