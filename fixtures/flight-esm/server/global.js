"use strict";

// This is a server to host CDN distributed resources like module source files and SSR

const url = require("url");

const compress = require("compression");
const express = require("express");

const { renderToPipeableStream } = require("react-dom/server");
const { createFromFetch } = require("react-server-dom-esm/client.browser");
const {
  nodeRequestBodyToReadableStream,
  responseToNodeResponse,
} = require("./utils");

const moduleBasePath = new URL("../bang3/src", url.pathToFileURL(__filename))
  .href;

const app = express();

app.use(compress());

app.all("/", async function (req, res) {
  const dataResponsePromise = fetch("http://127.0.0.1:3001/", {
    method: req.method,
    headers: {
      "Content-Type": req.get("Content-Type"),
      "RSC-Action": req.get("RSC-Action"),
    },
    body: await nodeRequestBodyToReadableStream(req),
  });

  if (req.accepts("text/html")) {
    try {
      // For HTML, we're a "client" emulator that runs the client code,
      // so we start by consuming the RSC payload. This needs the local file path
      // to load the source files from as well as the URL path for preloads.
      const root = await createFromFetch(dataResponsePromise, {
        moduleBaseURL: moduleBasePath,
      });
      // Render it into HTML by resolving the client components
      res.set("Content-type", "text/html");
      const { pipe } = renderToPipeableStream(root, {
        // TODO: bootstrapModules inserts a preload before the importmap which causes
        // the import map to be invalid. We need to fix that in Float somehow.
        // bootstrapModules: ['/src/index.js'],
      });
      pipe(res);
    } catch (e) {
      console.error(`Failed to SSR: ${e.stack}`);
      res.statusCode = 500;
      res.end();
    }
  } else {
    try {
      const rscResponse = await dataResponsePromise;
      // For other request, we pass-through the RSC payload.
      res.set("Content-type", "text/x-component");
      responseToNodeResponse(rscResponse, res);
    } catch (e) {
      console.error(`Failed to proxy request: ${e.stack}`);
      res.statusCode = 500;
      res.end();
    }
  }
});

app.use(express.static("bang3"));

app.listen(3000, () => {
  console.log("Global Fizz/Webpack Server listening on port 3000...");
});

app.on("error", function (error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  switch (error.code) {
    case "EACCES":
      console.error("port 3000 requires elevated privileges");
      process.exit(1);
    case "EADDRINUSE":
      console.error("Port 3000 is already in use");
      process.exit(1);
    default:
      throw error;
  }
});
