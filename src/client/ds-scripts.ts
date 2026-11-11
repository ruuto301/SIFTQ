/** DS browser pane: per-task URL remembered in localStorage. */
export const DS_SCRIPT = `(function () {
  var root = document.getElementById("ds-root");
  if (!root) return;
  var chat = document.getElementById("dsh-chat");
  var taskId = chat ? chat.getAttribute("data-task-id") : null;
  var form = document.getElementById("ds-browser-form");
  var input = document.getElementById("ds-browser-url");
  var frame = document.getElementById("ds-browser-frame");
  if (!form || !input || !frame) return;
  var key = "ds-browser:" + (taskId || "none");

  function normalize(value) {
    var url = value.trim();
    if (url === "") return "";
    if (!/^https?:\\/\\//i.test(url)) url = "https://" + url;
    return url;
  }
  function load() {
    var stored = "";
    try { stored = localStorage.getItem(key) || ""; } catch (e) { stored = ""; }
    if (stored !== "") {
      input.value = stored;
      frame.src = stored;
    }
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var url = normalize(input.value);
    if (url === "") return;
    input.value = url;
    try { localStorage.setItem(key, url); } catch (e) { /* ignore */ }
    frame.src = url;
  });
  load();
})();`;
