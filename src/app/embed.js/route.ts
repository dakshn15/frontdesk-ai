// The script businesses paste into their site. It adds one iframe with the chat page and
// resizes it when the chat opens or closes; everything visible lives inside the iframe, so
// the site's own CSS can't break it. Kept as plain ES5 so it runs on any site.
const SCRIPT = `(function () {
  var script = document.currentScript;
  if (!script || window.__frontdeskChat) return;
  var workspace = script.getAttribute("data-workspace");
  if (!workspace) return;
  window.__frontdeskChat = true;
  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/" + encodeURIComponent(workspace);
  frame.title = "Chat";
  var style = frame.style;
  style.position = "fixed";
  style.bottom = "0";
  style.right = "0";
  style.border = "0";
  style.zIndex = "2147483000";
  style.colorScheme = "normal";
  style.background = "transparent";
  var state = { open: false, position: "right" };
  function size() {
    var phone = window.innerWidth < 480;
    style.width = state.open ? (phone ? "100vw" : "416px") : "88px";
    style.height = state.open ? (phone ? "100dvh" : "min(720px, 100dvh)") : "88px";
    style.left = state.position === "left" ? "0" : "auto";
    style.right = state.position === "left" ? "auto" : "0";
  }
  size();
  window.addEventListener("resize", size);
  // Commands for the chat wait until it has said it's ready.
  var ready = false;
  var queue = [];
  function send(message) {
    if (ready) frame.contentWindow.postMessage(message, origin);
    else queue.push(message);
  }
  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.type !== "frontdesk:state") return;
    state.open = data.open === true;
    state.position = data.position === "left" ? "left" : "right";
    size();
    if (!ready) {
      ready = true;
      while (queue.length) frame.contentWindow.postMessage(queue.shift(), origin);
    }
  });
  // For the page around the chat: open it, or open it and ask a question.
  window.FrontDesk = {
    open: function () { send({ type: "frontdesk:open" }); },
    ask: function (text) { send({ type: "frontdesk:ask", text: String(text).slice(0, 500) }); }
  };
  (document.body || document.documentElement).appendChild(frame);
})();
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
