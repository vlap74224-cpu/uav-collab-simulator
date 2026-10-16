(() => {
  const panel = document.getElementById("destinationPanel");
  if (!panel) return;

  const syncLayout = () => {
    document.body.classList.toggle("mission-picker-open", !panel.hidden);
    requestAnimationFrame(() => window.missionMap?.invalidateSize?.());
  };

  new MutationObserver(syncLayout).observe(panel, {
    attributes: true,
    attributeFilter: ["hidden"]
  });
  window.addEventListener("resize", syncLayout, { passive: true });
  window.addEventListener("orientationchange", syncLayout, { passive: true });
  syncLayout();
})();
