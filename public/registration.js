async function loadAdaptiveForm() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const formElement = document.getElementById("adaptive-form");

  try {
    const response = await fetch("/api/adaptive-form");

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const responseJson = await response.json();
    const formModel = responseJson.afModelDefinition;

    if (!formModel) {
      throw new Error("afModelDefinition is missing");
    }

    document.getElementById("form-title").textContent =
      formModel.title || "Registration";

    const items = formModel[":items"] || {};
    const itemOrder =
      formModel[":itemsOrder"] || Object.keys(items);

    itemOrder.forEach((itemName) => {
      const field = items[itemName];

      if (field) {
        renderField(field, formElement);
      }
    });

    const button = document.createElement("button");
    button.type = "submit";
    button.className = "submit-button";
    button.textContent = "Continue";

    formElement.appendChild(button);

    loading.style.display = "none";

  } catch (err) {
    console.error("FORM LOAD ERROR:", err);

    loading.style.display = "none";
    error.textContent = `Unable to load the form: ${err.message}`;
  }
}

function renderField(field, formElement) {
  if (
    field.fieldType !== "text-input" &&
    field.fieldType !== "email"
  ) {
    console.warn("Unsupported field type:", field.fieldType);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "form-field";

  const label = document.createElement("label");
  label.htmlFor = field.id;
  label.textContent =
    field.label?.value ||
    field.name ||
    "Field";

  const input = document.createElement("input");

  input.id = field.id;
  input.name = field.name;
  input.type =
    field.fieldType === "email"
      ? "email"
      : "text";

  input.disabled = field.enabled === false;
  input.readOnly = field.readOnly === true;

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  formElement.appendChild(wrapper);
}

document.addEventListener(
  "DOMContentLoaded",
  loadAdaptiveForm
);