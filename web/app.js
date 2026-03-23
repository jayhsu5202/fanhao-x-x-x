(function () {
  const video = document.getElementById("player");
  const input = document.getElementById("src-input");
  const btnLoad = document.getElementById("btn-load");
  const statusEl = document.getElementById("status");
  const metaLine = document.getElementById("meta-line");
  const btnFs = document.getElementById("btn-fullscreen");

  /** @type {import("hls.js").default | null} */
  let hls = null;

  function setStatus(text, isError) {
    if (!text) {
      statusEl.textContent = "";
      statusEl.classList.remove("visible", "error");
      return;
    }
    statusEl.textContent = text;
    statusEl.classList.add("visible");
    statusEl.classList.toggle("error", !!isError);
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute("src");
    video.load();
  }

  function loadUrl(url) {
    const trimmed = (url || "").trim();
    if (!trimmed) {
      setStatus("請輸入 m3u8 網址", true);
      return;
    }

    destroyHls();
    setStatus("載入中…");
    metaLine.textContent = "";

    const isM3U8 = /\.m3u8(\?|$)/i.test(trimmed) || trimmed.includes("playlist.m3u8");

    if (isM3U8 && window.Hls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(trimmed);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        setStatus("");
        metaLine.textContent = "已就緒 · 可開始播放";
        video.play().catch(function () {
          metaLine.textContent = "已載入 · 請按播放";
        });
      });
      hls.on(Hls.Events.ERROR, function (_e, data) {
        if (data.fatal) {
          let msg = "播放錯誤";
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            msg = "網路或 CORS 被拒 · 請改由同源代理";
          }
          setStatus(msg, true);
          metaLine.textContent = data.details || "";
        }
      });
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = trimmed;
      video.addEventListener(
        "loadedmetadata",
        function onMeta() {
          video.removeEventListener("loadedmetadata", onMeta);
          setStatus("");
          metaLine.textContent = "已就緒（原生 HLS）";
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        function onErr() {
          video.removeEventListener("error", onErr);
          setStatus("無法載入此網址", true);
        },
        { once: true }
      );
      return;
    }

    setStatus("此瀏覽器不支援 HLS，請用 Chrome / Edge / Safari 或更新 hls.js", true);
  }

  function readQuery() {
    const q = new URLSearchParams(window.location.search).get("url");
    if (q) {
      input.value = decodeURIComponent(q);
      loadUrl(input.value);
    }
  }

  btnLoad.addEventListener("click", function () {
    loadUrl(input.value);
    const u = new URL(window.location.href);
    if (input.value.trim()) {
      u.searchParams.set("url", input.value.trim());
    } else {
      u.searchParams.delete("url");
    }
    window.history.replaceState({}, "", u);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") btnLoad.click();
  });

  document.querySelector('[data-demo="clear"]').addEventListener("click", function () {
    input.value = "";
    destroyHls();
    setStatus("");
    metaLine.textContent = "";
    const u = new URL(window.location.href);
    u.searchParams.delete("url");
    window.history.replaceState({}, "", u);
  });

  btnFs.addEventListener("click", function () {
    const shell = document.querySelector(".video-shell");
    if (!document.fullscreenElement) {
      shell.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.target === input) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (video.paused) video.play();
      else video.pause();
    }
    if (e.key === "f" || e.key === "F") btnFs.click();
  });

  readQuery();
})();
