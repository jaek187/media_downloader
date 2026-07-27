document.addEventListener(
  "contextmenu",
  (event) => {
    let exactUrl = null;

    // --- Twitter / X Logic ---
    if (
      window.location.hostname.includes("twitter.com") ||
      window.location.hostname.includes("x.com")
    ) {
      const tweet = event.target.closest("article");
      if (tweet) {
        const timeLink = tweet.querySelector("a[href*='/status/']");
        if (timeLink) exactUrl = timeLink.href;

        // Nuke Twitter's custom right-click menu
        event.stopPropagation();
      }
    }

    // --- Reddit Logic ---
    if (window.location.hostname.includes("reddit.com")) {
      const shredditPost = event.target.closest("shreddit-post");
      if (shredditPost && shredditPost.getAttribute("permalink")) {
        exactUrl =
          "https://www.reddit.com" + shredditPost.getAttribute("permalink");
      } else {
        const postContainer = event.target.closest(
          ".Post, [data-testid='post-container']",
        );
        if (postContainer) {
          const commentLink = postContainer.querySelector(
            "a[href*='/comments/']",
          );
          if (commentLink) exactUrl = commentLink.href;
        } else if (window.location.pathname.includes("/comments/")) {
          exactUrl = window.location.href;
        }
      }
    }

    // Send the perfect URL to background.js
    if (exactUrl) {
      chrome.runtime.sendMessage({ type: "SET_EXACT_URL", url: exactUrl });
    }
  },
  true,
);
