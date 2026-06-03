import { createRouter, createWebHistory } from "vue-router";
import ProfileDetailView from "./views/ProfileDetailView.vue";
import ProfileListView from "./views/ProfileListView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "profiles",
      component: ProfileListView
    },
    {
      path: "/profiles/:id",
      name: "profile-detail",
      component: ProfileDetailView
    }
  ]
});
