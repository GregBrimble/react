let serverState = "Hello World";

export function setServerState(message: string) {
  serverState = message;
}

export function getServerState(): string {
  return serverState;
}
