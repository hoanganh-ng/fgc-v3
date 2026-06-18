import { expect, test } from "@playwright/test";
import {
  buildCategoryFixture,
  buildRunStamp,
  buildSourceGroupFixture,
} from "./fixtures/synthetic-payloads";

/**
 * Sprint 062 baseline E2E flow.
 *
 * Proves the production-like stack works end-to-end through Nginx → API →
 * migrations → PostgreSQL using only synthetic fixtures. All API traffic
 * goes through `web-gateway`; the spec never references the API service
 * directly and never uses a host port.
 */
test.describe("Sprint 062 — Docker E2E baseline", () => {
  const runStamp = buildRunStamp();
  const category = buildCategoryFixture(runStamp);
  let categoryId = "";
  let sourceGroupId = "";

  test("production React app loads through web-gateway", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "page.goto('/') returned a response").not.toBeNull();
    expect(response?.status() ?? 0, "root returns HTTP 200").toBe(200);
    await expect(page).toHaveTitle(/Content Pipeline Dashboard/i);
  });

  test("direct /source-groups navigation returns the SPA", async ({ page }) => {
    const response = await page.goto("/source-groups");
    expect(response, "page.goto('/source-groups') returned a response").not.toBeNull();
    expect(response?.status() ?? 0, "/source-groups returns HTTP 200").toBe(200);
    // The React app shell mounts under #root; the SPA fallback means the
    // document loads even before any client routing has rendered.
    await expect(page.locator("#root")).toBeAttached();
    await expect(page).toHaveTitle(/Content Pipeline Dashboard/i);
  });

  test("create synthetic category through web-gateway", async ({ request }) => {
    const response = await request.post("/collector/content-categories", {
      data: category,
    });
    expect(response.status(), "POST /collector/content-categories").toBe(201);
    const body = await response.json();
    expect(body.category, "response carries a category DTO").toBeDefined();
    expect(body.category.slug, "category slug matches fixture").toBe(category.slug);
    expect(body.category.name, "category name matches fixture").toBe(category.name);
    categoryId = body.category.id;
    expect(categoryId, "category id is non-empty").toBeTruthy();
  });

  test("create synthetic source group through web-gateway", async ({ request }) => {
    expect(categoryId, "category id from previous step").toBeTruthy();
    const group = buildSourceGroupFixture(runStamp, categoryId);
    const response = await request.post("/collector/source-groups", {
      data: group,
    });
    expect(response.status(), "POST /collector/source-groups").toBe(201);
    const body = await response.json();
    expect(body.sourceGroup, "response carries a source group DTO").toBeDefined();
    expect(body.sourceGroup.externalGroupId).toBe(group.externalGroupId);
    expect(body.sourceGroup.categoryId).toBe(categoryId);
    sourceGroupId = body.sourceGroup.id;
    expect(sourceGroupId, "source group id is non-empty").toBeTruthy();
  });

  test("read source group back through web-gateway", async ({ request }) => {
    expect(sourceGroupId, "source group id from previous step").toBeTruthy();
    const response = await request.get(
      `/collector/source-groups/${encodeURIComponent(sourceGroupId)}`,
    );
    expect(response.status(), "GET /collector/source-groups/:id").toBe(200);
    const body = await response.json();
    expect(body.sourceGroup, "response carries a source group DTO").toBeDefined();
    expect(body.sourceGroup.id).toBe(sourceGroupId);
    expect(body.sourceGroup.name).toBe(
      `Sprint 062 Source Group ${runStamp}`,
    );
    expect(body.sourceGroup.categoryId).toBe(categoryId);
  });

  test("/source-groups in Chromium shows the new group", async ({ page }) => {
    expect(sourceGroupId, "source group id from previous step").toBeTruthy();
    await page.goto("/source-groups");
    const groupName = `Sprint 062 Source Group ${runStamp}`;
    // Accessible selectors first; the source-groups page renders the group
    // name as visible text in the source group list.
    await expect(page.getByText(groupName)).toBeVisible();
  });

  test("reload /source-groups still shows the new group", async ({ page }) => {
    expect(sourceGroupId, "source group id from previous step").toBeTruthy();
    await page.goto("/source-groups");
    const groupName = `Sprint 062 Source Group ${runStamp}`;
    await expect(page.getByText(groupName)).toBeVisible();
    await page.reload();
    await expect(page.getByText(groupName)).toBeVisible();
  });
});