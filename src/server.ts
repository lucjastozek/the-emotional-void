import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

const arduinoPort = new SerialPort({
  path: "COM5",
  baudRate: 9600,
});

const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

const wss = new WebSocketServer({ port: 8080 });
console.log("WebSocket server running on ws://localhost:8080");

parser.on("data", (line: string) => {
  console.log("Arduino:", line.trim());
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send(line.trim());
    }
  });
});

arduinoPort.on("error", (err) => {
  console.error("Serial error:", err.message);
});
