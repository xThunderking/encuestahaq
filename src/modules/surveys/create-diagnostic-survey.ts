import { Model } from "survey-core";
import definition from "./diagnostic-survey.json";

export function createDiagnosticSurvey() {
  const elements = definition.pages[0].elements;
  const select = (ids: number[], columns = 2) =>
    ids.map((id) => {
      const question = elements.find(
        (item) => item.name === `servicios_externos_diagnostico_pregunta_${id}`,
      )!;
      return {
        ...question,
        ...(question.type === "radiogroup" ? { colCount: columns } : {}),
      };
    });
  const model = new Model({
    ...definition,
    widthMode: "responsive",
    width: undefined,
    showQuestionNumbers: "off",
    requiredText: "*",
    animationEnabled: false,
    focusFirstQuestionAutomatic: true,
    pageNextText: { default: "Continuar", en: "Continue" },
    pagePrevText: { default: "Volver", en: "Back" },
    pages: [
      { name: "service", elements: select([1, 17, 2, 3, 18, 20]) },
      {
        name: "experience",
        elements: select(
          [6, 7, 8, 9, 10, 11, 21, 22, 23, 24, 25, 26, 27, 28],
          4,
        ),
      },
      { name: "comments", elements: select([14, 15, 32, 30, 31, 29]) },
    ],
  });
  model.clearInvisibleValues = "onHidden";
  model.applyTheme({
    themeName: "default",
    colorPalette: "light",
    isPanelless: true,
    cssVariables: {
      "--sjs-general-backcolor": "#ffffff",
      "--sjs-general-backcolor-dim": "#ffffff",
      "--sjs-primary-backcolor": "#0063a6",
      "--sjs-primary-backcolor-dark": "#004f85",
      "--sjs-primary-forecolor": "#ffffff",
      "--sjs-font-family": "var(--font-poppins), Arial, sans-serif",
      "--sjs-font-size": "18px",
      "--sjs-corner-radius": "6px",
    },
  });
  return model;
}
