"use client";

import Image from "next/image";
import { useState } from "react";
import { Model } from "survey-core";
import "survey-core/i18n/spanish";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import definition from "@/modules/surveys/diagnostic-survey.json";
import "./diagnostic-survey.css";

export default function DiagnosticSurvey() {
  const [language, setLanguage] = useState("es");
  const [survey] = useState(() => {
    const model = new Model(definition);
    model.applyTheme({
      themeName: "default",
      colorPalette: "light",
      isPanelless: false,
      cssVariables: {
        "--sjs-general-backcolor": "#ffffff",
        "--sjs-general-backcolor-dim": "#eff4ff",
        "--sjs-primary-backcolor": "#0063a6",
        "--sjs-primary-backcolor-dark": "#004f85",
        "--sjs-primary-forecolor": "#ffffff",
        "--sjs-font-family": "var(--font-poppins), Arial, sans-serif",
        "--sjs-corner-radius": "4px",
      },
    });
    model.clearInvisibleValues = "onHidden";
    return model;
  });
  function changeLanguage(value: string) {
    setLanguage(value);
    survey.setPropertyValue("locale", value);
    survey.setPropertyValue(
      "requiredText",
      value === "es" ? "(*) Respuesta Obligatoria" : "(*) Required",
    );
  }
  return (
    <main className="diagnostic-survey" lang={language}>
      <header className="survey-brand-header">
        <h1 className="sr-only">
          Encuesta de servicios externos de diagnóstico
        </h1>
        <Image
          src="/hospital-angeles-header.png"
          alt="Hospital Angeles Health System"
          width={390}
          height={80}
          priority
          className="survey-brand"
        />
        <select
          aria-label="Idioma / Language"
          value={language}
          onChange={(event) => changeLanguage(event.target.value)}
          className="survey-language"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </header>
      <div className="survey-surface">
        <Survey model={survey} />
      </div>
    </main>
  );
}
