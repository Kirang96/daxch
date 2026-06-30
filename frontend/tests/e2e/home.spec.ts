import { test, expect } from "@playwright/test";

test("home page renders primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /AI watches your stocks/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible();
});

