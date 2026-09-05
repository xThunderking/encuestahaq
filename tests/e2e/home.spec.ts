import { expect, test } from "@playwright/test";

test("contact and service branches respond without saving answers", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      writes.push(request.url());
  });
  await page.goto("/");
  await page.getByText("Si", { exact: true }).click();
  await expect(page.getByText("Correo", { exact: true })).toBeVisible();
  await page.getByText("No", { exact: true }).click();
  await expect(page.getByText("Correo", { exact: true })).not.toBeVisible();
  await page.getByText("Convenio", { exact: true }).click();
  await expect(
    page.getByText("¿Con que empresa?", { exact: true }),
  ).toBeVisible();
  await page.getByText("Confianza en la marca", { exact: true }).click();
  await expect(
    page.getByText("¿Con que empresa?", { exact: true }),
  ).not.toBeVisible();
  await page.getByText("Check-up", { exact: true }).click();
  await expect(
    page.getByText("Check-up Femenino", { exact: true }),
  ).toBeVisible();
  await page.getByText("Laboratorio", { exact: true }).click();
  await expect(
    page.getByText("Check-up Femenino", { exact: true }),
  ).not.toBeVisible();
  const groups = page.getByRole("radiogroup");
  for (const group of await groups.all()) {
    const radios = group.getByRole("radio");
    if ((await radios.count()) === 5 || (await radios.count()) === 11) {
      await radios.last().check({ force: true });
    }
  }
  await page.getByRole("textbox").fill("Buena atención durante el estudio.");
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(
    page.getByText("Gracias por compartir su experiencia", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByText("Convenio", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("language selector and required validation work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(page.locator(".sd-question--error").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Idioma / Language" })
    .selectOption("en");
  await expect(
    page.getByText("Would you like to leave us your contact information?", {
      exact: true,
    }),
  ).toBeVisible();
});

test("mobile displays every rating option within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const rating = page.locator(".sd-rating");
  await expect(rating.getByRole("radio")).toHaveCount(11);
  for (const option of await rating.locator("label").all()) {
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({
    path: "test-results/survey-mobile.png",
    fullPage: true,
  });
});
