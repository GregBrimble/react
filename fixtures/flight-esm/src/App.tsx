import Button from "./Button.js";
import Form from "./Form.js";

import { like, greet } from "./actions.js";

import { getServerState } from "./ServerState.js";

const importMap = {
  imports: {
    react: "https://esm.sh/react@experimental?pin=v124&dev",
    "react/jsx-runtime":
      "https://esm.sh/react@experimental?pin=v124&dev/jsx-runtime",
    "react-dom": "https://esm.sh/react-dom@experimental?pin=v124&dev",
    "react-dom/": "https://esm.sh/react-dom@experimental&pin=v124&dev/",
    "react-server-dom-esm/client":
      "/nm/react-server-dom-esm/esm/react-server-dom-esm-client.browser.development.js",
  },
};

export default async function App() {
  const res = await fetch("http://localhost:3001/todos");
  const todos = await res.json();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flight</title>
        <link rel="stylesheet" href="/src/style.css" />
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(importMap),
          }}
        />
      </head>
      <body>
        <div>
          <h1>{getServerState()}</h1>
          <ul>
            {todos.map((todo) => (
              <li key={todo.id}>{todo.text}</li>
            ))}
          </ul>
          <Form action={greet} />
          <div>
            <Button action={like}>Like</Button>
          </div>
        </div>
        {/* TODO: Move this to bootstrapModules. */}
        <script type="module" src="/src/index.js" />
      </body>
    </html>
  );
}
