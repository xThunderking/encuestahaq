import { expect, test } from "@playwright/test";

test("shows Google administrator login before the email code step", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Panel de encuestas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
});
