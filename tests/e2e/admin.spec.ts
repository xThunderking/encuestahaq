import { expect, test } from "@playwright/test";

test("the disabled survey admin route returns to the attendance system", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "Lista de invitados desayuno evento Día del Médico",
    }),
  ).toBeVisible();
});
