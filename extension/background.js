chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ytdlp-parent",
    title: "yt-dlp Options",
    contexts: ["all"],
  });
  chrome.contextMenus.create({
    id: "action-download",
    parentId: "ytdlp-parent",
    title: "Download Video",
    contexts: ["all"],
  });
  chrome.contextMenus.create({
    id: "action-copy",
    parentId: "ytdlp-parent",
    title: "Copy Video to Clipboard",
    contexts: ["all"],
  });
});

let exactTweetUrl = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SET_EXACT_URL") {
    exactTweetUrl = message.url;
  }
});

function showToast(message, isError = false) {
  document.getElementById("media-downloader-toast")?.remove();
  const host = document.createElement("div");
  host.id = "media-downloader-toast";
  host.style.cssText = "position:fixed;top:24px;right:24px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "closed" });
  const icon = isError ? "!" : message.startsWith("Processing") ? "↓" : "✓";
  const heading = isError ? "Download couldn't start" : message.startsWith("Processing") ? "Preparing download" : "Media Downloader";
  shadow.innerHTML = `
    <style>
      .card { width: min(380px, calc(100vw - 48px)); box-sizing: border-box; padding: 16px;
        display: grid; grid-template-columns: 36px 1fr; gap: 12px; color: #f7f8fa;
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: rgba(25, 29, 38, .98); border: 1px solid ${isError ? "#f97066" : "#4ade80"};
        border-radius: 14px; box-shadow: 0 18px 48px rgba(0,0,0,.38); animation: enter .22s ease-out; }
      .icon { width: 36px; height: 36px; display:grid; place-items:center; border-radius:50%;
        background:${isError ? "#7f1d1d" : "#14532d"}; color:${isError ? "#fecaca" : "#bbf7d0"}; font-size:20px; font-weight:700; }
      strong { display:block; margin-bottom:2px; font-size:15px; } p { margin:0; color:#cbd5e1; word-break:break-word; }
      .bar { grid-column:1 / -1; height:3px; overflow:hidden; border-radius:3px; background:#334155; }
      .bar::after { content:""; display:block; height:100%; background:${isError ? "#f97066" : "#4ade80"}; animation: countdown 4s linear forwards; }
      @keyframes enter { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
      @keyframes countdown { from { width:100% } to { width:0 } }
    </style>
    <div class="card" role="status" aria-live="polite"><div class="icon">${icon}</div><div><strong>${heading}</strong><p></p></div><div class="bar"></div></div>`;
  shadow.querySelector("p").textContent = message;
  document.documentElement.appendChild(host);
  setTimeout(() => {
    host.style.transition = "opacity .2s ease, transform .2s ease";
    host.style.opacity = "0";
    host.style.transform = "translateY(-8px)";
    setTimeout(() => host.remove(), 200);
  }, 4000);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let url = exactTweetUrl || info.linkUrl || info.srcUrl || info.pageUrl;
  exactTweetUrl = null;

  if (url && url.startsWith("blob:")) {
    url = info.pageUrl;
  }

  const triggerToast = (msg, error = false) => {
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: [msg, error],
      })
      .catch((err) => console.error("Cannot inject into this page: ", err));
  };

  // Prevent Python server crash if user accidentally right-clicks the Twitter home feed background
  const invalidUrls = ["https://twitter.com/home", "https://x.com/home"];
  const cleanUrl = url.split("?")[0];

  if (invalidUrls.includes(cleanUrl)) {
    triggerToast(
      "Cannot download from a feed! Right-click the video directly.",
      true,
    );
    return;
  }

  const action = info.menuItemId === "action-download" ? "download" : "copy";

  chrome.storage.local.get(
    {
      resolution: "best",
      audioOnly: false,
      embedMeta: false,
      askSave: true,
      subfolder: "",
    },
    (items) => {
      triggerToast("Processing... This may take a minute.");

      fetch("http://127.0.0.1:5000/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          action: action,
          resolution: items.resolution,
          audioOnly: items.audioOnly,
          embedMeta: items.embedMeta,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            triggerToast("yt-dlp Error: " + data.error, true);
          } else {
            const successMsg =
              action === "copy" ? "Copied to Clipboard!" : "Download Ready!";
            triggerToast(successMsg);

            if (action === "download" && data.downloadUrl) {
              let downloadOptions = { url: data.downloadUrl };

              if (items.askSave) {
                downloadOptions.saveAs = true;
              } else {
                downloadOptions.saveAs = false;
                // If they specified a subfolder, add it to the path
                let folder = items.subfolder.replace(/\\/g, "/"); // Normalize slashes
                if (folder.endsWith("/")) folder = folder.slice(0, -1);
                if (folder && data.filename) {
                  downloadOptions.filename = folder + "/" + data.filename;
                }
              }
              chrome.downloads.download(downloadOptions);
            }
          }
        })
        .catch((err) => {
          triggerToast("Server Error: Is the Python server running?", true);
        });
    },
  );
});
