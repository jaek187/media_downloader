document.addEventListener("DOMContentLoaded", () => {
  const resSelect = document.getElementById("resolution");
  const audioOnly = document.getElementById("audio-only");
  const embedMeta = document.getElementById("embed-meta");
  const askSave = document.getElementById("ask-save");
  const subfolder = document.getElementById("subfolder");
  const saveBtn = document.getElementById("save-btn");
  const status = document.getElementById("status");

  // Disable text input if "Ask" is checked
  const toggleSubfolder = () => {
    subfolder.disabled = askSave.checked;
  };
  askSave.addEventListener("change", toggleSubfolder);

  // Load saved settings
  chrome.storage.local.get(
    {
      resolution: "best",
      audioOnly: false,
      embedMeta: false,
      askSave: true,
      subfolder: "",
    },
    (items) => {
      resSelect.value = items.resolution;
      audioOnly.checked = items.audioOnly;
      embedMeta.checked = items.embedMeta;
      askSave.checked = items.askSave;
      subfolder.value = items.subfolder;
      toggleSubfolder();
    },
  );

  // Save settings
  saveBtn.addEventListener("click", () => {
    chrome.storage.local.set(
      {
        resolution: resSelect.value,
        audioOnly: audioOnly.checked,
        embedMeta: embedMeta.checked,
        askSave: askSave.checked,
        subfolder: subfolder.value.trim(),
      },
      () => {
        status.textContent = "Settings Saved!";
        setTimeout(() => (status.textContent = ""), 2000);
      },
    );
  });
});
