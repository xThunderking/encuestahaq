"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ChartDatum,
  DashboardAnalytics,
} from "@/modules/responses/get-admin-dashboard-data";
import styles from "@/app/admin/admin.module.css";

const palette = ["#0063a6", "#17a6a1", "#f2b134", "#d85b45", "#7957a8"];
const satisfactionColors: Record<string, string> = {
  Excelente: "#16805a",
  Bueno: "#69a84f",
  Regular: "#e6a23c",
  Malo: "#c93d4d",
};

const tooltipStyle = {
  border: "1px solid #d8e4e7",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(20, 57, 68, 0.12)",
  fontFamily: "var(--font-poppins), Arial, sans-serif",
  fontSize: 13,
};

function EmptyChart() {
  return <div className={styles.chartEmpty}>Aún no hay datos suficientes</div>;
}

function ChartCard({
  title,
  description,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`${styles.chartCard} ${wide ? styles.chartCardWide : ""}`}>
      <div className={styles.chartHeading}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </article>
  );
}

function DonutChart({ data }: { data: ChartDatum[] }) {
  if (!data.length) return <EmptyChart />;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className={styles.donutLayout}>
      <div className={styles.donutChart}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="56%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((item, index) => (
                <Cell
                  key={item.name}
                  fill={satisfactionColors[item.name] ?? palette[index % palette.length]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutTotal}>
          <strong>{total}</strong>
          <span>respuestas</span>
        </div>
      </div>
      <ul className={styles.chartLegend}>
        {data.map((item, index) => (
          <li key={item.name}>
            <span
              className={styles.legendDot}
              style={{
                background:
                  satisfactionColors[item.name] ?? palette[index % palette.length],
              }}
            />
            <span>{item.name}</span>
            <strong>{total ? Math.round((item.value / total) * 100) : 0}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminDashboardCharts({
  analytics,
}: {
  analytics: DashboardAnalytics;
}) {
  return (
    <section className={styles.analyticsSection} aria-labelledby="analytics-title">
      <div className={styles.analyticsHeader}>
        <div>
          <p className={styles.eyebrow}>Análisis de resultados</p>
          <h2 id="analytics-title">Indicadores de experiencia</h2>
          <p>Lectura visual de todas las respuestas registradas.</p>
        </div>
        <div className={styles.analyticsBadges}>
          <span>
            NPS <strong>{analytics.nps ?? "—"}</strong>
          </span>
          <span>
            Promedio <strong>{analytics.averageRecommendation ?? "—"}/10</strong>
          </span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <ChartCard
          title="Respuestas por día"
          description="Actividad durante los últimos 14 días"
          wide
        >
          <div className={styles.chartLarge}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.dailyResponses} accessibilityLayer>
                <defs>
                  <linearGradient id="responsesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0063a6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#0063a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7edef" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Respuestas"
                  stroke="#0063a6"
                  strokeWidth={3}
                  fill="url(#responsesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Servicios atendidos" description="Distribución por área hospitalaria">
          {analytics.services.length ? (
            <div className={styles.chartTall}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.services} layout="vertical" accessibilityLayer margin={{ left: 8 }}>
                  <CartesianGrid stroke="#e7edef" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={122} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Respuestas" fill="#0063a6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Motivos de elección" description="Razones para elegir Hospital Angeles">
          {analytics.motivations.length ? (
            <div className={styles.chartTall}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.motivations} layout="vertical" accessibilityLayer margin={{ left: 8 }}>
                  <CartesianGrid stroke="#e7edef" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={122} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Respuestas" fill="#17a6a1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Satisfacción general" description="Evaluación global del servicio">
          <DonutChart data={analytics.satisfaction} />
        </ChartCard>

        <ChartCard title="Idioma" description="Idioma utilizado para contestar">
          <DonutChart data={analytics.languages} />
        </ChartCard>

        <ChartCard title="Puntuación de recomendación" description="Distribución de respuestas NPS de 0 a 10" wide>
          <div className={styles.chartMedium}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.npsDistribution} accessibilityLayer>
                <CartesianGrid stroke="#e7edef" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Respuestas" radius={[6, 6, 0, 0]}>
                  {analytics.npsDistribution.map((item) => (
                    <Cell
                      key={item.name}
                      fill={Number(item.name) >= 9 ? "#16805a" : Number(item.name) >= 7 ? "#e6a23c" : "#c93d4d"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Calidad por atributo" description="Promedio: 1 Malo · 4 Excelente" wide>
          {analytics.attributeRatings.length ? (
            <div className={styles.attributesChart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.attributeRatings} layout="vertical" accessibilityLayer margin={{ left: 8 }}>
                  <CartesianGrid stroke="#e7edef" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Promedio" fill="#7957a8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Datos de contacto" description={`${analytics.completionWithContact}% aceptó compartir sus datos`}>
          <DonutChart data={analytics.contactConsent} />
        </ChartCard>
      </div>
    </section>
  );
}
