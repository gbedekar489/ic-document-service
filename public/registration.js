let formModel = null;
let aemPanels = [];
let currentStep = 0;

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
    formModel = responseJson.afModelDefinition;

    if (!formModel) {
      throw new Error("afModelDefinition is missing");
    }

    document.getElementById("form-title").textContent =
      formModel.title || "Registration";

    /*
     * Extract AEM panels in AEM-defined order.
     * Ignore the AEM submit button because our wizard
     * will provide its own navigation/submit controls.
     */
    const items = formModel[":items"] || {};
    const order =
      formModel[":itemsOrder"] || Object.keys(items);

    aemPanels = order
      .map(name => items[name])
      .filter(item => item && item.fieldType === "panel");

    if (aemPanels.length === 0) {
      throw new Error("No panels found in Adaptive Form");
    }

    createProgressIndicator(formElement);

    aemPanels.forEach((panel, index) => {
      renderPanel(panel, index, formElement);
    });

    createReviewPanel(formElement);
    createSignPanel(formElement);

    showStep(0);

    loading.style.display = "none";

  } catch (err) {
    console.error("FORM LOAD ERROR:", err);

    loading.style.display = "none";
    error.textContent =
      `Unable to load the form: ${err.message}`;
  }
}


/*
 * --------------------------------------------------
 * PROGRESS INDICATOR
 * --------------------------------------------------
 */

function createProgressIndicator(formElement) {
  const progress = document.createElement("div");
  progress.className = "wizard-progress";

  const labels = [
    ...aemPanels.map(
      panel => panel.label?.value || panel.name
    ),
    "Review"
  ];

  labels.forEach((label, index) => {
    const step = document.createElement("div");
    step.className = "progress-step";
    step.dataset.step = index;

    step.innerHTML = `
      <div class="progress-number">${index + 1}</div>
      <div class="progress-label">${escapeHtml(label)}</div>
    `;

    progress.appendChild(step);
  });

  formElement.appendChild(progress);
}


/*
 * --------------------------------------------------
 * AEM PANEL
 * --------------------------------------------------
 */

function renderPanel(panel, index, formElement) {
  const section = document.createElement("section");

  section.className = "wizard-panel";
  section.dataset.step = index;

  const title = document.createElement("h2");

  title.textContent =
    panel.label?.value ||
    panel.name ||
    `Step ${index + 1}`;

  section.appendChild(title);

  const panelItems = panel[":items"] || {};
  const panelOrder =
    panel[":itemsOrder"] || Object.keys(panelItems);

  panelOrder.forEach(itemName => {
    const field = panelItems[itemName];

    if (field) {
      renderField(field, section);
    }
  });

  const navigation = document.createElement("div");
  navigation.className = "wizard-navigation";

  // Back
  if (index > 0) {
    const back = createButton("Back", "secondary");

    back.addEventListener("click", () => {
      showStep(index - 1);
    });

    navigation.appendChild(back);
  } else {
    navigation.appendChild(document.createElement("span"));
  }

  // Next / Review
  const nextLabel =
    index === aemPanels.length - 1
      ? "Review"
      : "Next";

  const next = createButton(nextLabel, "primary");

  next.addEventListener("click", () => {
    showStep(index + 1);
  });

  navigation.appendChild(next);

  section.appendChild(navigation);

  formElement.appendChild(section);
}


/*
 * --------------------------------------------------
 * FIELD RENDERER
 * --------------------------------------------------
 */

function renderField(field, container) {
  if (field.visible === false) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "form-field";

  const label = document.createElement("label");

  label.textContent =
    field.label?.value ||
    field.name ||
    "Field";

  /*
   * Dropdown
   */
  if (field.fieldType === "drop-down") {
    const select = document.createElement("select");

    select.id = field.id;
    select.name = field.name;
    select.disabled = field.enabled === false;

    label.htmlFor = select.id;

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Please select";
    placeholder.disabled = true;
    placeholder.selected = true;

    select.appendChild(placeholder);

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
    container.appendChild(wrapper);

    return;
  }

  /*
   * Text-like fields
   */
  const supportedTypes = [
    "text-input",
    "email",
    "tel",
    "date-input"
  ];

  if (supportedTypes.includes(field.fieldType)) {
    const input = document.createElement("input");

    input.id = field.id;
    input.name = field.name;

    switch (field.fieldType) {
      case "email":
        input.type = "email";
        break;

      case "tel":
        input.type = "tel";
        break;

      case "date-input":
        input.type = "date";
        break;

      default:
        input.type = "text";
    }

    input.disabled = field.enabled === false;
    input.readOnly = field.readOnly === true;

    label.htmlFor = input.id;

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    container.appendChild(wrapper);

    return;
  }

  console.warn(
    "Unsupported field type:",
    field.fieldType,
    field
  );
}


