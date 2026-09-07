import { expect, test } from "@playwright/test";

test("protects the survey dashboard with an administrator login", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Panel de encuestas" }),
  ).toBeVisible();

  await page.getByLabel("Usuario").fill("Admin");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Usuario o contraseña incorrectos",
  );

  await page.getByLabel("Contraseña").fill("Admin");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("heading", { name: "Respuestas recientes" }),
  ).toBeVisible();
  await expect(page.getByText("Total de respuestas")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Usuario")).toBeVisible();
});
