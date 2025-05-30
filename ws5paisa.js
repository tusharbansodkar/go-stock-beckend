const WebSocket = require("ws");
const fs = require("fs");
require("dotenv").config();

const token = fs.readFileSync("./token.txt", "utf8");

let ws5paisa;
let socketIO;
let latestMarketData = {};
const allowdScrip = new Set([
  999901, 999920041, 999920000, 999920005, 999920008,
]);
let currentSubscription = [];

function init(socket) {
  socketIO = socket;
  connectTo5paisa();
}

function update5paisaSubscription(dataToFetch) {
  currentSubscription = dataToFetch;

  if (ws5paisa && ws5paisa.readyState === WebSocket.OPEN) {
    const subscriptionPayload = {
      Method: "MarketFeedV3",
      Operation: "Subscribe",
      ClientCode: `${process.env.FIVEPAISA_CLIENT_CODE}`,
      MarketFeedData: currentSubscription,
    };

    ws5paisa.send(JSON.stringify(subscriptionPayload));
  }
}

function connectTo5paisa() {
  ws5paisa = new WebSocket(
    `wss://openfeed.5paisa.com/feeds/api/chat?Value1=${token}|${process.env.FIVEPAISA_CLIENT_CODE}`
  );

  ws5paisa.on("open", () => {
    console.log("Connected to 5Paisa WebSocket");

    // Subscribe to market data
    const subsciptionPayload = {
      Method: "MarketFeedV3",
      Operation: "Subscribe",
      ClientCode: `${process.env.FIVEPAISA_CLIENT_CODE}`,
      MarketFeedData:
        currentSubscription.length > 0
          ? currentSubscription
          : [
              { Exch: "B", ExchType: "C", ScripCode: 999901 },
              { Exch: "N", ExchType: "C", ScripCode: 999920041 },
            ],
    };

    ws5paisa.send(JSON.stringify(subsciptionPayload));
  });

  ws5paisa.on("message", (bufferData) => {
    const jsonString = [bufferData.toString("utf-8")];
    // console.log("Received data from 5Paisa:", jsonString);

    try {
      const parsed = JSON.parse(jsonString);

      const items = Array.isArray(parsed) ? parsed : [parsed];

      items.forEach((item) => {
        let scrip = item.Token;

        if (allowdScrip.has(scrip)) {
          latestMarketData[scrip] = item;

          socketIO.sockets.emit("marketData", item);
        }
      });
    } catch (error) {
      console.log("Failed to parse json string:", error);
    }
  });

  ws5paisa.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws5paisa.on("close", () => {
    console.warn("Reconnecting to 5paisa...");
    setTimeout(connectTo5paisa, 3000);
  });
}

module.exports = {
  init,
  getMarketData: () => latestMarketData,
  update5paisaSubscription,
};
