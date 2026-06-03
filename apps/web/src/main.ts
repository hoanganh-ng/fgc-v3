import "./styles.css";
import Aura from "@primevue/themes/aura";
import { VueQueryPlugin } from "@tanstack/vue-query";
import PrimeVue from "primevue/config";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.js";

createApp(App)
  .use(PrimeVue, {
    ripple: true,
    theme: {
      preset: Aura
    }
  })
  .use(VueQueryPlugin)
  .use(router)
  .mount("#app");
