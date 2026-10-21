import { expect, test } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import ExcelJS from "exceljs";

test.skip(
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787" ||
    process.env.FIREBASE_PROJECT_ID !== "demo-attendance-audit" ||
    process.env.PLAYWRIGHT_BASE_URL !== "http://127.0.0.1:3100",
  "Real writes are allowed only in the isolated local audit server and emulator.",
);

test("six browser stations register together and an iPad observer sees the same progress", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const app = initializeApp(
    { projectId: "demo-attendance-audit" },
    "browser-concurrency",
  );
  const db = getFirestore(app);
  const collection = db.collection("medicalEventGuests");
  const before = await collection.get();
  const runId = Date.now().toString(36);
  const guestId = (index: number) => `browser-station-${runId}-${index}`;
  const doctorName = (index: number) =>
    `Doctora recepción simultánea ${runId} ${index}`;
  const usedTickets = new Set(
    before.docs.map((doc) => doc.data().ticketNumber),
  );
  const availableTickets = Array.from({ length: 999 }, (_, i) =>
    String(i + 1).padStart(3, "0"),
  )
    .filter((ticket) => !usedTickets.has(ticket))
    .slice(0, 6);
  expect(availableTickets).toHaveLength(6);
  const official = before.docs.filter((doc) => doc.data().isExtra !== true);
  const initialArrivals = official.filter(
    (doc) => doc.data().checkedInAt,
  ).length;
  const batch = db.batch();
  for (let i = 0; i < 6; i++)
    batch.create(collection.doc(guestId(i)), {
      doctorName: doctorName(i),
      isExtra: false,
      hasTicket: true,
      ticketNumber: null,
      checkedInAt: null,
    });
  await batch.commit();
  const stations = await Promise.all(
    Array.from({ length: 6 }, () => browser.newPage()),
  );
  const ipad = await browser.newPage({
    viewport: { width: 820, height: 1180 },
  });
  const pages = [...stations, ipad];
  try {
    await Promise.all(pages.map((page) => page.goto("/")));
    for (const page of pages)
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Conectado · Actualización en tiempo real" }),
      ).toBeVisible({ timeout: 20_000 });
    await ipad.getByRole("button", { name: "Estadísticas" }).click();
    await Promise.all(
      stations.map(async (page, i) => {
        const name = doctorName(i);
        await page.getByRole("searchbox").fill(name);
        await page
          .getByRole("row")
          .filter({ hasText: name })
          .getByRole("button", { name: "Registrar llegada" })
          .click();
        await page.getByLabel(/Número de boleto/).fill(availableTickets[i]);
      }),
    );
    await Promise.all(
      stations.map((page) =>
        page.getByRole("button", { name: "Confirmar mi llegada" }).click(),
      ),
    );
    for (const page of stations)
      await expect(
        page.getByRole("heading", { name: "¡Registro confirmado!" }),
      ).toBeVisible();
    const expected = `${initialArrivals + 6} de ${official.length + 6} médicos registrados`;
    for (const page of pages)
      await expect(page.getByText(expected, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    const saved = await Promise.all(
      Array.from({ length: 6 }, (_, i) => collection.doc(guestId(i)).get()),
    );
    expect(saved.every((doc) => doc.data()?.checkedInAt)).toBe(true);
    expect(new Set(saved.map((doc) => doc.data()?.ticketNumber)).size).toBe(6);
    await stations[0].context().setOffline(true);
    await expect(
      stations[0].getByText("Sin conexión. Conecta este equipo a internet."),
    ).toBeVisible();
    await stations[0].context().setOffline(false);
    await expect(
      stations[0]
        .getByRole("status")
        .filter({ hasText: "Conectado · Actualización en tiempo real" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      stations[0].getByText(expected, { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(pages.map((page) => page.close()));
    await deleteApp(app);
  }
});

test("an extra survives a lost POST response without creating duplicate doctors", async ({
  page,
}) => {
  const app = initializeApp(
    { projectId: "demo-attendance-audit" },
    "browser-retry",
  );
  const doctorName = `Doctora reintento de recepción ${Date.now().toString(36)}`;
  let calls = 0;
  const submissions: string[] = [];
  await page.route("**/api/admin/attendance", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submissions.push(route.request().postDataJSON().requestId);
    calls++;
    if (calls === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Registro doctor" }).click();
    await page.getByLabel(/Nombre completo del médico/).fill(doctorName);
    const button = page.getByRole("button", {
      name: /Agregar y registrar llegada/,
    });
    await button.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Revisa tu conexión" }),
    ).toBeVisible();
    await button.click();
    await expect(
      page.getByRole("heading", { name: "¡Registro confirmado!" }),
    ).toBeVisible();
    expect(calls).toBe(2);
    expect(new Set(submissions).size).toBe(1);
    const docs = await getFirestore(app)
      .collection("medicalEventGuests")
      .where("doctorName", "==", doctorName)
      .get();
    expect(docs.size).toBe(1);
    expect(docs.docs[0].data().checkedInAt).toBeTruthy();
  } finally {
    await deleteApp(app);
  }
});

test("all 570 search results fit on a phone and the browser downloads the full Excel report", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("searchbox").fill("Médico de carga");
  await expect(page.getByRole("row")).toHaveCount(571);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Estadísticas" }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar Excel", exact: true })
    .click();
  const file = await downloaded;
  expect(await file.failure()).toBeNull();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  expect(
    workbook.getWorksheet("Resumen")!.getCell("A7").value,
  ).toBeGreaterThanOrEqual(570);
  expect(
    workbook.getWorksheet("Todos los médicos")!.rowCount,
  ).toBeGreaterThanOrEqual(576);
  expect(workbook.getWorksheet("EXTRAS")).toBeDefined();
});
