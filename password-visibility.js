(() => {
  let nextId = 0;
  for (const input of document.querySelectorAll('input[type="password"]')) {
    if (input.id && document.querySelectorAll("[data-password-toggle]").length &&
        Array.from(document.querySelectorAll("[data-password-toggle]")).some(button => button.dataset.passwordToggle === input.id)) continue;
    if (!input.id) {
      do { input.id = "password-visibility-" + ++nextId; }
      while (document.getElementById(input.id) !== input);
    }
    const field = input.closest("label") || input;
    const wrapper = document.createElement("div");
    wrapper.style.minWidth = "0";
    field.before(wrapper);
    wrapper.append(field);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show password";
    button.setAttribute("aria-controls", input.id);
    button.style.cssText = "display:block;min-height:44px;margin-top:4px;padding:6px 10px;border:1px solid #bbc9da;border-radius:6px;background:#fff;color:#071d38;font:inherit;cursor:pointer";
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide password" : "Show password";
    });
    wrapper.append(button);
  }
})();
