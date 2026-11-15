/** Shared confirmation modal: a centered dialog over a dimmed backdrop. */
export const CONFIRM_DIALOG_SCRIPT = `(function () {
  if (typeof window.__siftqConfirm === "function") return;

  function close(backdrop, onKeydown) {
    document.removeEventListener("keydown", onKeydown);
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  }

  window.__siftqConfirm = function (message, onConfirm) {
    var backdrop = document.createElement("div");
    backdrop.className = "matrix-modal-backdrop";
    var dialog = document.createElement("div");
    dialog.className = "matrix-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    var text = document.createElement("p");
    text.className = "matrix-modal-text";
    text.textContent = message;
    dialog.appendChild(text);
    var actions = document.createElement("div");
    actions.className = "matrix-modal-actions";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "matrix-modal-button matrix-modal-button--cancel";
    cancel.textContent = "キャンセル";
    var confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "matrix-modal-button matrix-modal-button--danger";
    confirm.textContent = "削除";
    actions.appendChild(cancel);
    actions.appendChild(confirm);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function onKeydown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(backdrop, onKeydown);
    }
    document.addEventListener("keydown", onKeydown);
    backdrop.addEventListener("click", function (event) {
      if (event.target === confirm) {
        close(backdrop, onKeydown);
        if (typeof onConfirm === "function") onConfirm();
        return;
      }
      if (event.target === cancel || event.target === backdrop) {
        event.preventDefault();
        close(backdrop, onKeydown);
      }
    });
    // Destructive actions start on the safe choice so Enter does not delete by accident.
    cancel.focus();
  };
})();`;
