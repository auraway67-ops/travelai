const mapViewport = document.querySelector("#map-viewport");

document.querySelectorAll(".map-control").forEach((control) => {
  control.addEventListener("click", () => {
    const mode = control.dataset.mode;
    const layer = control.dataset.layer;

    if (mode) {
      const isThreeDimensional = mapViewport.dataset.view !== "flat";
      mapViewport.dataset.view = isThreeDimensional ? "flat" : "3d";
      control.textContent = isThreeDimensional ? "2D" : "3D";
      control.classList.toggle("is-active", !isThreeDimensional);
      control.setAttribute("aria-pressed", String(!isThreeDimensional));
      return;
    }

    if (layer) {
      const isActive = control.getAttribute("aria-pressed") === "true";
      control.setAttribute("aria-pressed", String(!isActive));
      control.classList.toggle("is-active", !isActive);
      mapViewport.classList.toggle(`layer-${layer}-off`, isActive);
    }
  });
});
