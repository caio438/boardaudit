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


class MockDb {
  prepare(sql) {
    return {
      bind: (...args) => ({
        all: async () => sql.includes("audit_client_rollups")
          ? { results: [{ tenant_id: "acme", client_name: "Acme", total_audits: 2, total_plans: 1, open_plans: 1, distinct_deals: 1, by_agent_json: "{}", by_status_json: "{}", by_period_json: "{}", plan_summary_json: "{}" }] }
          : { results: [] },
        run: async () => ({ success: true, args })
      })
    };
  }
}

test("returns persisted client rollups", async () => {
  const response = await handleRequest(new Request("https://v2.example/v2/aggregate"), { DB: new MockDb() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).clients[0].tenantId, "acme");
});

test("accepts normalized CRM snapshot and timeline events", async () => {
  const request = new Request("https://v2.example/v2/snapshots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantId: "acme",
      deal: { id: "deal-1", currentStage: { volumPhase: "CONEXAO" } },
      events: [{ id: "event-1", type: "NOTE", source: "CRM" }],
      coverage: { complete: true }
    })
  });
  const response = await handleRequest(request, { DB: new MockDb() });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).snapshot.events, 1);
});
