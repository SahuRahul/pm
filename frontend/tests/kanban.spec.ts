import { expect, test } from "@playwright/test";

const login = async (page: any) => {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url: URL) => !url.pathname.endsWith("/login"));
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
};

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("logs in and shows the kanban board", async ({ page }) => {
  await login(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("logs out and returns to login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("adds a card and persists after reload", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const title = `Playwright card ${Date.now()}`;
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(title)).toBeVisible();

  await page.reload();
  await expect(page.getByText(title)).toBeVisible();
});

test("renames a column and persists after reload", async ({ page }) => {
  await login(page);
  const columnInput = page.getByLabel("Column title").first();
  const newName = `Backlog ${Date.now()}`;
  await columnInput.fill(newName);
  await page.reload();
  await expect(page.getByLabel("Column title").first()).toHaveValue(newName);
});

test("moves a card between columns and persists", async ({ page }) => {
  await login(page);
  const columns = page.locator('[data-testid^="column-"]');
  const sourceColumn = columns.first();
  const targetColumn = columns.nth(1);
  const title = `Move card ${Date.now()}`;

  await sourceColumn.getByRole("button", { name: /add a card/i }).click();
  await sourceColumn.getByPlaceholder("Card title").fill(title);
  await sourceColumn.getByRole("button", { name: /add card/i }).click();
  await expect(sourceColumn.getByText(title)).toBeVisible();

  const card = page.getByText(title).locator("xpath=ancestor::article");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByText(title)).toBeVisible();

  await page.reload();
  const reloadedTarget = page.locator('[data-testid^="column-"]').nth(1);
  await expect(reloadedTarget.getByText(title)).toBeVisible();
});
