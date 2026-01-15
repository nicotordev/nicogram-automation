import { EventEmitter } from "events";

export const eventBus = new EventEmitter();

const MAX_HISTORY = 50;
export const eventHistory: Array<{ event: string; data: any; timestamp: string; }> = [];

export function broadcast(event: string, data: any) {
  const timestamp = new Date().toISOString();
  const logEntry = { event, data, timestamp };
  eventHistory.push(logEntry);
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }
  eventBus.emit("new-event", logEntry);
}
