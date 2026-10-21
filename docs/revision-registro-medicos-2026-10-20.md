# Revisión del registro de médicos

Fecha: 20 de octubre de 2026. Escenario solicitado: 570 invitados oficiales, seis equipos de registro y una pantalla de iPad para observar el avance.

## Resultado

Las pruebas finalizaron con 80 casos unitarios, cinco casos de integración con Firestore y 10 casos de navegador aprobados. La compilación de producción, TypeScript y ESLint pasaron.

La carga de 570 llegadas se procesó mediante seis trabajadores simultáneos. Las siete conexiones recibieron finalmente los mismos 570 registros. Se comprobaron 513 números de boleto distintos y 57 llegadas mediante «No traigo boleto».

Las pruebas de integración y las escrituras de los navegadores utilizaron exclusivamente `demo-attendance-audit`, en el emulador local `127.0.0.1:8787`. Cada suite impide escribir si el proyecto o el servidor no coinciden con este entorno aislado.

## Problemas corregidos

1. **Contención al registrar boletos.** La transacción consultaba la colección de invitados para buscar números coincidentes. La prueba simultánea produjo esperas por bloqueos. La reserva única de cada boleto ahora se consulta y crea dentro de la misma transacción que confirma la llegada, sin consultar otros invitados. Todos los puntos activos que asignan números usan esta reserva; la importación y los extras se crean sin número.
2. **Retraso entre conexiones.** Siete suscripciones independientes de Firestore acumulaban actualizaciones durante la ráfaga de carga. Ahora cada instancia del servidor comparte una suscripción y distribuye sus cambios por las conexiones SSE de los equipos. La última desconexión libera la suscripción y su estado; una falla permite abrir una nueva suscripción.
3. **Extras duplicados al reintentar un envío.** Cada envío del formulario conserva un identificador de solicitud. El servidor crea el extra en una referencia estable mediante una transacción; si se pierde la respuesta, el reintento devuelve el mismo registro. Dos envíos con datos distintos no pueden reutilizar esa solicitud. Esto protege el reintento del mismo envío; no equivale a deduplicar personas por nombre entre envíos independientes.
4. **Botones bloqueados por una solicitud sin respuesta.** El registro de llegadas y extras tiene un plazo de 25 segundos y un mensaje para volver a intentarlo. Un bloqueo inmediato en el navegador impide enviar otra operación mientras se guarda. Las respuestas HTML o JSON incompletas no generan una confirmación de asistencia.
5. **Recuperación de la carga inicial.** Se agregó una pantalla con «Volver a intentar» cuando falla la carga de la aplicación. Utiliza la API `retry` documentada por la versión instalada de Next.js.
6. **Datos y rutas inválidos.** Se rechazaron identificadores con rutas inválidas y se verificó el formato exacto de los boletos: tres dígitos ASCII de `001` a `999`. El formulario no precarga números antiguos que incumplen este formato. El script de demostración genera médicos sin boletos asignados para conservar la integridad de las reservas.

