import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import App from "../src/App.vue";

describe("App", () => {
  it("mounts the admin console shell", () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: true,
          Toast: true
        }
      }
    });

    expect(wrapper.exists()).toBe(true);
  });
});
