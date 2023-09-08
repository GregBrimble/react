"use strict";

// This is a server to host CDN distributed resources like module source files and SSR

import { mediaType } from "@hapi/accept";
import { renderToReadableStream } from "react-dom/server.edge";
import { createFromFetch } from "react-server-dom-esm/client.browser";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const dataResponsePromise = fetch("http://127.0.0.1:3001/", {
        method: request.method,
        headers: {
          "Content-Type": request.headers.get("Content-Type"),
          "RSC-Action": request.headers.get("RSC-Action"),
        },
        body: request.body,
      });

      if (mediaType(request.headers.get("Accept"), ["text/html"])) {
        try {
          const root = await createFromFetch(dataResponsePromise, {
            moduleBaseURL: "/src",
          });
          return new Response(await renderToReadableStream(root), {
            headers: { "Content-Type": "text/html" },
          });
        } catch (e) {
          console.error(`Failed to SSR: ${e.stack}`);
          return new Response(null, { status: 500 });
        }
      } else {
        try {
          const rscResponse = await dataResponsePromise;
          return new Response(rscResponse.body, {
            headers: { "Content-Type": "text/x-component" },
          });
        } catch (e) {
          console.error(`Failed to proxy request: ${e.stack}`);
          return new Response(null, { status: 500 });
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
} as ExportedHandler<{ ASSETS: Fetcher }>;
