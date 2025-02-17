"use server";

import { setServerState } from "./ServerState.js";

export async function like(): Promise<"Liked"> {
  setServerState("Liked!");
  return new Promise((resolve, reject) => resolve("Liked"));
}

export async function greet(formData): Promise<string> {
  const name = formData.get("name") || "you";
  setServerState("Hi " + name);
  const file = formData.get("file");
  if (file) {
    return `Ok, ${name}, here is ${file.name}:
      ${(await file.text()).toUpperCase()}
    `;
  }
  return "Hi " + name + "!";
}