/*
 * --------------------------------------------------
 * REVIEW PANEL
 * --------------------------------------------------
 */

function createReviewPanel(formElement) {
  const reviewIndex = aemPanels.length;

  const section = document.createElement("section");

  section.className = "wizard-panel";
  section.dataset.step = reviewIndex;

  const title = document.createElement("h2");
  title.textContent = "Review Your Information";

  section.appendChild(title);

  const review = document.createElement("div");
  review.id = "review-content";
  review.className = "review-content";

  section.appendChild(review);

  const navigation = document.createElement("div");
  navigation.className = "wizard-navigation";

  // Back button
  const back = createButton("Back", "secondary");

  back.addEventListener("click", () => {
    showStep(reviewIndex - 1);
  });

  // Sign Document button
  const signButton = createButton(
    "Sign Document",
    "primary"
  );

  signButton.id = "sign-document";

  signButton.addEventListener("click", async () => {
     console.log(
      "SIGN DOCUMENT BUTTON CLICKED"
    );
    await startSigning();
  });

  navigation.appendChild(back);
  navigation.appendChild(signButton);

  section.appendChild(navigation);

  formElement.appendChild(section);
}

/*
 * --------------------------------------------------
 * Signature PANEL
 * --------------------------------------------------
 */

function createSignPanel(formElement) {
  const signIndex = aemPanels.length + 1;

  const section = document.createElement("section");

  section.className = "wizard-panel";
  section.dataset.step = signIndex;

  const title = document.createElement("h2");
  title.textContent = "Sign Your Registration";

  section.appendChild(title);

  const message = document.createElement("p");
  message.id = "sign-message";
  message.textContent =
    "Preparing your document for signing...";

  section.appendChild(message);

  const signingContainer =
    document.createElement("div");

  signingContainer.id =
    "signing-container";

  signingContainer.className =
    "signing-container";

  section.appendChild(signingContainer);

  formElement.appendChild(section);
}

/*
 * --------------------------------------------------
 * STEP NAVIGATION
 * --------------------------------------------------
 */

function showStep(step) {
  const totalSteps = aemPanels.length + 1;

  if (step < 0 || step >= totalSteps) {
    return;
  }

  currentStep = step;

  document
    .querySelectorAll(".wizard-panel")
    .forEach(panel => {
      panel.style.display =
        Number(panel.dataset.step) === step
          ? "block"
          : "none";
    });

  document
    .querySelectorAll(".progress-step")
    .forEach(progressStep => {
      const progressIndex =
        Number(progressStep.dataset.step);

      progressStep.classList.toggle(
        "active",
        progressIndex === step
      );

      progressStep.classList.toggle(
        "completed",
        progressIndex < step
      );
    });

  /*
   * Entering the Review step.
   */
  if (step === aemPanels.length) {
    populateReview();
  }
}


/*
 * --------------------------------------------------
 * REVIEW DATA
 * --------------------------------------------------
 */

function populateReview() {
  const review =
    document.getElementById("review-content");

  review.innerHTML = "";

  aemPanels.forEach(panel => {
    const group = document.createElement("div");
    group.className = "review-group";

    const heading = document.createElement("h3");

    heading.textContent =
      panel.label?.value ||
      panel.name;

    group.appendChild(heading);

    const items = panel[":items"] || {};
    const order =
      panel[":itemsOrder"] || Object.keys(items);

    order.forEach(itemName => {
      const field = items[itemName];

      if (!field || !field.name) {
        return;
      }

      const control =
        document.querySelector(
          `[name="${CSS.escape(field.name)}"]`
        );

      if (!control) {
        return;
      }

      let displayValue = control.value;

      /*
       * For dropdowns, show the human-readable
       * AEM enumName instead of its submitted value.
       */
      if (
        control.tagName === "SELECT" &&
        control.selectedIndex >= 0
      ) {
        displayValue =
          control.options[
            control.selectedIndex
          ].text;
      }

      const row = document.createElement("div");
      row.className = "review-row";

      const label = document.createElement("span");
      label.className = "review-label";

      label.textContent =
        field.label?.value ||
        field.name;

      const value = document.createElement("strong");
      value.className = "review-value";

      value.textContent =
        displayValue || "—";

      row.appendChild(label);
      row.appendChild(value);

      group.appendChild(row);
    });

    review.appendChild(group);
  });
}


/*
 * --------------------------------------------------
 * SUBMIT
 * --------------------------------------------------
 */

