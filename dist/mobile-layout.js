(() => {
  const panel = document.getElementById("destinationPanel");
  if (!panel) return;
  const assistant = document.querySelector('.copilot');
  const controls = document.querySelector('.direction-console');
  const rail = document.createElement('div');
  rail.id = 'cockpitRail';
  document.body.append(rail);
  let queued = false;
  let previousSize = '';
  const setClass = (element, name, enabled) => {
    if (element.classList.contains(name) !== enabled) element.classList.toggle(name, enabled);
  };
  const syncLayout = () => {
    queued = false;
    const viewport = window.visualViewport;
    // Safari's visible page area excludes its status/address bars. Do not use screen.height.
    const unzoomed = !viewport || Math.abs(viewport.scale - 1) < .02;
    const width = unzoomed && viewport ? viewport.width : window.innerWidth;
    const height = unzoomed && viewport ? viewport.height : window.innerHeight;
    const top = unzoomed && viewport ? viewport.offsetTop : 0;
    const left = unzoomed && viewport ? viewport.offsetLeft : 0;
    const size = [width, height, top, left].map(Math.round).join(':');
    if (size !== previousSize) {
      previousSize = size;
      const style = document.documentElement.style;
      style.setProperty('--app-viewport-height', height + 'px');
      style.setProperty('--app-viewport-width', width + 'px');
      style.setProperty('--app-viewport-top', top + 'px');
      style.setProperty('--app-viewport-left', left + 'px');
      window.missionMap?.invalidateSize?.();
    }
    const tablet = width >= 761 && width <= 1366 && width > height;
    setClass(document.body, 'tablet-cockpit', tablet);
    setClass(document.body, 'short-cockpit', tablet && height < 720);
    setClass(document.body, 'very-short-cockpit', tablet && height < 650);
    setClass(document.body, 'mission-picker-open', !panel.hidden);
    const workspace = document.body.classList.contains('free-map-workspace');
    if (tablet) {
      // The editor hides the rail; it does not need to move either control panel.
      // The destination workspace owns the assistant while its map is expanded.
      if (!workspace && assistant && assistant.parentElement !== rail) rail.append(assistant);
      if (controls && controls.parentElement !== rail) rail.append(controls);
    } else {
      if (assistant?.parentElement === rail) document.body.append(assistant);
      if (controls?.parentElement === rail) document.body.append(controls);
    }
    setClass(rail, 'empty-assistant', !document.getElementById('satCards')?.childElementCount);
  };
  const queueLayout = () => {
    if (!queued) { queued = true; requestAnimationFrame(syncLayout); }
  };
  new MutationObserver(queueLayout).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(queueLayout).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(queueLayout).observe(document.getElementById('satCards'), { childList: true });
  window.addEventListener('resize', queueLayout, { passive: true });
  window.addEventListener('orientationchange', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('scroll', queueLayout, { passive: true });
  syncLayout();
})();
