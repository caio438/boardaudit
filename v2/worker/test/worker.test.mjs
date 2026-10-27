import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.mjs";

test("health endpoint is available without database", async () => {
  const response = await handleRequest(new Request("https://v2.example/health"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).service, "volum-sales-ops-v2");
});

test("protects configured worker with API key", async () => {
  const request = new Request("https://v2.example/health", {
    headers: { "x-volum-api-key": "wrong" }
  });
  const response = await handleRequest(request, { VOLUM_API_KEY: "right" });
  assert.equal(response.status, 401);
});

test("does not expose routes without D1", async () => {
  const response = await handleRequest(new Request("https://v2.example/v2/clients/acme"), {});
  assert.equal(response.status, 503);
});