La reserva individual sigue el modelo de escritura atómica de [transacciones de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions). La [documentación de contención](https://firebase.google.com/docs/firestore/transaction-data-contention) explica los bloqueos y reintentos de las bibliotecas del servidor.

## Casos comprobados

| Caso                                                                          | Resultado                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 570 llegadas mediante seis trabajadores                                       | 570 confirmadas; ninguna respuesta fallida                                               |
| Siete conexiones SSE durante la carga                                         | Las siete terminaron con 570 de 570                                                      |
| Seis intentos para el mismo médico                                            | Una llegada nueva; cinco respuestas de ya registrado                                     |
| Seis médicos intentando el mismo boleto                                       | Uno aceptado y cinco conflictos; una sola reserva                                        |
| Seis extras diferentes simultáneos                                            | Seis documentos independientes                                                           |
| Seis reintentos del mismo envío de extra                                      | Un solo documento                                                                        |
| Respuesta POST perdida en el navegador                                        | El reintento conservó el identificador y no duplicó el extra                             |
| Boletos `001` y `999`                                                         | Aceptados con formato conservado                                                         |
| `000`, longitudes incorrectas, letras, negativos, espacios y dígitos no ASCII | Rechazados antes de la transacción                                                       |
| Médico con boleto que elige «No traigo boleto»                                | Llegada sin número y confirmación normal                                                 |
| Cancelación con información desactualizada                                    | Rechazada para proteger el registro de otro equipo                                       |
| Importación de Excel con 570 médicos                                          | 570 agregados; procesados en bloques compatibles con Firestore                           |
| Repetición de la importación después de registrar las 570 llegadas            | Cero duplicados; se conservaron las 570 asistencias                                      |
| Exportación de Excel completa                                                 | Totales, asistencias, pendientes y boletos consistentes                                  |
| Seis navegadores registrando por HTTP y una pantalla de iPad                  | Mismo avance en las siete pantallas                                                      |
| Desconexión y reconexión de un navegador                                      | Recuperó la conexión y el avance correcto                                                |
| Tabla con los 570 resultados en un teléfono de 390 px                         | Sin desbordamiento horizontal                                                            |
| Descarga de Excel desde el navegador                                          | Archivo válido y apartado `EXTRAS` presente                                              |
| Retorno tras la confirmación                                                  | El invitado vuelve a bienvenida; el extra vuelve al formulario después de cinco segundos |

## Medición de la carga local

Última ejecución completa del escenario de 570 médicos:

| Medición                                                                    |   Valor |
| --------------------------------------------------------------------------- | ------: |
| Trabajadores simultáneos                                                    |       6 |
| Conexiones observando                                                       |       7 |
| Solicitudes exitosas                                                        |     570 |
| Solicitudes fallidas                                                        |       0 |
| Duración de las solicitudes, incluida la conexión inicial de las pantallas  | 5.575 s |
| Mediana por registro                                                        |   57 ms |
| Percentil 95 por registro                                                   |   81 ms |
| Máximo por registro                                                         |  101 ms |
| Tiempo adicional hasta el último estado coincidente en las siete conexiones | 7.376 s |

Esta ráfaga envió la lista completa continuamente, sin esperar los cinco segundos de la animación entre médicos. Los tiempos corresponden a procesos en una misma computadora y no predicen la latencia del alojamiento o del internet del evento. La prueba de seis navegadores y una pantalla de iPad verificó también las solicitudes HTTP y la interfaz; el iPad se simuló mediante su tamaño de pantalla, no mediante hardware físico. Las [limitaciones del emulador](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production) impiden equiparar estos tiempos con producción.

## Estado de la base real

Proyecto: `encuestashaq`. Base `(default)`, Firestore Standard, región `northamerica-south1`.

Se encontraron 570 médicos oficiales, sin nombres repetidos después de normalizar acentos, espacios y mayúsculas. Se detectaron 17 números de boleto conservados de registros anteriores, cuatro con dos dígitos. Con autorización explícita del usuario se limpiaron los 17 números y sus 17 reservas mediante una transacción.

La lectura final confirmó: **570 oficiales, cero extras, cero llegadas, cero boletos asignados y cero reservas**. Las escrituras de carga y de navegador se hicieron en el proyecto de demostración local.

## Repetir las pruebas

Se requiere Node.js 22 y un Java compatible con la versión actual del emulador de Firebase. Iniciar el emulador en una terminal:

```powershell
npx firebase-tools@latest emulators:start --only firestore --project demo-attendance-audit --config firebase.audit.json
```

En otra terminal del proyecto:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8787'
$env:FIREBASE_PROJECT_ID='demo-attendance-audit'
npm test
npm run test:integration
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

Con ese servidor activo, en otra terminal:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8787'
$env:FIREBASE_PROJECT_ID='demo-attendance-audit'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e -- --workers=1
```

La suite de integración reinicia únicamente la base del emulador y deja los 570 invitados simulados para las pruebas de navegador. El resumen de carga se genera en `node_modules/.cache/attendance-audit/results.json`.

## Aplicación al evento

Los cambios están en el código local y requieren publicar una versión nueva. Después de publicarla, las seis computadoras y el iPad deben recargar la aplicación para usar el mismo código. Queda pendiente la comprobación presencial de esos dispositivos y su conexión de internet; las pruebas realizadas validan el sistema con la carga y concurrencia descritas en el entorno indicado.
