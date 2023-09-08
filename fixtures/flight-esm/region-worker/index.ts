"use strict";

// This is a server to host data-local resources like databases and RSC

import * as React from "react";

const moduleBasePath = "/src";

async function renderApp(returnValue) {
  const { renderToReadableStream } = await import(
    "./react-server-dom-greg-server.js"
  );
  const m = await import("./src/App.js");

  const App = m.default;
  const root = React.createElement(App);
  // For client-invoked server actions we refresh the tree and return a return value.
  const payload = returnValue ? { returnValue, root } : root;
  return renderToReadableStream(payload, moduleBasePath);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      switch (request.method.toLowerCase()) {
        case "get": {
          const readableStream = await renderApp(null);
          return new Response(readableStream);
        }
        case "post": {
          const { decodeReply, decodeAction } = await import(
            "./react-server-dom-greg-server.js"
          );
          const serverReference = request.headers.get("RSC-Action");
          if (serverReference) {
            // This is the client-side case
            const [filepath, name] = serverReference.split("#");
            const action = (await import(filepath))[name];
            // Validate that this is actually a function we intended to expose and
            // not the client trying to invoke arbitrary functions. In a real app,
            // you'd have a manifest verifying this before even importing it.
            if (action.$$typeof !== Symbol.for("react.server.reference")) {
              throw new Error("Invalid action");
            }

            let args;
            if (
              request.headers
                .get("Content-Type")
                .includes("multipart/form-data")
            ) {
              // TODO
            } else {
              // TODO
            }
            const result = action.apply(null, args);
            try {
              // Wait for any mutations
              await result;
            } catch (x) {
              // We handle the error on the client
            }
            // Refresh the client and return the value
            const readableStream = await renderApp(result);
            return new Response(readableStream);
          } else {
            const fakeRequest = new Request("http://localhost", {
              method: "POST",
              headers: {
                "Content-Type": request.headers.get("Content-Type"),
              },
              body: request.body,
              // TODO: duplex: "half",
            });
            const formData = await fakeRequest.formData();
            const action = decodeAction(formData, moduleBasePath);
            try {
              // Wait for any mutations
              await action();
            } catch (x) {
              const { setServerState } = await import("./src/ServerState.js");
              setServerState("Error: " + x.message);
            }
            const readableStream = await renderApp(null);
            return new Response(readableStream);
          }
        }
      }
    } else if (url.pathname === "/todos") {
      return Response.json([
        { id: 1, text: "Shave yaks" },
        { id: 2, text: "Eat kale" },
      ]);
    }

    return new Response(null, { status: 404 });
  },
} as ExportedHandler;
