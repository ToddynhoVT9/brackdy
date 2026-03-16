const logic = {
  "hero-section": {
    openHero() {
      console.log("Hero ativado");
    }
  },
  "social-proof": {
    openCases() {
      console.log("Cases abertos");
    }
  },
  "cta-final": {
    openContact() {
      console.log("Contato aberto");
    }
  },
  "nav": {
    toggleMenu() {
      const menu = document.querySelector("nav");
      menu?.classList.toggle("open");
    }
  },
  "hero": {
    openVideo() {
      console.log("Vídeo de demonstração aberto");
    }
  },
  "cta": {
    submitForm() {
      console.log("Formulário enviado");
    }
  }
};
