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
process.on("exit", () => pubsub.trigger("shutdown"));

// The agent's mechanism
pubsub.on("shutdown", handleShutdown);

// We have a single white (RGB) bulb, we dont control blue, and we control RG on 5/6
const redPin = 5;
const greenPin = 6;
const statusPin = 26;
const buttonPin = 16;

setUpAgent();
pubsub.trigger('start')

function setUpAgent() {
  // See what events we get
  pubsub.spy(({ event }) => console.log(pp(event)));

  pubsub.on(
    "start",
    () => {
      rpio.init({ mapping: "gpio" });
      // spare us the need of a wire to do this
      rpio.pud(buttonPin, rpio.PULL_DOWN);

      [statusPin, greenPin, redPin].forEach(pin => {
        rpio.open(pin, rpio.OUTPUT, rpio.LOW);
      });

      rpio.poll(buttonPin, pin => {
        try {
          rpio.msleep(20);
          const state = rpio.read(pin);
          trigger("buttonEvent", { pin, state });
        } catch (ex) {
          console.log("Button error: " + ex.message);
        }
      });

      // on startup turn on status
      setStatus(true);
      turnRedOff();
      turnGreenOff();

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
    const color = event.payload;
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

module.exports = app;
