export function createAlert(templateId, containerId = "alert-container") {
  const alertTemplate = document.getElementById(templateId);
  const alertContainer = document.getElementById(containerId);

  if (!alertTemplate) {
    console.error(`Template with ID '${templateId}' not found.`);
    return;
  }

  if (!alertContainer) {
    console.error(`Alert container with ID '${containerId}' not found.`);
    return;
  }

//   console.log(alertTemplate);

  // Clone the template content
  const clonedAlert = alertTemplate.content.cloneNode(true);

  // Assign a unique ID to the cloned alert
  const uniqueId = `${templateId}-${Date.now()}`;
  const alertElement = clonedAlert.querySelector('[role="alert"]');
//   console.log(uniqueId);
//   console.log(alertElement);
  alertElement.id = uniqueId;

  // Remove the 'hidden' class to make it visible
  alertElement.classList.remove("hidden");

  // Attach event listener to the close button
  const closeButton = alertElement.querySelector(".close-alert-button");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      alertElement.remove();
    });
  }

  // Append the cloned alert to the container
  alertContainer.appendChild(clonedAlert);

  // Automatically hide the alert after a certain time
  setTimeout(() => {
    alertElement.remove();
  }, 6000);
}