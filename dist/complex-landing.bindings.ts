import { logic } from "../_brackdy-docs/.teste-example/landing.logic.ts";

document.addEventListener("DOMContentLoaded", () => {
  // AVISO: evento @click:nav.toggleMenu em nó sem id — wiring manual necessário
  document.getElementById("hero-section")
    .addEventListener("click", () => logic["hero-section"].openHero());
  // AVISO: evento @click:hero.openVideo em nó sem id — wiring manual necessário
  document.getElementById("social-proof")
    .addEventListener("click", () => logic["social-proof"].openCases());
  document.getElementById("cta-final")
    .addEventListener("click", () => logic["cta-final"].openContact());
  // AVISO: evento @click:cta.submitForm em nó sem id — wiring manual necessário
});