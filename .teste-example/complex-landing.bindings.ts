import { logic } from "./landing.logic";

document.getElementById("hero-section")
  ?.addEventListener("click", (e) => logic["hero-section"].openHero(e));
document.getElementById("social-proof")
  ?.addEventListener("click", (e) => logic["social-proof"].openCases(e));
document.getElementById("cta-final")
  ?.addEventListener("click", (e) => logic["cta-final"].openContact(e));