async function submitAdaptiveForm() {
  const formElement =
    document.getElementById("adaptive-form");

  const error =
    document.getElementById("error");

  const submitButton =
    document.getElementById("final-submit");

  try {
    error.textContent = "";

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    const formData =
      new FormData(formElement);

    const data =
      Object.fromEntries(formData.entries());

    console.log(
      "Submitting Adaptive Form:",
      data
    );

    const response = await fetch(
      "/api/adaptive-form/submit",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
        "Form submission failed"
      );
    }

    showThankYouMessage(
      result.aemResponse?.thankYouMessage
    );

  } catch (err) {
    console.error("SUBMIT ERROR:", err);

    error.textContent =
      `Unable to submit the form: ${err.message}`;

    submitButton.disabled = false;
    submitButton.textContent = "Submit";
  }
}


/*
 * --------------------------------------------------
 * SUCCESS
 * --------------------------------------------------
 */

function showThankYouMessage(message) {
  const card =
    document.querySelector(".form-card");

  const success =
    document.createElement("div");

  success.className = "success-message";

  const icon =
    document.createElement("div");

  icon.className = "success-icon";
  icon.textContent = "✓";

  const heading =
    document.createElement("h2");

  heading.textContent =
    "Registration submitted";

  const messageContainer =
    document.createElement("div");

  messageContainer.className =
    "thank-you-message";

  // Use text rather than injecting arbitrary HTML.
  const temporary =
    document.createElement("div");

  temporary.innerHTML =
    message ||
    "Thank you for submitting the form.";

  messageContainer.textContent =
    temporary.textContent;

  success.appendChild(icon);
  success.appendChild(heading);
  success.appendChild(messageContainer);

  card.replaceChildren(success);
}


/*
 * --------------------------------------------------
 * HELPERS
 * --------------------------------------------------
 */

function createButton(label, type) {
  const button =
    document.createElement("button");

  /*
   * Very important:
   * navigation buttons must NOT submit the form.
   */
  button.type = "button";

  button.className =
    type === "primary"
      ? "wizard-button primary-button"
      : "wizard-button secondary-button";

  button.textContent = label;

  return button;
}


function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}
async function startSigning() {
  console.log("=== START SIGNING ===");

  const formElement =
    document.getElementById("adaptive-form");

  const error =
    document.getElementById("error");

  const signButton =
    document.getElementById("sign-document");

  try {
    error.textContent = "";

    if (signButton) {
      signButton.disabled = true;
      signButton.textContent =
        "Preparing document...";
    }

    // Collect all current form values
    const formData =
      new FormData(formElement);

    const data =
      Object.fromEntries(
        formData.entries()
      );

    console.log(
      "Sending registration data for signing"
    );

    // Call our existing backend
    const response =
      await fetch(
        "/api/registration/sign/transient",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );

    const result =
      await response.json();

    console.log(
      "Signing API response:",
      result
    );

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.error ||
        "Unable to start signing"
      );
    }

    if (!result.widgetUrl) {
      throw new Error(
        "Widget URL was not returned"
      );
    }

    // Step 4
    const signStep =
      aemPanels.length + 1;

    showStep(signStep);
displaySigningWidget(
  result.widgetJavaScript
);
  
  } catch (err) {
    console.error(
      "SIGNING ERROR:",
      err
    );

    error.textContent =
      `Unable to start signing: ${err.message}`;

    if (signButton) {
      signButton.disabled = false;
      signButton.textContent =
        "Sign Document";
    }
  }
}
function displaySigningWidget(widgetJavaScript) {
  const message =
    document.getElementById("sign-message");

  const container =
    document.getElementById("signing-container");

  if (!container) {
    throw new Error(
      "Signing container was not found"
    );
  }

  if (!widgetJavaScript) {
    throw new Error(
      "Adobe Sign widget JavaScript was not returned"
    );
  }

  container.innerHTML = "";

  const parser = new DOMParser();

  const doc = parser.parseFromString(
    widgetJavaScript,
    "text/html"
  );

  const sourceScript =
    doc.querySelector("script");

  if (!sourceScript) {
    throw new Error(
      "Could not parse Adobe Sign widget script"
    );
  }

  const scriptSrc =
    sourceScript.getAttribute("src");

  if (!scriptSrc) {
    throw new Error(
      "Adobe Sign widget script does not contain a src"
    );
  }

  console.log(
    "Loading Acrobat Sign embedded widget"
  );

  const script =
    document.createElement("script");

  script.type = "text/javascript";
  script.src = scriptSrc;

  container.appendChild(script);

  if (message) {
    message.textContent =
      "Please review and sign your document.";
  }
}

document.addEventListener(
  "DOMContentLoaded",
  loadAdaptiveForm
);