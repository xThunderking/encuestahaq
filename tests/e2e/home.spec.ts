import { expect, test } from "@playwright/test";

test("shows the event welcome, navigation and live attendance status", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "¡Bienvenido al Día del Médico!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toContainText("Registro doctor");
  await expect(page.getByText(/de \d+ médicos registrados/)).toBeVisible();
  await expect(
    page.getByRole("status").filter({
      hasText: "Conectado · Actualización en tiempo real",
    }),
  ).toBeVisible({ timeout: 20_000 });
});

test("keeps six registration computers and an iPad-sized screen connected", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const pages = await Promise.all(
    Array.from({ length: 6 }, () => browser.newPage()),
  );
  const ipad = await browser.newPage({
    viewport: { width: 820, height: 1180 },
  });
  pages.push(ipad);

  try {
    await Promise.all(pages.map((page) => page.goto("/")));
    for (const page of pages) {
      await expect(
        page.getByRole("status").filter({
          hasText: "Conectado · Actualización en tiempo real",
        }),
      ).toBeVisible({ timeout: 20_000 });
    }
  } finally {
    await Promise.all(pages.map((page) => page.close()));
  }
});

test("search and navigation work without writing event data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", {
      name: "Buscar médico por nombre, apellidos o boleto",
    })
    .fill("__prueba_sin_coincidencias__");
  await expect(
    page.getByRole("heading", { name: "Encuentra tu nombre" }),
  ).toBeVisible();
  await expect(page.getByText("No encontramos coincidencias")).toBeVisible();

  await page
    .getByRole("button", { name: "Registro doctor", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Registro doctor", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/Nombre completo del médico/)).toBeVisible();

  await page.getByRole("button", { name: "Estadísticas" }).click();
  await expect(
    page.getByRole("heading", { name: "Estadísticas de asistencia" }),
  ).toBeVisible();
});

test("confirms an extra and returns to the registration form after five seconds", async ({
  page,
}) => {
  await page.route("**/api/admin/attendance", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "extra-test-doctor" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Registro doctor" }).click();
  await page
    .getByLabel(/Nombre completo del médico/)
    .fill("Doctora de prueba extra");
  await page
    .getByRole("button", { name: /Agregar y registrar llegada/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "¡Registro confirmado!" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Volveremos al registro en 5 segundos para continuar con el siguiente médico.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registro doctor", exact: true }),
  ).toBeVisible({ timeout: 8_000 });
  await expect(page.getByLabel(/Nombre completo del médico/)).toHaveValue("");
});

test("records a ticketed guest without a ticket number and shows the confirmation", async ({
  page,
}) => {
  const doctorName = "Dra. Invitada Boleto E2E";
  await page.addInitScript(() => {
    class MockEventSource extends EventTarget {
      onerror: ((event: Event) => void) | null = null;

      constructor() {
        super();
        queueMicrotask(() => {
          this.dispatchEvent(
            new MessageEvent("guests", {
              data: JSON.stringify([
                {
                  id: "ticket-doctor-e2e",
                  doctorName: "Dra. Invitada Boleto E2E",
                  isExtra: false,
                  hasTicket: true,
                  ticketNumber: null,
                  checkedInAt: null,
                },
              ]),
            }),
          );
        });
      }

      close() {}
    }

    Object.defineProperty(window, "EventSource", {
      configurable: true,
      value: MockEventSource,
    });
  });
  await page.route("**/api/admin/attendance", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ registered: true, alreadyRegistered: false }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("searchbox").fill(doctorName);
  const guestRow = page.getByRole("row").filter({ hasText: doctorName });
  await guestRow.getByRole("button", { name: "Registrar llegada" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirma tu boleto" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "No traigo boleto" }),
  ).toBeVisible();

  const patchRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/api/admin/attendance"),
  );
  await page.getByRole("button", { name: "No traigo boleto" }).click();
  const request = await patchRequest;
  expect(request.postDataJSON()).toEqual({
    id: "ticket-doctor-e2e",
    action: "check-in-no-ticket",
  });
  await expect(
    page.getByRole("heading", { name: "¡Registro confirmado!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "¡Bienvenido al Día del Médico!" }),
  ).toBeVisible({ timeout: 8_000 });
});

test("does not overflow narrow and rotated screens", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 667, height: 375 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "¡Bienvenido al Día del Médico!" }),
    ).toBeVisible();
    if (viewport.width <= 700) {
      await expect
        .poll(() =>
          page
            .locator("header p")
            .first()
            .evaluate((element) => getComputedStyle(element).textAlign),
        )
        .toBe("center");
    }
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
});
