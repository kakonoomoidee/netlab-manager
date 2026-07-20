const express = require("express");
const path = require("path");
const session = require("express-session");
const { initDatabase } = require("./database/db");

/**
 * Starts the NetLab Manager Express application server.
 * @param {number} port - The port number where the server will listen for requests.
 * @returns {void}
 */
function startServer(port) {
  const app = express();
  const dbPath = path.join(__dirname, "database", "netlab.sqlite");

  initDatabase(dbPath);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: "netlab-secret-key",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.get("/", (req, res) => {
    res.render("dashboard", { title: "NetLab Manager" });
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer(3000);
