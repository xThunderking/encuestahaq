import { expect, test, type Page } from "@playwright/test";

async function chooseService(page: Page, service = "Urgencias") {
  await page.getByText("Confianza en la marca", { exact: true }).click();
  await page.getByText(service, { exact: true }).click();
  if (service === "Check-up")
    await page.getByText("Check-up Femenino", { exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

test("three steps preserve answers and finish without saving", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("/");
  await page.getByText("Convenio", { exact: true }).click();
  await expect(
    page.getByText("¿Con que empresa?", { exact: true }),
  ).toBeVisible();
  await chooseService(page);
  await expect(page.getByRole("radiogroup")).toHaveCount(6);
  for (const option of await page.getByText("EXCELENTE", { exact: true }).all())
    await option.click();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(page.locator('input[value="7"]:checked')).toHaveCount(1);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(6);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator(".sd-rating label").last().click();
  await page.getByRole("textbox").fill("Buena atención durante el estudio.");
  await page.getByText("Si", { exact: true }).click();
  await expect(page.getByText("Correo", { exact: true })).toBeVisible();
  await page.getByText("No", { exact: true }).click();
  await expect(page.getByText("Correo", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(
    page.getByText("Gracias por compartir su experiencia", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("validation, Check-up branch and language change", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".sd-question--error").first()).toBeVisible();
  await chooseService(page, "Check-up");
  await expect(page.getByRole("radiogroup")).toHaveCount(8);
  await page.getByText("BUENO", { exact: true }).first().click();
  await page
    .getByRole("combobox", { name: "Idioma / Language" })
    .selectOption("en");
  await expect(
    page.getByRole("heading", { name: "How was your care?" }),
  ).toBeVisible();
  await expect(page.getByText("EXCELLENT", { exact: true })).toHaveCount(8);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
});

test("mobile has large targets and visible rating options", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await chooseService(page);
  for (const label of await page.locator(".sd-selectbase__label").all()) {
    const box = await label.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  for (const option of await page.getByText("REGULAR", { exact: true }).all())
    await option.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".sd-rating label")).toHaveCount(11);
  for (const label of await page.locator(".sd-rating label").all()) {
    const box = await label.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({
    path: "test-results/survey-mobile.png",
    fullPage: true,
  });
});
