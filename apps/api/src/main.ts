import { consola } from "consola";
import { startServer } from "./server/server.js";

// Start the server
startServer(3000);

consola.box("Server started. Open http://localhost:3000 to control.");