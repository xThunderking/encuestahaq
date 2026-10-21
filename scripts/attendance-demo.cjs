/* eslint @typescript-eslint/no-require-imports: "off" -- Standalone script executed directly by Node.js. */
const { loadEnvConfig } = require("@next/env");
void loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const {
  FieldValue,
  Timestamp,
  getFirestore,
} = require("firebase-admin/firestore");

const seedTag = "attendance-dia-medico-demo-v1";
const names = [
  "PRUEBA · Dra. Ana Sofía Martínez López",
  "PRUEBA · Dr. Carlos Alberto Ramírez Soto",
  "PRUEBA · Dra. Gabriela Torres Medina",
  "PRUEBA · Dr. José Luis Hernández Díaz",
  "PRUEBA · Dra. María Fernanda Castillo Ruiz",
  "PRUEBA · Dr. Roberto Sánchez Aguilar",
  "PRUEBA · Dra. Fernanda de la Cruz",
  "PRUEBA · Dr. Eduardo O'Farrill Hernández",
  "PRUEBA · Dra. Liliana Rodríguez Espinoza",
  "PRUEBA · Dr. Miguel Ángel Castañeda",
  "PRUEBA · Dra. Paula Jiménez de la Rosa",
  "PRUEBA · Dr. Héctor de León",
  "PRUEBA · Dra. Daniela Pérez de Alba",
  "PRUEBA · Dr. Juan Pablo Salcedo Navarro",
  "PRUEBA · Dra. Mónica Núñez Villaseñor",
  "PRUEBA · Dr. Rafael García Méndez",
  "PRUEBA · Dra. Ximena Ríos Arredondo",
  "PRUEBA · Dr. Andrés Téllez Orduña",
  "PRUEBA · Dra. Verónica del Valle",
  "PRUEBA · Dr. Ricardo Villalpando Robles",
];
const registeredIndexes = new Set([0, 1, 2, 7, 13]);
const demoRows = names.map((doctorName, index) => {
  const sequence = String(index + 1).padStart(4, "0");
  const hasTicket = index % 4 !== 1;
  const checkedInAt = registeredIndexes.has(index)
    ? Timestamp.fromDate(new Date(Date.now() - (index + 1) * 60_000))
    : null;
  return {
    id: `attendance-dia-medico-demo-${sequence}`,
    data: {
      doctorName,
      isExtra: false,
      hasTicket,
      ticketNumber: null,
      ticketNumberNormalized: null,
      checkedInAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      testSeed: seedTag,
    },
  };
});

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || undefined;
  const app = initializeApp({ projectId, credential: applicationDefault() });
  const db = getFirestore(app);
  const collection = db.collection("medicalEventGuests");
  const refs = demoRows.map(({ id }) => collection.doc(id));
  const [action, confirmation] = process.argv.slice(2);

  try {
    if (action === "seed") {
      const existing = await Promise.all(refs.map((ref) => ref.get()));
      const collision = existing.find(
        (doc) => doc.exists && doc.data()?.testSeed !== seedTag,
      );
      if (collision) {
        throw new Error(
          "Un ID de prueba ya pertenece a otro registro; no se escribió ningún dato.",
        );
      }
      const batch = db.batch();
      demoRows.forEach(({ data }, index) => batch.set(refs[index], data));
      await batch.commit();
      const withTicket = demoRows.filter(({ data }) => data.hasTicket).length;
      console.log(
        `Creados ${demoRows.length} registros ficticios con prefijo PRUEBA en ${projectId ?? "el proyecto de Firebase configurado"}.`,
      );
      console.log(
        `${registeredIndexes.size} registrados · ${demoRows.length - registeredIndexes.size} pendientes · ${withTicket} con boleto · ${demoRows.length - withTicket} sin boleto.`,
      );
      console.log(
        "Cada prueba tiene un ID propio; puedes ejecutar seed de nuevo o retirarlas con clear --confirm.",
      );
      return;
    }

    if (action === "clear" && confirmation === "--confirm") {
      const snapshots = await Promise.all(refs.map((ref) => ref.get()));
      const taggedDocs = snapshots.filter(
        (doc) => doc.exists && doc.data()?.testSeed === seedTag,
      );
      if (taggedDocs.length) {
        const batch = db.batch();
        taggedDocs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log(
        `Retirados ${taggedDocs.length} registros de prueba. Los demás invitados se conservaron.`,
      );
      return;
    }

    if (action === "verify") {
      const snapshot = await collection.where("testSeed", "==", seedTag).get();
      const records = snapshot.docs.map((doc) => doc.data());
      const withTicket = records.filter((doc) => doc.hasTicket === true).length;
      const checkedIn = records.filter(
        (doc) => doc.checkedInAt !== null,
      ).length;
      const allClearlyMarked = records.every(
        (doc) =>
          typeof doc.doctorName === "string" &&
          doc.doctorName.startsWith("PRUEBA · "),
      );
      if (records.length !== 20 || !allClearlyMarked) {
        throw new Error(
          `La verificación encontró ${records.length} registros de prueba; deben ser 20 y estar marcados PRUEBA.`,
        );
      }
      console.log(
        `Verificados ${records.length} médicos ficticios · ${checkedIn} registrados · ${records.length - checkedIn} pendientes · ${withTicket} con boleto · ${records.length - withTicket} sin boleto.`,
      );
      return;
    }

    console.error(
      "Uso: node scripts/attendance-demo.cjs seed | verify | clear --confirm",
    );
    process.exitCode = 1;
  } finally {
    await app.delete();
  }
}

main().catch((error) => {
  console.error(
    "No se pudieron actualizar los registros de prueba:",
    error.message,
  );
  process.exitCode = 1;
});
