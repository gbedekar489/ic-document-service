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
    button.textContent = "Submit";

    formElement.appendChild(button);

    loading.style.display = "none";

    console.log("Form rendered successfully");

  } catch (err) {
    console.error("FORM LOAD ERROR:", err);

    loading.style.display = "none";
    error.textContent = `Unable to load the form: ${err.message}`;
  }
}


function renderField(field, formElement) {

  if (!field.visible) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "form-field";


  // LABEL
  const label = document.createElement("label");

  label.textContent =
    field.label?.value ||
    field.name ||
    "Field";


  // DATE
  if (field.fieldType === "date-input") {

    const input = document.createElement("input");

    input.id = field.id;
    input.name = field.name;
    input.type = "date";

    input.disabled = field.enabled === false;
    input.readOnly = field.readOnly === true;

    label.htmlFor = input.id;

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    formElement.appendChild(wrapper);

    return;
  }


  // DROPDOWN
  if (field.fieldType === "drop-down") {

    const select = document.createElement("select");

    select.id = field.id;
    select.name = field.name;

    select.disabled = field.enabled === false;

    label.htmlFor = select.id;

    // Placeholder
    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Please select";

    placeholder.disabled = true;
    placeholder.selected = true;

    select.appendChild(placeholder);


    // Build options from AEM model
    const values = field.enum || [];
    const labels = field.enumNames || [];

    values.forEach((value, index) => {

      const option = document.createElement("option");

      option.value = value;
      option.textContent =
        labels[index] !== undefined
          ? labels[index]
          : value;

      select.appendChild(option);
    });


    wrapper.appendChild(label);
    wrapper.appendChild(select);

    formElement.appendChild(wrapper);

    return;
  }


  // TEXT / EMAIL
  if (
    field.fieldType === "text-input" ||
    field.fieldType === "email"
  ) {

    const input = document.createElement("input");

    input.id = field.id;
    input.name = field.name;

    input.type =
      field.fieldType === "email"
        ? "email"
        : "text";

    input.disabled = field.enabled === false;
    input.readOnly = field.readOnly === true;

    label.htmlFor = input.id;

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    formElement.appendChild(wrapper);

    return;
  }


  // Unsupported field type
  console.warn(
    "Unsupported field type:",
    field.fieldType,
    field
  );
}


document.addEventListener(
  "DOMContentLoaded",
  loadAdaptiveForm
);