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
  const setSize = (name, value) => {
    if (document.body.style.getPropertyValue(name) !== value) document.body.style.setProperty(name, value);
  };
  const fitRail = (width, tablet, workspace) => {
    if (!tablet) {
      for (const key of ['--rail-width', '--touch-pad-size', '--rail-controls-height', '--rail-card-gap']) document.body.style.removeProperty(key);
      return;
    }
    if (workspace || document.body.classList.contains('sat-editing')) {
      setSize('--rail-width', Math.min(368, Math.max(360, width * .31)) + 'px');
      return;
    }
    // Both panels share an edge. Reserve only the height actually needed by the cards.
    const available = rail.getBoundingClientRect().height;
    setSize('--rail-card-gap', (available < 565 ? 4 : available < 650 ? 6 : 8) + 'px');
    let railWidth = Math.round(Math.min(326, Math.max(310, width * .27)));
    setSize('--rail-width', railWidth + 'px');
    while (assistant && assistant.getBoundingClientRect().height + 150 > available && railWidth < 360) {
      railWidth = Math.min(360, railWidth + 12);
      setSize('--rail-width', railWidth + 'px');
    }
    const informationHeight = assistant?.getBoundingClientRect().height || 0;
    const pad = Math.max(120, Math.floor(Math.min(200, railWidth - 112, available - informationHeight - 30)));
    setSize('--touch-pad-size', pad + 'px');
    setSize('--rail-controls-height', pad + 22 + 'px');
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
    fitRail(width, tablet, workspace);
  };
  const queueLayout = () => {
    if (!queued) { queued = true; requestAnimationFrame(syncLayout); }
  };
  new MutationObserver(queueLayout).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(queueLayout).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(queueLayout).observe(document.getElementById('satCards'), { childList: true });
  if (assistant && window.ResizeObserver) new ResizeObserver(queueLayout).observe(assistant);
  window.addEventListener('resize', queueLayout, { passive: true });
  window.addEventListener('orientationchange', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('scroll', queueLayout, { passive: true });
  syncLayout();
})();
